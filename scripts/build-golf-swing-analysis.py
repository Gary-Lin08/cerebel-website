"""Build a Golf swing-analysis bundle for the homepage motion chapter.

    python3 scripts/build-golf-swing-analysis.py golf-1872    # team capture, measured findings
    python3 scripts/build-golf-swing-analysis.py golf-legacy  # third-party footage, illustrative

Inputs per session: a GENMO surface sequence (soma-metadata.json + soma-vertices.bin) and an
OpenSim motion (opensim-motion.json + rajagopal-bones.glb). Outputs next to the surface:
  swing-mesh.bin        int16-quantised vertices for the swing window
  swing-analysis.json   club, ball, skeleton, muscles, annotations

No capture contains a club. The club is estimated from hand pose, held by both hands (the
skeleton's right arm is solved onto the grip), and eased onto the ball at impact. Facing and
target directions are measured from each capture rather than assumed.
"""

import json
import sys
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

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
        mesh_club.append(np.concatenate([grip, head]))

    lo, hi = window.reshape(-1, 3).min(0), window.reshape(-1, 3).max(0)
    q_scale = (hi - lo) / 65535.0
    np.round((window - lo) / q_scale - 32768).astype(np.int16).tofile(mesh_dir / "swing-mesh.bin")

    def solve_right_arm(grip: np.ndarray, shaft: np.ndarray, poses: dict):
        """Two-bone IK: put the right wrist on the shaft just below the lead hand."""
        shoulder, humerus_q = poses["humerus_r"]
        elbow, ulna_q = poses["ulna_r"]
        radius_p, radius_q = poses["radius_r"]
        wrist, hand_q = poses["hand_r"]
        upper, fore = np.linalg.norm(elbow - shoulder), np.linalg.norm(wrist - elbow)
        target = grip + shaft * 0.09
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
    for frame, smooth_dir in zip(range(start, end + 1), skeleton_dirs):
        poses = {name: body(frame, name) for name in body_names}
        grip, _ = poses["hand_l"]
        direction = eased_direction(smooth_dir, unit(os_ball - grip), impact_weight(frame))
        solve_right_arm(grip, direction, poses)
        head = grip + os_club_length * direction
        head[1] = max(head[1], os_ground + 0.004)
        skeleton_club.append(np.concatenate([grip, head]))
        skeleton_frames.append([round(float(v), 4) for name in body_names for v in (*poses[name][0], *poses[name][1].as_quat())])
        muscle_frames.append([[[round(float(c), 4) for c in point] for point in m["points"]] for m in frames[frame]["muscles"]])
    muscle_names = [m["name"] for m in frames[start]["muscles"]]

    # Map OpenSim's (forward, up, right) basis onto the surface's so both figures face alike.
    to_surface = np.column_stack([s_forward, s_up, s_right]) @ np.column_stack([o_forward, o_up, o_right]).T

    local = lambda f: f - start  # noqa: E731
    phases = [{**p, "start": local(p["start"]), "end": local(p["end"])} for p in cfg["phases"]]
    annotations = [{**a, "start": local(a["start"]), "end": local(a["end"])} for a in cfg["annotations"]]

    bundle = {
        "format": "cerebel-swing-analysis-v1",
        "fps": fps,
        "sourceStartFrame": start,
        "frameCount": end - start + 1,
        "impactIndex": impact - start,
        "phases": phases,
        "disclosure": cfg["disclosure"],
        "highlights": cfg.get("highlights", []),
        "surface": {
            "label": "GENMO 表面重建",
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
            "label": "OpenSim 骨骼与肌群",
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

    (mesh_dir / "swing-analysis.json").write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))
    head_err_m = np.linalg.norm(np.array(mesh_club[impact - start][3:]) - mesh_ball)
    head_err_s = np.linalg.norm(np.array(skeleton_club[impact - start][3:]) - os_ball)
    print(f"{cfg['name']}: {len(hand_vertices)} hand vertices, head→ball at impact {head_err_m:.3f} / {head_err_s:.3f} m, "
          f"scale {scale_to_surface:.3f}, mesh {(mesh_dir / 'swing-mesh.bin').stat().st_size / 1e6:.2f} MB, "
          f"json {(mesh_dir / 'swing-analysis.json').stat().st_size / 1e6:.2f} MB")


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
    return {
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
    print("golf-1872 metrics:", {k: round(v, 1) for k, v in m.items()})
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
        "bones_url": "/viewer-data/golf-1872/opensim/rajagopal-bones.glb",
        "phases": [
            {"id": "address", "label": "准备", "start": 30, "end": 47},
            {"id": "backswing", "label": "上杆", "start": 48, "end": 91},
            {"id": "top", "label": "顶点", "start": 92, "end": 97},
            {"id": "downswing", "label": "下杆", "start": 98, "end": 106},
            {"id": "impact", "label": "击球", "start": 107, "end": 109},
            {"id": "follow", "label": "送杆", "start": 110, "end": 118},
            {"id": "finish", "label": "收杆", "start": 119, "end": 126},
        ],
        "annotations": [
            {
                "id": "sway",
                "title": "上杆骨盆侧移",
                "detail": f"上杆时骨盆向远离目标的方向移动约 {m['sway_cm']:.0f}cm，重心偏到右脚外侧。",
                "start": 62, "end": 79, "anchor": "pelvis", "group": "trail-hip",
            },
            {
                "id": "trail-knee",
                "title": "右膝伸直",
                "detail": f"右膝屈曲从 {m['knee_addr']:.0f}° 减到约 {m['knee_min']:.0f}°，右髋失去支撑。",
                "start": 80, "end": 91, "anchor": "tibia_r", "group": "trail-hip",
            },
            {
                "id": "lead-arm",
                "title": "前导臂弯曲",
                "detail": f"顶点时左肘屈曲约 {m['elbow_top']:.0f}°（准备时 {m['elbow_addr']:.0f}°），挥杆半径变短。上肢肌群不在该模型内。",
                "start": 92, "end": 101, "anchor": "ulna_l", "group": None,
            },
            {
                "id": "hang-back",
                "title": "重心未转到前脚",
                "detail": (
                    f"击球时骨盆只回到准备位置附近（向目标方向 {m['impact_cm']:+.0f}cm），重心没有转移到前脚。"
                ),
                "start": 103, "end": 114, "anchor": "pelvis", "group": "lead-hip",
            },
        ],
        "highlights": [
            f"肩髋分离约 {m['separation']:.0f}°，骨盆转动约 {m['pelvis_turn']:.0f}°",
            f"下杆时骨盆只下降约 {m['drop_cm']:.0f}cm，身体角度保持稳定",
            "下杆过程中骨盆没有提前前移",
        ],
        "muscle_groups": [
            {
                "id": "trail-hip", "label": "右侧臀中肌 · 臀小肌", "color": "#ff6b5a",
                "role": "稳住右髋，减少上杆侧移并保持右膝角度", "match": right_hip,
            },
            {
                "id": "lead-hip", "label": "左侧臀大肌 · 内收肌", "color": "#f2a93b",
                "role": "下杆时把重心推向前脚并完成转动", "match": left_drive,
            },
        ],
        "disclosure": {
            "badge": "预览测量 · 60fps",
            "club": "推算球杆：由手部姿态推导，双手握杆约束及击球时刻经平滑处理，非球杆追踪。",
            "coaching": "基于单目 60fps 视频的预览重建（OpenSim IK 标记误差平均 2.3cm），数值未经实验室校准；肌群建议由检测到的动作问题推断，并非肌电测量。",
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
            {"id": "address", "label": "准备", "start": 372, "end": 384},
            {"id": "backswing", "label": "上杆", "start": 385, "end": 396},
            {"id": "top", "label": "顶点", "start": 397, "end": 401},
            {"id": "downswing", "label": "下杆", "start": 402, "end": 403},
            {"id": "impact", "label": "击球", "start": 404, "end": 404},
            {"id": "follow", "label": "送杆", "start": 405, "end": 409},
            {"id": "finish", "label": "收杆", "start": 410, "end": 440},
        ],
        "annotations": [
            {"id": "trail-knee", "title": "右膝伸直", "detail": "上杆时右膝屈曲约从 17° 减到 8°，髋部转动空间被压缩。",
             "start": 386, "end": 395, "anchor": "tibia_r", "group": "hip-rotators"},
            {"id": "lead-arm", "title": "前导臂弯曲", "detail": "顶点时左肘屈曲约 65°，挥杆半径变短。上肢肌群不在该模型内。",
             "start": 396, "end": 402, "anchor": "ulna_l", "group": None},
            {"id": "early-extension", "title": "骨盆提前前移", "detail": "击球后骨盆向球的方向前移约 7cm，脊柱角度难以保持。",
             "start": 403, "end": 414, "anchor": "pelvis", "group": "hip-extensors"},
        ],
        "muscle_groups": [
            {"id": "hip-extensors", "label": "臀大肌 · 腘绳肌", "color": "#f2a93b", "role": "髋伸展，保持下杆时的身体角度",
             "match": lambda n: n.startswith(("glmax", "bflh", "semiten", "semimem"))},
            {"id": "hip-rotators", "label": "右侧梨状肌 · 臀中肌", "color": "#ff6b5a", "role": "髋旋转与稳定，守住上杆时的右膝角度",
             "match": lambda n: n.startswith(("piri", "glmed")) and n.endswith("_r")},
        ],
        "disclosure": {
            "badge": "产品界面示意",
            "club": "推算球杆：由手部姿态推导，双手握杆约束及击球时刻经平滑处理，非球杆追踪。",
            "coaching": "产品界面示意：动作问题与肌群建议用于展示分析界面，并非对该球员的诊断。数据来自单目视频的预览重建（24fps，未经校准）。",
        },
    }


CONFIGS = {"golf-1872": config_1872, "golf-legacy": config_legacy}

if __name__ == "__main__":
    names = sys.argv[1:] or list(CONFIGS)
    for name in names:
        build(CONFIGS[name]())
