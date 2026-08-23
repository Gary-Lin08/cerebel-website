#!/usr/bin/env python3
"""Convert a CerebelPreview mesh_sequence.pt inside a session archive for web playback.

The source archive stores the precomputed output of CerebelPreview's SOMA mesh
pipeline as a PyTorch payload.  This utility writes the same vertices and faces
as little-endian typed-array buffers plus the manifest consumed by
``SomaSequenceViewer``.
"""

from __future__ import annotations

import argparse
import json
import tarfile
import tempfile
from pathlib import Path

import numpy as np
import torch


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--source-session-id", required=True)
    parser.add_argument("--public-id", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    member_name = f"{args.source_session_id}/mesh/mesh_sequence.pt"

    with tarfile.open(args.archive, "r:gz") as archive:
        member = archive.getmember(member_name)
        stream = archive.extractfile(member)
        if stream is None:
            raise RuntimeError(f"Could not read {member_name}")
        with tempfile.NamedTemporaryFile(suffix=".pt") as temporary:
            while chunk := stream.read(1024 * 1024):
                temporary.write(chunk)
            temporary.flush()
            payload = torch.load(temporary.name, map_location="cpu", weights_only=False)

    if not isinstance(payload, dict):
        raise RuntimeError("mesh_sequence.pt must contain a dictionary payload")
    vertices = np.asarray(payload.get("vertices"), dtype="<f4")
    faces = np.asarray(payload.get("faces"), dtype="<u4")
    fps = float(payload.get("fps"))
    if vertices.ndim != 3 or vertices.shape[2] != 3:
        raise RuntimeError(f"Expected [frames, vertices, 3], got {vertices.shape}")
    if faces.ndim != 2 or faces.shape[1] != 3:
        raise RuntimeError(f"Expected [triangles, 3], got {faces.shape}")
    if not np.isfinite(vertices).all() or faces.min() < 0 or faces.max() >= vertices.shape[1]:
        raise RuntimeError("Mesh payload contains invalid vertices or face indices")

    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    vertices_name = "soma-vertices.bin"
    faces_name = "soma-faces.bin"
    vertices.tofile(output / vertices_name)
    faces.tofile(output / faces_name)

    manifest = {
        "format": "cerebel-mesh-sequence-v1",
        "source": "CerebelPreview mesh/mesh_sequence.pt",
        "vertexCount": int(vertices.shape[1]),
        "triangleCount": int(faces.shape[0]),
        "frameCount": int(vertices.shape[0]),
        "fps": fps,
        "verticesUrl": f"/viewer-data/{args.public_id}/{vertices_name}",
        "facesUrl": f"/viewer-data/{args.public_id}/{faces_name}",
        "bounds": {
            "min": [float(value) for value in vertices.min(axis=(0, 1))],
            "max": [float(value) for value in vertices.max(axis=(0, 1))],
        },
    }
    (output / "soma-metadata.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        f"{args.public_id}: {manifest['frameCount']} frames, "
        f"{manifest['vertexCount']} vertices, {manifest['triangleCount']} triangles"
    )


if __name__ == "__main__":
    main()
