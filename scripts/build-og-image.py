#!/usr/bin/env python3
"""Render the 1200x630 social card from the same particle body the Hero draws.

Usage: python3 scripts/build-og-image.py [--node-modules PATH]
Needs Pillow, numpy and fontTools (with brotli) to unpack the Space Grotesk WOFF2.
"""

import argparse
import math
import tempfile
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
WIDTH, HEIGHT = 1200, 630
SCALE = 2  # supersample, then downsize for clean edges
INK = (244, 240, 250)
MUTED = (170, 163, 179)
PURPLE = (161, 122, 255)
FIELD = (5, 5, 5)


def grotesk(node_modules: Path, weight: int, size: int) -> ImageFont.FreeTypeFont:
    source = node_modules / "@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2"
    font = TTFont(source)
    font.flavor = None
    instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True)
    target = Path(tempfile.gettempdir()) / f"cerebel-space-grotesk-{weight}.ttf"
    font.save(target)
    return ImageFont.truetype(str(target), size)


def tracked(draw: ImageDraw.ImageDraw, xy, text, font, fill, tracking):
    """Draw text with CSS-like letter-spacing (tracking is in em)."""
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        x += font.getlength(char) + tracking * font.size
    return x


def particle_layer() -> Image.Image:
    points = np.fromfile(ROOT / "public/assets/cerebel-kinetic-human-points.bin", dtype=np.float32).reshape(-1, 3)
    # Same pose as the Hero: group.rotation.set(-0.08, -0.52, 0.04).
    rx, ry, rz = -0.08, -0.52, 0.04
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    rot_x = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    rot_y = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rot_z = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    rotated = points @ (rot_x @ rot_y @ rot_z).T

    camera_z = 9.4
    focal = 1 / math.tan(math.radians(34) / 2)
    depth = camera_z - rotated[:, 2]
    w, h = WIDTH * SCALE, HEIGHT * SCALE
    body_scale = 1.34
    px = (rotated[:, 0] * body_scale * focal / depth) * (h / 2) + w * 0.735
    py = (-rotated[:, 1] * body_scale * focal / depth) * (h / 2) + h * 0.52

    density, _, _ = np.histogram2d(py, px, bins=[h, w], range=[[0, h], [0, w]])
    glow = Image.fromarray(np.clip(density * 150, 0, 255).astype(np.uint8), "L")
    sharp = glow.filter(ImageFilter.GaussianBlur(0.9 * SCALE))
    halo = glow.filter(ImageFilter.GaussianBlur(5 * SCALE))
    alpha = np.clip(np.asarray(sharp, dtype=np.float32) * 2.6 + np.asarray(halo, dtype=np.float32) * 1.4, 0, 255)

    layer = np.zeros((h, w, 4), dtype=np.uint8)
    layer[..., :3] = (245, 247, 250)
    layer[..., 3] = alpha.astype(np.uint8)
    return Image.fromarray(layer, "RGBA")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--node-modules", default=str(ROOT / "node_modules"))
    args = parser.parse_args()
    node_modules = Path(args.node_modules)

    w, h = WIDTH * SCALE, HEIGHT * SCALE
    card = Image.new("RGBA", (w, h), FIELD + (255,))
    card.alpha_composite(particle_layer())

    # Keep the headline column clean where the body's reaching arm crosses it.
    fade = Image.new("L", (w, h), 0)
    ImageDraw.Draw(fade).rectangle([0, 0, int(w * 0.5), h], fill=255)
    fade = fade.filter(ImageFilter.GaussianBlur(90 * SCALE))
    shade = Image.new("RGBA", (w, h), FIELD + (0,))
    shade.putalpha(fade.point(lambda value: int(value * 0.72)))
    card.alpha_composite(shade)

    draw = ImageDraw.Draw(card)
    margin = 64 * SCALE

    wordmark = Image.open(ROOT / "public/assets/cerebel-wordmark.png").convert("RGBA")
    mark_height = 46 * SCALE
    wordmark = wordmark.resize((round(wordmark.width * mark_height / wordmark.height), mark_height), Image.LANCZOS)
    card.alpha_composite(wordmark, (margin, margin - 6 * SCALE))

    headline = grotesk(node_modules, 520, 76 * SCALE)
    line_height = int(headline.size * 0.94)
    y = h - margin - 54 * SCALE - line_height * 4
    for line in ("Capture human", "motion.", "Train intelligent", "machines."):
        tracked(draw, (margin, y), line, headline, INK, -0.055)
        y += line_height

    mono = ImageFont.truetype(
        str(node_modules / "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff"), 15 * SCALE
    )
    caption_y = h - margin - 14 * SCALE
    end = tracked(draw, (margin, caption_y), "CEREBEL.TECH", mono, PURPLE, 0.1)
    draw.line([(end + 14 * SCALE, caption_y + 10 * SCALE), (end + 62 * SCALE, caption_y + 10 * SCALE)], fill=(88, 80, 100), width=SCALE)
    tracked(draw, (end + 76 * SCALE, caption_y), "WEARABLE MOTION INTELLIGENCE", mono, MUTED, 0.1)

    output = ROOT / "public/assets/og-cerebel.jpg"
    card.convert("RGB").resize((WIDTH, HEIGHT), Image.LANCZOS).save(output, quality=88, optimize=True, progressive=True)
    print(f"{output.relative_to(ROOT)}: {output.stat().st_size / 1024:.0f} kB")


if __name__ == "__main__":
    main()
