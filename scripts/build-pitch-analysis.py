"""Build the Baseball pitch-analysis bundle for the homepage motion chapter.

    python3 scripts/build-pitch-analysis.py

Inputs: the Baseball surface sequence (public/viewer-data/baseball/soma-*) and its OpenSim motion
(the joint-motion session's opensim-motion.json). Outputs next to the surface:
  motion-mesh.bin        int16-quantised vertices for the pitch window
  motion-analysis.json   same bundle format as the golf swing analysis, without a club or a ball

The clip is third-party footage at 24 fps, filmed from above. Every number below is read from its
reconstruction, but the page must present the result as an illustrative interface, not as a
diagnosis of this pitcher. One overhead camera cannot measure height, so each frame is re-seated
on flat ground by its lowest foot; the mound's slope is lost.
"""

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SESSION = "BB6037F3-37EC-4876-ACEE-282061ECB537"
MESH_DIR = PUBLIC / "viewer-data" / "baseball"
MODEL_DIR = PUBLIC / "viewers" / "kinetic" / "sessions" / SESSION / "assets" / "model"

FPS = 24
# The first of the clip's two deliveries, in source frames.
START, END = 88, 150
SET = range(60, 92)       # standing still before the leg lift
LIFT, LANDING, RELEASE = 114, 130, 138
FEET = ("calcn_l", "calcn_r", "toes_l", "toes_r")


def unit(v: np.ndarray) -> np.ndarray:
    return v / np.linalg.norm(v)


def smooth(values: np.ndarray, sigma: float) -> np.ndarray:
    radius = int(np.ceil(3 * sigma))
    offsets = np.arange(-radius, radius + 1)
    kernel = np.exp(-0.5 * (offsets / sigma) ** 2)
    kernel /= kernel.sum()
    return np.convolve(np.pad(values, radius, mode="edge"), kernel, mode="valid")


def rounded(rows):
    return [[round(float(v), 4) for v in row] for row in rows]


def main() -> None:
    # ----------------------------------------------------------------------- surface
    meta = json.loads((MESH_DIR / "soma-metadata.json").read_text())
    count, vertex_count = meta["frameCount"], meta["vertexCount"]
    vertices = np.fromfile(MESH_DIR / "soma-vertices.bin", dtype=np.float32).reshape(count, vertex_count, 3).copy()
    centroid = vertices.mean(1)
    # Re-seat every frame on the ground by its lowest point.
    vertices[:, :, 2] -= smooth(vertices[:, :, 2].min(1), 1.0)[:, None]

    # ----------------------------------------------------------------------- skeleton
    motion = json.loads((MODEL_DIR / "opensim-motion.json").read_text())
    frames = motion["frames"]
    body_names = motion["bodyNames"]
    assert len(frames) == count, "surface and skeleton must cover the same frames"

    def position(name: str) -> np.ndarray:
        return np.array([f["bodies"][name]["p"] for f in frames])

    def degrees(key: str) -> np.ndarray:
        return np.degrees(np.array([f["coordinates"][key] for f in frames]))

    pelvis = position("pelvis")
    lift = smooth(np.min([position(name)[:, 1] for name in FEET], axis=0), 1.0)

    hand_speed = {side: np.linalg.norm(np.diff(position(f"hand_{side}")[START:END + 1], axis=0), axis=1).max() * FPS for side in "lr"}
    assert hand_speed["r"] > hand_speed["l"], "this build assumes the measured throwing hand is the right"

    # Yaw and scale between the two reconstructions, fitted on the whole clip's path over the ground.
    # OpenSim is Y-up, the surface is Z-up: (x, y, z) → (x, -z, y), then a turn about the vertical.
    a = centroid[:, :2] - centroid[:, :2].mean(0)
    b = np.c_[pelvis[:, 0], -pelvis[:, 2]]
    b = b - b.mean(0)
    za, zb = a[:, 0] + 1j * a[:, 1], b[:, 0] + 1j * b[:, 1]
    k = (za * np.conj(zb)).sum() / (np.abs(zb) ** 2).sum()
    residual = float(np.abs(za - k * zb).mean())
    yaw, scale_to_surface = float(np.angle(k)), float(np.abs(k))
    turn = np.array([[np.cos(yaw), -np.sin(yaw), 0], [np.sin(yaw), np.cos(yaw), 0], [0, 0, 1]])
    to_surface = turn @ np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])

    # Directions are measured: the plate is where the pelvis travels, the chest is where the pelvis faces at the set.
    set_pelvis = pelvis[list(SET)].mean(0)
    o_target = (pelvis[RELEASE] - set_pelvis) * [1, 0, 1]
    o_target = unit(o_target)
    facing = np.mean([_rotate(frames[i]["bodies"]["pelvis"]["q"], [1, 0, 0]) for i in SET], axis=0) * [1, 0, 1]
    o_forward = unit(facing)
    s_forward, s_target = to_surface @ o_forward, to_surface @ o_target

    # ----------------------------------------------------------------------- measurements
    knee_front, knee_back = degrees("knee_angle_l"), degrees("knee_angle_r")
    lumbar = degrees("lumbar_rotation")
    separation = lumbar[list(SET)].mean() - lumbar           # positive while the hips lead the shoulders
    stride = (pelvis - set_pelvis) @ o_target * 100
    brace = range(LANDING, RELEASE + 1)
    feet = position("calcn_l")[LANDING + 1] - position("calcn_r")[LANDING + 1]
    m = {
        "back_knee_landing": float(knee_back[LANDING]),
        "front_knee_landing": float(knee_front[LANDING]),
        "front_knee_max": float(knee_front[list(brace)].max()),
        "front_knee_max_frame": int(LANDING + np.argmax(knee_front[list(brace)])),
        "separation": float(separation[LANDING - 2:LANDING + 5].max()),
        "separation_frame": int(LANDING - 2 + np.argmax(separation[LANDING - 2:LANDING + 5])),
        "leg_lift": float(degrees("hip_flexion_l")[START:LANDING].max()),
        "stride_ratio": float(np.hypot(feet[0], feet[2]) / (motion["metadata"]["subjectHeightCm"] / 100)),
    }
    print("baseball metrics:", {key: round(value, 1) if isinstance(value, float) else value for key, value in m.items()})

    # ----------------------------------------------------------------------- window
    window = vertices[START:END + 1]
    lo, hi = window.reshape(-1, 3).min(0), window.reshape(-1, 3).max(0)
    q_scale = (hi - lo) / 65535.0
    np.round((window - lo) / q_scale - 32768).astype(np.int16).tofile(MESH_DIR / "motion-mesh.bin")

    # The fastest vertices into release are the throwing hand; their centre draws the hand path.
    peak = np.linalg.norm(np.diff(vertices[LANDING:RELEASE + 3], axis=0), axis=2).max(0)
    hand_vertices = np.where(peak > np.percentile(peak, 97))[0]
    surface_trail = window[:, hand_vertices].mean(1)

    skeleton_frames, muscle_frames, skeleton_trail = [], [], []
    for index in range(START, END + 1):
        drop = np.array([0.0, lift[index], 0.0])
        bodies = frames[index]["bodies"]
        skeleton_frames.append([
            round(float(v), 4) for name in body_names for v in (*(np.array(bodies[name]["p"]) - drop), *bodies[name]["q"])
        ])
        muscle_frames.append([
            [[round(float(c), 4) for c in np.array(point) - drop] for point in muscle["points"]]
            for muscle in frames[index]["muscles"]
        ])
        skeleton_trail.append(np.array(bodies["hand_r"]["p"]) - drop)
    muscle_names = [muscle["name"] for muscle in frames[START]["muscles"]]

    local = lambda frame: frame - START  # noqa: E731
    reference = window[0]
    mid = centroid[START] + 0.2 * (centroid[RELEASE] - centroid[START])

    def group(label_match):
        return [name for name in muscle_names if label_match(name)]

    bundle = {
        "format": "cerebel-swing-analysis-v1",
        "fps": FPS,
        "sourceStartFrame": START,
        "frameCount": END - START + 1,
        "impactIndex": local(RELEASE),
        "stageLabel": (
            "Baseball pitch replay. A particle surface reconstruction delivers a pitch and leaves its earlier poses "
            "behind as exposures; beside it, a close-up of the skeleton and muscles follows each finding."
        ),
        "trailLabel": "Throwing-hand path",
        "exposures": [local(START + 4), local(LIFT), local(LANDING)],
        "phases": [
            {"id": "set", "label": "Set", "start": local(START), "end": local(97)},
            {"id": "lift", "label": "Leg lift", "start": local(98), "end": local(116)},
            {"id": "stride", "label": "Stride", "start": local(117), "end": local(LANDING - 1)},
            {"id": "landing", "label": "Landing", "start": local(LANDING), "end": local(133)},
            {"id": "release", "label": "Release", "start": local(134), "end": local(RELEASE + 1)},
            {"id": "follow", "label": "Follow-through", "start": local(RELEASE + 2), "end": local(END)},
        ],
        "disclosure": {
            "badge": "Illustrative interface · 24 fps",
            "club": "Throwing-hand path: traced from the reconstructed hand. The ball is not tracked.",
            "coaching": (
                "Illustrative interface: the findings and muscle suggestions show the product on a third-party clip; "
                "they are not a diagnosis of this pitcher. Preview reconstruction from a single 24 fps video filmed "
                "from above, not calibrated. One camera cannot measure height, so each frame is re-seated on flat "
                "ground. Muscle shapes are drawn around the model's muscle paths, not scanned. Cues and drills are "
                "general coaching for each fault."
            ),
        },
        "highlights": [
            f"A tall, balanced leg lift: your front hip flexes to about {m['leg_lift']:.0f}°.",
            f"A long stride: your feet land about {m['stride_ratio'] * 100:.0f}% of your height apart.",
        ],
        "series": [
            {"id": "stride", "label": "Travel toward the plate", "unit": "cm", "values": stride},
            {"id": "back-knee", "label": "Back knee flex", "unit": "°", "values": knee_back},
            {"id": "separation", "label": "Hip–shoulder separation", "unit": "°", "values": separation},
            {"id": "front-knee", "label": "Front knee flex", "unit": "°", "values": knee_front},
        ],
        "surface": {
            "label": "Body surface",
            "vertexCount": vertex_count,
            "facesUrl": "/viewer-data/baseball/soma-faces.bin",
            "verticesUrl": "/viewer-data/baseball/motion-mesh.bin",
            "quantisation": {"offset": [float(v) for v in lo], "scale": [float(v) for v in q_scale]},
            "ground": 0.0,
            "height": round(float(reference[:, 2].max()), 4),
            "forward": [round(float(v), 4) for v in s_forward],
            "target": [round(float(v), 4) for v in s_target],
            # The pitcher travels down the mound: centre the stage near the set so the delivery runs
            # across it, clear of the caption card.
            "center": [round(float(mid[0]), 4), round(float(mid[1]), 4)],
            "trail": rounded(surface_trail),
        },
        "skeleton": {
            "label": "Skeleton + muscles",
            "boneModelUrl": f"/viewers/kinetic/sessions/{SESSION}/assets/model/rajagopal-bones.glb",
            "toSurfaceAxes": [[round(float(v), 5) for v in row] for row in to_surface],
            "scaleToSurface": round(scale_to_surface, 4),
            "ground": -0.02,
            "target": [round(float(v), 4) for v in o_target],
            "up": [0, 1, 0],
            "bodyNames": body_names,
            "frames": skeleton_frames,
            "muscleNames": muscle_names,
            "muscles": muscle_frames,
            "trail": rounded(skeleton_trail),
        },
        "annotations": [
            {
                "id": "back-leg",
                "title": "Back leg stays bent",
                "detail": f"As you stride, your back knee bends to about {m['back_knee_landing']:.0f}° and is still bent when the front foot lands.",
                "start": local(122), "end": local(LANDING - 1), "hold": local(LANDING - 2),
                "anchor": "tibia_r", "group": "drive-leg",
                "bones": ["femur_r", "tibia_r", "patella_r"], "viewYaw": -30,
                "series": "back-knee",
                "metric": {"value": f"{m['back_knee_landing']:.0f}°", "caption": "back knee flex at landing"},
                "why": "The back leg is what pushes you off the rubber. If it is still folded at landing, the push has not finished, and the hips arrive with less speed to pass on.",
                "cue": "Push the rubber away. Feel the back leg straighten before the front foot touches down.",
                "drill": "Rocker drill. Set your feet in the landing position, rock back onto the back leg, then drive off it and throw at half effort. Ten reps.",
                "check": f"Back knee flex is falling in the frames before landing instead of holding near {m['back_knee_landing']:.0f}°.",
            },
            {
                "id": "separation",
                "title": "Hips and shoulders turn together",
                "detail": f"At landing your hips are about {m['separation']:.0f}° ahead of your shoulders.",
                "start": local(LANDING), "end": local(133), "hold": local(m["separation_frame"]),
                # No trunk muscles in this model: the finding is shown on the bones only.
                "anchor": "pelvis", "group": None,
                "bones": ["pelvis", "torso"], "viewYaw": 0,
                "series": "separation",
                "metric": {"value": f"{m['separation']:.0f}°", "caption": "hips ahead of shoulders at landing"},
                "why": "The stretch between open hips and closed shoulders is what whips the trunk around. With little of it, the arm has to make up the speed.",
                "cue": "Let the belt buckle turn to the plate while the chest still faces the side.",
                "drill": "Hip-lead throws. From a narrow stance, start the hips, hold the shoulders closed for one beat, then throw at half effort. Ten reps.",
                "check": f"Separation at landing grows beyond {m['separation']:.0f}°.",
            },
            {
                "id": "front-knee",
                "title": "Front knee gives after landing",
                "detail": f"Your front knee lands at {m['front_knee_landing']:.0f}° and keeps bending to about {m['front_knee_max']:.0f}° before release.",
                "start": local(134), "end": local(RELEASE + 1), "hold": local(m["front_knee_max_frame"]),
                "anchor": "tibia_l", "group": "lead-quad",
                "bones": ["femur_l", "tibia_l", "patella_l"], "viewYaw": 30,
                "series": "front-knee",
                "metric": {"value": f"{m['front_knee_landing']:.0f}° → {m['front_knee_max']:.0f}°", "caption": "front knee flex, landing to release"},
                "why": "The front leg is the brake. When it keeps bending, the energy from the stride goes down into the knee instead of up through the trunk to the ball.",
                "cue": "Land and stop. Feel the front thigh catch you, then push back against the ground as you throw.",
                "drill": "Stride-and-brace. Stride out, land, and hold the front knee still for two counts before throwing at half effort. Ten reps.",
                "check": f"Front knee flex stays near {m['front_knee_landing']:.0f}° from landing to release instead of reaching {m['front_knee_max']:.0f}°.",
                "goal": {"value": round(m["front_knee_landing"], 1), "label": "landing flex"},
            },
        ],
        "muscleGroups": [
            {
                "id": "drive-leg", "label": "Right glute max · quadriceps", "color": "#ff6b5a",
                "role": "Pushes you off the rubber and into the stride",
                "muscles": group(lambda n: n.endswith("_r") and n.startswith(("glmax", "vas", "recfem"))),
            },
            {
                "id": "lead-quad", "label": "Left quadriceps", "color": "#f2a93b",
                "role": "Brakes the stride so the trunk can whip over the front leg",
                "muscles": group(lambda n: n.endswith("_l") and n.startswith(("vas", "recfem"))),
            },
        ],
    }
    for trace in bundle["series"]:
        trace["values"] = [round(float(v), 1) for v in trace["values"][START:END + 1]]

    (MESH_DIR / "motion-analysis.json").write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))
    print(f"baseball: frames {START}–{END}, yaw {np.degrees(yaw):.1f}°, scale {scale_to_surface:.3f}, path residual {residual * 100:.1f} cm, "
          f"{len(hand_vertices)} hand vertices, mesh {(MESH_DIR / 'motion-mesh.bin').stat().st_size / 1e6:.2f} MB, "
          f"json {(MESH_DIR / 'motion-analysis.json').stat().st_size / 1e6:.2f} MB")


def _rotate(quaternion, vector) -> np.ndarray:
    """Rotate a vector by an x, y, z, w quaternion."""
    x, y, z, w = quaternion
    q = np.array([x, y, z])
    v = np.array(vector, dtype=float)
    return v + 2 * np.cross(q, np.cross(q, v) + w * v)


if __name__ == "__main__":
    main()
