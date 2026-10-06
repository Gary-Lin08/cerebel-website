"""Pose the OpenSim skeleton's hands around the estimated club.

The inverse-kinematics result has no finger motion and an unreliable wrist roll, so a club
drawn from the wrist leaves two open hands beside it. This module supplies the two things
build-golf-swing-analysis.py needs to draw a believable grip instead:

  bake_grip_hands()  writes a copy of the bone model whose finger bones are curled into a fist
  grip_rotation()    orients a hand so the club lies diagonally across its palm

Both are presentation, not measurement, and the page's club disclosure says so.
"""

import json
import struct
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

# Angle between the club and the fingers' own direction: the club runs from the heel pad to the
# first joint of the index finger, as in a real lead-hand grip.
GRIP_ANGLE = np.radians(58)
# A point on the club's axis, in the hand's own frame (origin at the wrist, fingers along -y,
# palm facing +x). It sits in the fold between the palm and the curled fingers.
PALM_POINT = np.array([0.022, -0.080, 0.0])
# Distance along the club between the two palms, and how far the butt end shows above the lead hand.
HAND_SPACING = 0.06
BUTT_LENGTH = 0.085
# How far a hand may roll around the shaft between two frames.
MAX_ROLL = np.radians(14)
# Cumulative flexion of each finger bone, measured from the open-hand direction toward the palm.
CURL_TARGETS = np.radians([80.0, 172.0, 215.0])


def unit(v: np.ndarray) -> np.ndarray:
    return v / np.linalg.norm(v)


def grip_rotation(club: np.ndarray, across: np.ndarray, side: str) -> Rotation:
    """Hand orientation that lays `club` across the palm.

    `across` is a unit vector perpendicular to the club that points the way the forearm leans,
    so the fingers continue from the forearm as far as the grip allows. `side` is "l" or "r":
    both thumbs point down the shaft, which puts the palms on opposite sides of it.
    """
    fingers = np.cos(GRIP_ANGLE) * club + np.sin(GRIP_ANGLE) * across
    thumb_side = np.sin(GRIP_ANGLE) * club - np.cos(GRIP_ANGLE) * across
    y = -fingers
    z = -thumb_side if side == "l" else thumb_side
    return Rotation.from_matrix(np.column_stack([np.cross(y, z), y, z]))


def lean(forearm: np.ndarray, club: np.ndarray, previous: np.ndarray | None = None) -> np.ndarray:
    """The part of the forearm direction that is perpendicular to the club.

    When the forearm comes into line with the club that direction is poorly defined and can flip
    from one frame to the next, which would spin the hand around the shaft. Given the previous
    frame's lean, the hand may only roll a limited way toward the new one, and less when the
    new one is uncertain.
    """
    sideways = forearm - np.dot(forearm, club) * club
    certainty = np.linalg.norm(sideways)
    if previous is None:
        return unit(sideways) if certainty > 1e-6 else unit(np.cross(club, [0.0, 1.0, 0.0]))
    carried = unit(previous - np.dot(previous, club) * club)
    if certainty < 1e-6:
        return carried
    wanted = sideways / certainty
    roll = np.arctan2(np.dot(np.cross(carried, wanted), club), np.dot(carried, wanted))
    step = np.clip(roll, -MAX_ROLL, MAX_ROLL) * min(1.0, certainty / 0.3)
    return Rotation.from_rotvec(club * step).apply(carried)


# --------------------------------------------------------------------------- bone model
def _read_glb(path: Path):
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + json_length])
    binary = bytearray(data[20 + json_length + 8:])
    return document, binary


def _write_glb(path: Path, document: dict, binary: bytearray) -> None:
    text = json.dumps(document, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(text) + 8 + len(binary)
    path.write_bytes(
        struct.pack("<III", 0x46546C67, 2, total)
        + struct.pack("<II", len(text), 0x4E4F534A) + text
        + struct.pack("<II", len(binary), 0x004E4942) + binary
    )


def _accessor_span(document: dict, index: int):
    accessor = document["accessors"][index]
    view = document["bufferViews"][accessor["bufferView"]]
    return view.get("byteOffset", 0) + accessor.get("byteOffset", 0), accessor["count"]


def _bones(positions: np.ndarray, triangles: np.ndarray) -> np.ndarray:
    """Label each vertex with the bone it belongs to: the hand mesh is 27 separate closed shells."""
    _, welded = np.unique(np.round(positions * 1e5).astype(np.int64), axis=0, return_inverse=True)
    welded = welded.ravel()
    parent = np.arange(welded.max() + 1)

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b, c in welded[triangles]:
        root = find(a)
        parent[find(b)] = root
        parent[find(c)] = root
    roots = np.array([find(x) for x in welded])
    return np.unique(roots, return_inverse=True)[1].ravel()


def _curl_hand(positions: np.ndarray, normals: np.ndarray, triangles: np.ndarray) -> None:
    """Rotate the phalanges of the four fingers, in place, into a fist around the palm point."""
    labels = _bones(positions, triangles)
    bones = []
    for label in range(labels.max() + 1):
        mask = labels == label
        points = positions[mask]
        centre = points.mean(0)
        axis = np.linalg.svd(points - centre, full_matrices=False)[2][0]
        along = (points - centre) @ axis
        low, high = np.percentile(along, [8, 92])
        ends = [points[along <= low].mean(0), points[along >= high].mean(0)]
        bones.append({"mask": mask, "ends": ends, "length": along.max() - along.min()})

    used = set()
    # The four finger metacarpals are the only bones longer than 6 cm; the thumb's is shorter.
    for metacarpal in [i for i, bone in enumerate(bones) if bone["length"] > 0.06]:
        used.add(metacarpal)
        tip = min(bones[metacarpal]["ends"], key=lambda end: end[1])  # the knuckle end is further along -y
        chain = []
        for _ in range(3):
            best = None
            for index, bone in enumerate(bones):
                if index in used:
                    continue
                for near, far in (bone["ends"], bone["ends"][::-1]):
                    gap = np.linalg.norm(near - tip)
                    if gap < 0.014 and (best is None or gap < best[0]):
                        best = (gap, index, near, far)
            if best is None:
                raise RuntimeError("Could not follow a finger from its metacarpal; the hand mesh has changed.")
            _, index, near, far = best
            used.add(index)
            chain.append({"mask": bones[index]["mask"], "joint": (tip + near) / 2, "tip": far.copy()})
            tip = far

        for depth, segment in enumerate(chain):
            # Joints and tips already carry the turns of the joints before them.
            direction = segment["tip"] - segment["joint"]
            current = np.arctan2(direction[0], -direction[1])  # flexion from -y toward +x
            turn = CURL_TARGETS[depth] - current
            cos, sin = np.cos(turn), np.sin(turn)
            pivot = segment["joint"].copy()

            def rotate(points: np.ndarray, about: np.ndarray | None) -> np.ndarray:
                moved = points - about if about is not None else points.copy()
                x = moved[:, 0] * cos - moved[:, 1] * sin
                y = moved[:, 0] * sin + moved[:, 1] * cos
                moved[:, 0], moved[:, 1] = x, y
                return moved + about if about is not None else moved

            # Everything beyond this joint turns with it.
            for later in chain[depth:]:
                positions[later["mask"]] = rotate(positions[later["mask"]], pivot)
                normals[later["mask"]] = rotate(normals[later["mask"]], None)
                later["joint"] = rotate(later["joint"][None], pivot)[0]
                later["tip"] = rotate(later["tip"][None], pivot)[0]


def bake_grip_hands(source: Path, target: Path) -> None:
    document, binary = _read_glb(source)
    for name in ("hand_l", "hand_r"):
        node = next(node for node in document["nodes"] if node.get("name") == name)
        primitive = document["meshes"][node["mesh"]]["primitives"][0]
        position_offset, count = _accessor_span(document, primitive["attributes"]["POSITION"])
        normal_offset, _ = _accessor_span(document, primitive["attributes"]["NORMAL"])
        index_offset, index_count = _accessor_span(document, primitive["indices"])
        index_type = {5123: "<u2", 5125: "<u4"}[document["accessors"][primitive["indices"]]["componentType"]]

        positions = np.frombuffer(binary, "<f4", count * 3, position_offset).reshape(count, 3).copy()
        normals = np.frombuffer(binary, "<f4", count * 3, normal_offset).reshape(count, 3).copy()
        triangles = np.frombuffer(binary, index_type, index_count, index_offset).reshape(-1, 3).astype(np.int64)
        _curl_hand(positions, normals, triangles)

        binary[position_offset:position_offset + count * 12] = positions.astype("<f4").tobytes()
        binary[normal_offset:normal_offset + count * 12] = normals.astype("<f4").tobytes()
        accessor = document["accessors"][primitive["attributes"]["POSITION"]]
        accessor["min"] = [float(v) for v in positions.min(0)]
        accessor["max"] = [float(v) for v in positions.max(0)]
    _write_glb(target, document, binary)
