"""Build a Golf swing-analysis bundle for the homepage motion chapter.

    python3 scripts/build-golf-swing-analysis.py golf-1872    # team capture, measured findings
    python3 scripts/build-golf-swing-analysis.py golf-legacy  # third-party footage, illustrative

Inputs per session: a GENMO surface sequence (soma-metadata.json + soma-vertices.bin) and an
OpenSim motion (opensim-motion.json + rajagopal-bones.glb). Outputs next to the surface:
  swing-mesh.bin        int16-quantised vertices for the swing window
  swing-analysis.json   club, ball, skeleton, muscles, annotations, measured traces
  source-swing.mp4      the capture's own footage for the same window (only when GOLF_SOURCE_VIDEO is set)

No capture contains a club. The club is estimated from hand pose, held by both hands (the
skeleton's right arm is solved onto the grip), and eased onto the ball at impact. Facing and
target directions are measured from each capture rather than assumed.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

import golf_grip

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
BALL_RADIUS = 0.021
LEGACY_SESSION = "FC4FE648-7D42-4560-832B-E2FE1B61B07A"


def kabsch(a: np.ndarray, b: np.ndarray):
    ca, cb = a.mean(0), b.mean(0)
    u, _, vt = np.linalg.svd((a - ca).T @ (b - cb))
    d = np.diag([1, 1, np.sign(np.linalg.det(vt.T @ u.T))])
    r = vt.T @ d @ u.T
    return r, cb - r @ ca


def eased_direction(direction: np.ndarray, toward_ball: np.ndarray, weight: float) -> np.ndarray:
    """Rotate the club direction toward the ball by `weight` (0 → estimate, 1 → ball)."""
    if weight < 1e-4:
        return direction
    a = Rotation.align_vectors([toward_ball], [direction])[0]
    return Rotation.from_rotvec(a.as_rotvec() * weight).apply(direction)


def unit(v: np.ndarray) -> np.ndarray:
    return v / np.linalg.norm(v)


def smooth_directions(directions: np.ndarray, sigma_frames: float) -> np.ndarray:
    """Gaussian-smooth unit vectors over time: hand-rotation noise is amplified by the
    club's length, so the raw estimate makes the club-head path jitter."""
    if sigma_frames <= 0:
        return directions
    radius = int(np.ceil(3 * sigma_frames))
    offsets = np.arange(-radius, radius + 1)
    kernel = np.exp(-0.5 * (offsets / sigma_frames) ** 2)
    padded = np.pad(directions, ((radius, radius), (0, 0)), mode="edge")
    out = np.stack([(padded[i:i + len(offsets)] * kernel[:, None]).sum(0) for i in range(len(directions))])
    return out / np.linalg.norm(out, axis=1, keepdims=True)


def rounded(rows):
    return [[round(float(v), 4) for v in row] for row in rows]


def build(cfg: dict) -> None:
    fps, start, end, impact = cfg["fps"], cfg["start"], cfg["end"], cfg["impact"]
    sigma = cfg["impact_sigma"]

    def impact_weight(frame: int) -> float:
        return float(np.exp(-0.5 * ((frame - impact) / sigma) ** 2))

    # ----------------------------------------------------------------------- GENMO surface
    mesh_dir: Path = cfg["mesh_dir"]
    meta = json.loads((mesh_dir / "soma-metadata.json").read_text())
    vertex_count = meta["vertexCount"]
    vertices = np.fromfile(mesh_dir / "soma-vertices.bin", dtype=np.float32).reshape(meta["frameCount"], vertex_count, 3)
    window = vertices[start:end + 1]

    # The fastest vertices through the downswing are the gripping hands; they move almost
    # rigidly together, so their centroid is the grip and their rotation steers the club.
    d0, d1 = cfg["downswing"]
    peak_speed = np.linalg.norm(np.diff(vertices[d0:d1], axis=0), axis=2).max(0) * fps
    hand_vertices = np.where(peak_speed > np.percentile(peak_speed, 97))[0]

    reference = vertices[cfg["address_frame"]]
    ground = float(reference[:, 2].min())
    grip_ref = reference[hand_vertices].mean(0)
    hips = reference[(reference[:, 2] > 0.5 * reference[:, 2].max()) & (reference[:, 2] < 0.62 * reference[:, 2].max())]
    s_up = np.array([0.0, 0.0, 1.0])
    s_forward = grip_ref - hips.mean(0)
    s_forward[2] = 0
    s_forward = unit(s_forward)
    s_right = np.cross(s_forward, s_up)
    s_target = -s_right  # right-handed golfer: target is on the golfer's left

    surface_height = float(reference[:, 2].max() - ground)

    # ----------------------------------------------------------------------- OpenSim skeleton
    motion = json.loads(cfg["motion"].read_text())
    frames = motion["frames"]
    body_names = motion["bodyNames"]

    def body(frame: int, name: str):
        b = frames[frame]["bodies"][name]
        return np.array(b["p"]), Rotation.from_quat(b["q"])  # OpenSim quaternions are x, y, z, w

    address = range(*cfg["address_range"])
    hand_l = np.array([body(i, "hand_l")[0] for i in range(len(frames))])
    pelvis = np.array([body(i, "pelvis")[0] for i in range(len(frames))])
    os_ground = min(min(f["bodies"]["toes_l"]["p"][1], f["bodies"]["toes_r"]["p"][1]) for f in frames)
    o_up = np.array([0.0, 1.0, 0.0])
    o_forward = hand_l[list(address)].mean(0) - pelvis[list(address)].mean(0)
    o_forward[1] = 0
    o_forward = unit(o_forward)
    o_right = np.cross(o_forward, o_up)
    o_target = -o_right

    torso_top = []
    for i in address:
        p, r = body(i, "torso")
        torso_top.append(p + r.apply([0, 0.62, 0]))
    skeleton_height = float(np.mean(torso_top, 0)[1] - os_ground + 0.1)
    scale_to_surface = surface_height / skeleton_height

    # Ball sits where the address club meets the turf, in line with the hands.
    os_club_length = cfg["club_length"]
    grip_os = hand_l[list(address)].mean(0)
    drop_os = grip_os[1] - (os_ground + BALL_RADIUS)
    reach_os = np.sqrt(max(os_club_length**2 - drop_os**2, 0.01))
    os_ball = grip_os + o_forward * reach_os
    os_ball[1] = os_ground + BALL_RADIUS
    local_dirs = [body(i, "hand_l")[1].inv().apply(unit(os_ball - hand_l[i])) for i in address]
    local_dir = unit(np.mean(local_dirs, 0))

    grip_pose = cfg.get("grip", False)
    if grip_pose:
        golf_grip.bake_grip_hands(cfg["bones_source"], cfg["bones_baked"])
        # The club now leaves the lead palm instead of the wrist, so the ball and the club's
        # direction in the hand frame are settled against that point. Each depends on the other.
        for _ in range(4):
            palms = []
            for i in address:
                wrist, hand = body(i, "hand_l")
                club = hand.apply(local_dir)
                across = golf_grip.lean(unit(wrist - body(i, "ulna_l")[0]), club)
                palms.append(wrist + golf_grip.grip_rotation(club, across, "l").apply(golf_grip.PALM_POINT))
            grip_os = np.mean(palms, 0)
            drop_os = grip_os[1] - (os_ground + BALL_RADIUS)
            os_ball = grip_os + o_forward * np.sqrt(max(os_club_length**2 - drop_os**2, 0.01))
            os_ball[1] = os_ground + BALL_RADIUS
            local_dir = unit(np.mean(
                [body(i, "hand_l")[1].inv().apply(unit(os_ball - palm)) for i, palm in zip(address, palms)], 0
            ))

    mesh_club_length = os_club_length * scale_to_surface
    drop = grip_ref[2] - (ground + BALL_RADIUS)
    mesh_ball = grip_ref + s_forward * np.sqrt(max(mesh_club_length**2 - drop**2, 0.01))
    mesh_ball[2] = ground + BALL_RADIUS
    m_dir0 = unit(mesh_ball - grip_ref)

    smoothing = cfg["club_smoothing_s"] * fps
    raw_dirs = np.array([
        kabsch(reference[hand_vertices], vertices[frame][hand_vertices])[0] @ m_dir0 for frame in range(start, end + 1)
    ])
    mesh_dirs = smooth_directions(raw_dirs, smoothing)
    mesh_club = []
    for frame, smooth_dir in zip(range(start, end + 1), mesh_dirs):
        grip = vertices[frame][hand_vertices].mean(0)
        direction = eased_direction(smooth_dir, unit(mesh_ball - grip), impact_weight(frame))
        head = grip + mesh_club_length * direction
        head[2] = max(head[2], ground + 0.004)  # never sweep through the turf
        # The grip is the centre of both hands; draw the shaft from a butt end above them so it
        # passes through the hands instead of starting inside them.
        top = grip - direction * (golf_grip.BUTT_LENGTH + golf_grip.HAND_SPACING / 2) if grip_pose else grip
        mesh_club.append(np.concatenate([top, head]))

    lo, hi = window.reshape(-1, 3).min(0), window.reshape(-1, 3).max(0)
    q_scale = (hi - lo) / 65535.0
    np.round((window - lo) / q_scale - 32768).astype(np.int16).tofile(mesh_dir / "swing-mesh.bin")

    def solve_right_arm(target: np.ndarray, poses: dict):
        """Two-bone IK: bring the right wrist to `target`, beside the shaft below the lead hand."""
        shoulder, humerus_q = poses["humerus_r"]
        elbow, ulna_q = poses["ulna_r"]
        radius_p, radius_q = poses["radius_r"]
        wrist, hand_q = poses["hand_r"]
        upper, fore = np.linalg.norm(elbow - shoulder), np.linalg.norm(wrist - elbow)
        reach = target - shoulder
        dist = min(np.linalg.norm(reach), upper + fore - 1e-3)
        axis = unit(reach)
        target = shoulder + axis * dist
        pole = (elbow - shoulder) - axis * np.dot(elbow - shoulder, axis)
        pole = unit(pole) if np.linalg.norm(pole) > 1e-6 else np.array([0.0, -1.0, 0.0])
        along = (upper**2 - fore**2 + dist**2) / (2 * dist)
        new_elbow = shoulder + axis * along + pole * np.sqrt(max(upper**2 - along**2, 0.0))
        upper_turn = Rotation.align_vectors([new_elbow - shoulder], [elbow - shoulder])[0]
        moved_wrist = new_elbow + upper_turn.apply(wrist - elbow)
        fore_turn = Rotation.align_vectors([target - new_elbow], [moved_wrist - new_elbow])[0]
        arm_turn = fore_turn * upper_turn
        poses["humerus_r"] = (shoulder, upper_turn * humerus_q)
        poses["ulna_r"] = (new_elbow, arm_turn * ulna_q)
        poses["radius_r"] = (new_elbow + arm_turn.apply(radius_p - elbow), arm_turn * radius_q)
        poses["hand_r"] = (target, arm_turn * hand_q)

    skeleton_dirs = smooth_directions(
        np.array([body(frame, "hand_l")[1].apply(local_dir) for frame in range(start, end + 1)]), smoothing
    )
    skeleton_frames, skeleton_club, muscle_frames = [], [], []
    leans: dict = {"l": None, "r": None}
    shoulder_slack = 0.0
    for frame, smooth_dir in zip(range(start, end + 1), skeleton_dirs):
        poses = {name: body(frame, name) for name in body_names}
        wrist, _ = poses["hand_l"]
        if grip_pose:
            # Lead hand: keep the measured wrist position, turn the hand so the club crosses its palm.
            # The club's direction eases toward the ball from the palm, hence the short iteration.
            forearm = unit(wrist - poses["ulna_l"][0])
            grip = wrist
            for _ in range(3):
                direction = eased_direction(smooth_dir, unit(os_ball - grip), impact_weight(frame))
                across = golf_grip.lean(forearm, direction, leans["l"])
                lead = golf_grip.grip_rotation(direction, across, "l")
                grip = wrist + lead.apply(golf_grip.PALM_POINT)
            leans["l"] = across
            poses["hand_l"] = (wrist, lead)
            # Trail hand: its palm sits on the shaft below the lead hand; the arm is solved to reach it.
            trail_palm = grip + direction * golf_grip.HAND_SPACING
            for _ in range(8):
                forearm = unit(poses["hand_r"][0] - poses["ulna_r"][0])
                across = golf_grip.lean(forearm, direction, leans["r"])
                trail = golf_grip.grip_rotation(direction, across, "r")
                target = trail_palm - trail.apply(golf_grip.PALM_POINT)
                solve_right_arm(target, poses)
            leans["r"] = across
            # The fitted right shoulder sits a few centimetres too far back for a straight arm to
            # reach the club. Carry the whole arm the remaining distance rather than leave the hand off it.
            slack = target - poses["hand_r"][0]
            shoulder_slack = max(shoulder_slack, float(np.linalg.norm(slack)))
            for name in ("humerus_r", "ulna_r", "radius_r", "hand_r"):
                poses[name] = (poses[name][0] + slack, poses[name][1])
            poses["hand_r"] = (poses["hand_r"][0], trail)
            top = grip - direction * golf_grip.BUTT_LENGTH
        else:
            grip = top = wrist
            direction = eased_direction(smooth_dir, unit(os_ball - grip), impact_weight(frame))
            solve_right_arm(grip + direction * 0.09, poses)
        head = grip + os_club_length * direction
        head[1] = max(head[1], os_ground + 0.004)
        skeleton_club.append(np.concatenate([top, head]))
        skeleton_frames.append([round(float(v), 4) for name in body_names for v in (*poses[name][0], *poses[name][1].as_quat())])
        muscle_frames.append([[[round(float(c), 4) for c in point] for point in m["points"]] for m in frames[frame]["muscles"]])
    muscle_names = [m["name"] for m in frames[start]["muscles"]]

    # Map OpenSim's (forward, up, right) basis onto the surface's so both figures face alike.
    to_surface = np.column_stack([s_forward, s_up, s_right]) @ np.column_stack([o_forward, o_up, o_right]).T

    local = lambda f: f - start  # noqa: E731
    phases = [{**p, "start": local(p["start"]), "end": local(p["end"])} for p in cfg["phases"]]
    annotations = [
        {**a, "start": local(a["start"]), "end": local(a["end"]), **({"hold": local(a["hold"])} if "hold" in a else {})}
        for a in cfg["annotations"]
    ]
    series = [
        {**trace, "values": [round(float(v), 1) for v in trace["values"][start:end + 1]]}
        for trace in cfg.get("series", [])
    ]

    bundle = {
        "format": "cerebel-swing-analysis-v1",
        "fps": fps,
        "sourceStartFrame": start,
        "frameCount": end - start + 1,
        "impactIndex": impact - start,
        "phases": phases,
        "disclosure": cfg["disclosure"],
        "highlights": cfg.get("highlights", []),
        "series": series,
        "surface": {
            # Public labels name what the visitor sees, not the models behind it.
            "label": "Body surface",
            "vertexCount": vertex_count,
            "facesUrl": cfg["faces_url"],
            "verticesUrl": cfg["swing_mesh_url"],
            "quantisation": {"offset": [round(float(v), 6) for v in lo], "scale": [float(v) for v in q_scale]},
            "ground": round(ground, 4),
            "height": round(surface_height, 4),
            "forward": [round(float(v), 4) for v in s_forward],
            "target": [round(float(v), 4) for v in s_target],
            "ball": [round(float(v), 4) for v in mesh_ball],
            "club": rounded(mesh_club),
        },
        "skeleton": {
            "label": "Skeleton + muscles",
            "boneModelUrl": cfg["bones_url"],
            "toSurfaceAxes": [[round(float(v), 5) for v in row] for row in to_surface],
            "scaleToSurface": round(scale_to_surface, 4),
            "ground": round(float(os_ground), 4),
            "target": [round(float(v), 4) for v in o_target],
            "up": [0, 1, 0],
            "bodyNames": body_names,
            "frames": skeleton_frames,
            "muscleNames": muscle_names,
            "muscles": muscle_frames,
            "ball": [round(float(v), 4) for v in os_ball],
            "club": rounded(skeleton_club),
        },
        "annotations": annotations,
        "muscleGroups": [
            {**g, "muscles": [n for n in muscle_names if g["match"](n)]} for g in cfg["muscle_groups"]
        ],
    }
    for group in bundle["muscleGroups"]:
        del group["match"]

    # The footage the reconstruction was made from, trimmed to the same window so frame n is frame n.
    video = cfg.get("source_video")
    if video:
        original = os.environ.get("GOLF_SOURCE_VIDEO")
        if original:
            encode_source_video(Path(original), video["file"], start, end, video["crop"], video["width"])
        if video["file"].exists():
            bundle["sourceVideo"] = {"url": video["url"], "label": video["label"], "aspect": video["aspect"]}

    (mesh_dir / "swing-analysis.json").write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))
    head_err_m = np.linalg.norm(np.array(mesh_club[impact - start][3:]) - mesh_ball)
    head_err_s = np.linalg.norm(np.array(skeleton_club[impact - start][3:]) - os_ball)
    print(f"{cfg['name']}: {len(hand_vertices)} hand vertices, head→ball at impact {head_err_m:.3f} / {head_err_s:.3f} m, "
          f"scale {scale_to_surface:.3f}, right shoulder carried up to {shoulder_slack * 100:.1f} cm, mesh {(mesh_dir / 'swing-mesh.bin').stat().st_size / 1e6:.2f} MB, "
          f"json {(mesh_dir / 'swing-analysis.json').stat().st_size / 1e6:.2f} MB")


def encode_source_video(original: Path, target: Path, start: int, end: int, crop: str, width: int) -> None:
    """Trim the capture's footage to the swing window for frame-accurate scrubbing.

    Every frame is a keyframe, so the viewer can seek to any frame as the playhead moves. Audio,
    location and device metadata are dropped.
    """
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y", "-i", str(original),
            "-vf", f"trim=start_frame={start}:end_frame={end + 1},setpts=PTS-STARTPTS,crop={crop},scale={width}:-2",
            "-map", "0:v:0", "-an", "-map_metadata", "-1", "-map_chapters", "-1",
            "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-g", "1", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(target),
        ],
        check=True,
    )


# --------------------------------------------------------------------------- measured metrics
def measure_1872(motion_path: Path, address: range, top: int, impact: int, backswing: range) -> dict:
    frames = json.loads(motion_path.read_text())["frames"]
    deg = lambda k, i: float(np.degrees(frames[i]["coordinates"][k]))  # noqa: E731
    mean = lambda k: float(np.mean([deg(k, i) for i in address]))  # noqa: E731
    pel = np.array([f["bodies"]["pelvis"]["p"] for f in frames])
    hand = np.array([f["bodies"]["hand_l"]["p"] for f in frames])
    base = pel[list(address)].mean(0)
    fwd = unit((hand[list(address)].mean(0) - base) * [1, 0, 1])
    target = -np.cross(fwd, [0, 1, 0])
    toward_target = (pel - base) @ target * 100
    all_frames = range(len(frames))
    coil = np.array([deg("lumbar_rotation", i) - mean("lumbar_rotation") for i in all_frames])
    return {
        # Whole-capture traces of the same quantities the findings quote.
        "series": {
            "sway": toward_target,
            "trail-knee": np.array([deg("knee_angle_r", i) for i in all_frames]),
            "lead-arm": np.array([deg("elbow_flex_l", i) for i in all_frames]),
            "separation": coil * np.sign(coil[top]),
        },
        "knee_addr": mean("knee_angle_r"),
        "knee_min": min(deg("knee_angle_r", i) for i in backswing),
        "elbow_addr": mean("elbow_flex_l"),
        "elbow_top": deg("elbow_flex_l", top),
        "sway_cm": -min(toward_target[i] for i in backswing),
        "impact_cm": float(toward_target[impact]),
        "pelvis_turn": abs(deg("pelvis_rotation", top) - mean("pelvis_rotation")),
        "separation": abs(deg("lumbar_rotation", top) - mean("lumbar_rotation")),
        "drop_cm": float((base[1] - min(pel[i, 1] for i in range(top, impact + 1))) * 100),
    }


def config_1872() -> dict:
    mesh_dir = PUBLIC / "viewer-data" / "golf-1872"
    motion = mesh_dir / "opensim" / "opensim-motion.json"
    m = measure_1872(motion, range(0, 45), top=94, impact=108, backswing=range(48, 98))
    print("golf-1872 metrics:", {k: round(v, 1) for k, v in m.items() if k != "series"})
    traces = m["series"]
    # Each finding freezes on the frame where its own trace is most extreme.
    sway_hold = 62 + int(np.argmin(traces["sway"][62:80]))
    knee_hold = 80 + int(np.argmin(traces["trail-knee"][80:92]))
    right_hip = lambda n: n.startswith(("glmed", "glmin")) and n.endswith("_r")  # noqa: E731
    left_drive = lambda n: n.startswith(("glmax", "addmag", "addlong", "addbrev")) and n.endswith("_l")  # noqa: E731
    return {
        "name": "golf-1872",
        "fps": 60,
        "start": 30,
        "end": 126,
        "impact": 108,
        "impact_sigma": 2.0,
        "club_smoothing_s": 0.04,
        "downswing": (96, 116),
        "address_frame": 30,
        "address_range": (0, 45),
        "club_length": 0.9,
        "mesh_dir": mesh_dir,
        "motion": motion,
        "faces_url": "/viewer-data/golf-1872/soma-faces.bin",
        "swing_mesh_url": "/viewer-data/golf-1872/swing-mesh.bin",
        # The hands are posed around the club: fingers curled in a baked copy of the bone model.
        "grip": True,
        "bones_source": mesh_dir / "opensim" / "rajagopal-bones.glb",
        "bones_baked": mesh_dir / "opensim" / "rajagopal-bones-grip.glb",
        "bones_url": "/viewer-data/golf-1872/opensim/rajagopal-bones-grip.glb",
        # Re-encode with GOLF_SOURCE_VIDEO=<path to the 1080×1920 60 fps clip>; the crop keeps the player and club.
        "source_video": {
            "file": mesh_dir / "source-swing.mp4",
            "url": "/viewer-data/golf-1872/source-swing.mp4",
            "label": "Source video",
            "crop": "1080:1520:0:60",
            "width": 432,
            "aspect": round(1080 / 1520, 4),
        },
        "phases": [
            {"id": "address", "label": "Address", "start": 30, "end": 47},
            {"id": "backswing", "label": "Backswing", "start": 48, "end": 91},
            {"id": "top", "label": "Top", "start": 92, "end": 97},
            {"id": "downswing", "label": "Downswing", "start": 98, "end": 106},
            {"id": "impact", "label": "Impact", "start": 107, "end": 109},
            {"id": "follow", "label": "Follow", "start": 110, "end": 118},
            {"id": "finish", "label": "Finish", "start": 119, "end": 126},
        ],
        "annotations": [
            {
                "id": "sway",
                "title": "Sliding off the ball",
                # Five parts per finding. "detail" is the measurement only; the advice lives in cue and drill.
                "detail": f"On the way back your hips slide about {m['sway_cm']:.0f} cm away from the target instead of turning in place.",
                "start": 62, "end": 79, "anchor": "pelvis", "group": "trail-hip",
                # What the close-up lights up, and where it stands: degrees from face-on, positive toward the lead side.
                "bones": ["pelvis", "femur_r"], "viewYaw": -35,
                "series": "sway", "hold": sway_hold,
                "metric": {"value": f"{m['sway_cm']:.0f} cm", "caption": "hip slide away from the target"},
                "why": "The low point of your swing moves back with your hips. To strike the ball first you have to slide forward by the same amount, at full speed. Miss that timing and you hit the ground early or catch the ball thin.",
                "cue": "Turn your right hip pocket straight back. Keep the pressure on the inside of your right foot.",
                "drill": "Wall drill. Set up with your right hip a hand's width from a wall or an upright alignment stick. Make ten slow backswings without touching it, then ten half shots with the same feel.",
                "check": f"The hip trace stays on the address line through the backswing, not {m['sway_cm']:.0f} cm behind it.",
                "goal": {"value": 0.0, "label": "address line"},
            },
            {
                "id": "trail-knee",
                "title": "Right knee locks out",
                "detail": f"Your right knee straightens from {m['knee_addr']:.0f}° at address to about {m['knee_min']:.0f}° before the top of the backswing.",
                "start": 80, "end": 91, "anchor": "tibia_r", "group": "trail-hip",
                "bones": ["femur_r", "tibia_r", "patella_r"], "viewYaw": -60,
                "series": "trail-knee", "hold": knee_hold,
                "metric": {"value": f"{m['knee_addr']:.0f}° → {m['knee_min']:.0f}°", "caption": "right knee flex, address to backswing"},
                "why": "Your hips turn against the right leg. Once the knee locks, the hip rides up, the turn stops loading, and the downswing tends to start from the arms instead of the ground.",
                "cue": "Hold the knee flex you set at address all the way to the top. The right thigh should feel loaded.",
                "drill": "Pause drill. Swing to the top in three counts and hold for two. Look down: the right knee is still bent. Ten holds, then ten shots with a one-count pause at the top.",
                "check": f"Right knee flex stays close to {m['knee_addr']:.0f}° to the top of the backswing instead of dropping to {m['knee_min']:.0f}°.",
                "goal": {"value": round(m["knee_addr"], 1), "label": "address flex"},
            },
            {
                "id": "lead-arm",
                "title": "Left arm collapses",
                "detail": f"Your left arm bends from {m['elbow_addr']:.0f}° at address to about {m['elbow_top']:.0f}° at the top of the backswing.",
                "start": 92, "end": 101, "anchor": "ulna_l", "group": None,
                # No upper-body muscles in this model: the arm is highlighted on the bones only.
                "bones": ["humerus_l", "ulna_l", "radius_l"], "viewYaw": 0,
                "series": "lead-arm", "hold": 94,
                "metric": {"value": f"{m['elbow_top']:.0f}°", "caption": "left arm bend at the top"},
                "why": "The left arm sets the radius of your swing. When it folds, the club travels a shorter arc and has to be straightened again on the way down, which costs speed and makes contact harder to repeat.",
                "cue": "Reach your left hand away from your chest as you turn. End the backswing when the arm wants to fold.",
                "drill": "Three-quarter swings. Hit ten shots stopping the backswing when your left arm is level with the ground, arm long. Lengthen only as far as your shoulder turn carries it.",
                "check": f"Left arm bend at the top stays near {m['elbow_addr']:.0f}° instead of reaching {m['elbow_top']:.0f}°.",
                "goal": {"value": round(m["elbow_addr"], 1), "label": "address bend"},
            },
            {
                "id": "hang-back",
                "title": "Stuck on the back foot",
                "detail": f"At impact your hips are still where they stood at address: {m['impact_cm']:.0f} cm toward the target.",
                "start": 103, "end": 114, "anchor": "pelvis", "group": "lead-hip",
                "bones": ["pelvis", "femur_l"], "viewYaw": 140,
                "series": "sway", "hold": 108,
                "metric": {"value": f"{m['impact_cm']:.0f} cm", "caption": "hip shift toward the target at impact"},
                "why": "Weight that stays back puts the bottom of the swing behind the ball. The club meets the turf first or catches the ball on the way up: heavy and thin strikes, and less distance.",
                "cue": "Start down with your left hip moving toward the target. The arms follow.",
                "drill": "Step-through drill. Swing through and let your right foot step past the ball toward the target. Ten reps, then ten shots keeping that feel with both feet planted.",
                "check": "The hip trace is ahead of the address line at impact, not level with it.",
                "goal": {"value": 0.0, "label": "address line"},
            },
        ],
        "highlights": [
            f"Great coil: your shoulders turn about {m['separation']:.0f}° more than your hips.",
            f"You stay in your posture. Your hips only drop about {m['drop_cm']:.0f} cm coming down.",
            "No early extension. Your hips don't thrust toward the ball.",
        ],
        "series": [
            {"id": "sway", "label": "Hip shift toward target", "unit": "cm", "values": traces["sway"]},
            {"id": "trail-knee", "label": "Right knee flex", "unit": "°", "values": traces["trail-knee"]},
            {"id": "lead-arm", "label": "Left arm bend", "unit": "°", "values": traces["lead-arm"]},
            {"id": "separation", "label": "Shoulder–hip separation", "unit": "°", "values": traces["separation"]},
        ],
        "muscle_groups": [
            {
                "id": "trail-hip", "label": "Right glute medius · minimus", "color": "#ff6b5a",
                "role": "Helps you turn into your right hip instead of sliding off it", "match": right_hip,
            },
            {
                "id": "lead-hip", "label": "Left glute max · adductors", "color": "#f2a93b",
                "role": "Pushes you onto your front foot and finishes the turn", "match": left_drive,
            },
        ],
        "disclosure": {
            "badge": "Preview measurement · 60 fps",
            "club": "Estimated club: derived from hand pose and eased onto the ball at impact. The grip is posed around it; fingers and wrist roll are not measured. Not club tracking.",
            "coaching": "Preview reconstruction from a single 60 fps phone video (mean marker error 2.3 cm), not lab-calibrated. Muscle suggestions are inferred from the detected faults, not measured with EMG; muscle shapes are drawn around the model's muscle paths, not scanned. Cues and drills are general coaching for each fault, not a personal programme.",
        },
    }


def config_legacy() -> dict:
    mesh_dir = PUBLIC / "viewer-data" / "golf"
    return {
        "name": "golf-legacy",
        "fps": 24, "start": 372, "end": 440, "impact": 404, "impact_sigma": 1.2, "club_smoothing_s": 0.04,
        "downswing": (392, 410), "address_frame": 376, "address_range": (312, 372),
        "club_length": 0.97,
        "mesh_dir": mesh_dir,
        "motion": PUBLIC / "viewers" / "kinetic" / "sessions" / LEGACY_SESSION / "assets" / "model" / "opensim-motion.json",
        "faces_url": "/viewer-data/golf/soma-faces.bin",
        "swing_mesh_url": "/viewer-data/golf/swing-mesh.bin",
        "bones_url": f"/viewers/kinetic/sessions/{LEGACY_SESSION}/assets/model/rajagopal-bones.glb",
        "phases": [
            {"id": "address", "label": "Address", "start": 372, "end": 384},
            {"id": "backswing", "label": "Backswing", "start": 385, "end": 396},
            {"id": "top", "label": "Top", "start": 397, "end": 401},
            {"id": "downswing", "label": "Downswing", "start": 402, "end": 403},
            {"id": "impact", "label": "Impact", "start": 404, "end": 404},
            {"id": "follow", "label": "Follow", "start": 405, "end": 409},
            {"id": "finish", "label": "Finish", "start": 410, "end": 440},
        ],
        "annotations": [
            {"id": "trail-knee", "title": "Trail knee straightens", "detail": "Right-knee flexion drops from about 17° to 8° in the backswing, limiting hip turn.",
             "start": 386, "end": 395, "anchor": "tibia_r", "group": "hip-rotators"},
            {"id": "lead-arm", "title": "Lead arm bends", "detail": "Left-elbow flexion reaches about 65° at the top, shortening the arc. Upper-body muscles are not in this model.",
             "start": 396, "end": 402, "anchor": "ulna_l", "group": None},
            {"id": "early-extension", "title": "Early extension", "detail": "The pelvis moves about 7 cm toward the ball after impact, losing spine angle.",
             "start": 403, "end": 414, "anchor": "pelvis", "group": "hip-extensors"},
        ],
        "muscle_groups": [
            {"id": "hip-extensors", "label": "Glute max · hamstrings", "color": "#f2a93b", "role": "Hip extension to hold posture through the downswing",
             "match": lambda n: n.startswith(("glmax", "bflh", "semiten", "semimem"))},
            {"id": "hip-rotators", "label": "Right piriformis · glute medius", "color": "#ff6b5a", "role": "Hip rotation and stability to hold the trail knee",
             "match": lambda n: n.startswith(("piri", "glmed")) and n.endswith("_r")},
        ],
        "disclosure": {
            "badge": "Illustrative interface",
            "club": "Estimated club: derived from hand pose, held by both hands and eased onto the ball at impact. Not club tracking.",
            "coaching": "Illustrative interface: findings and muscle suggestions demonstrate the product, not a diagnosis of this player. Preview reconstruction from a single 24 fps video, not calibrated.",
        },
    }


CONFIGS = {"golf-1872": config_1872, "golf-legacy": config_legacy}

if __name__ == "__main__":
    names = sys.argv[1:] or list(CONFIGS)
    for name in names:
        build(CONFIGS[name]())
