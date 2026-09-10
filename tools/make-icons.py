#!/usr/bin/env python3
"""Generate the app icons. Run once, or after changing the palette:

    python3 tools/make-icons.py

Pure stdlib PNG writer so there's nothing to install. Icons are fully
opaque on purpose -- iOS composites transparency in apple-touch-icon
against black and it looks broken.
"""

import os
import struct
import zlib

INK = (0x1B, 0x1B, 0x19)
PAPER = (0xF4, 0xF3, 0xEF)
ACCENT = (0x90, 0x95, 0xF2)

# Four ruled lines, the last one accented -- an entry marked in a log book.
RULES = [
    (0.00, 1.00, PAPER),
    (0.28, 0.72, PAPER),
    (0.56, 0.88, PAPER),
    (0.84, 0.45, ACCENT),
]

MARGIN = 0.20        # inset from each edge
RULE_H = 0.16        # rule height, as a fraction of the inner box


def render(size):
    px = [[INK] * size for _ in range(size)]
    inner = size * (1 - 2 * MARGIN)
    left = size * MARGIN
    top = size * MARGIN
    rule_h = max(2, round(inner * RULE_H))

    for y_frac, w_frac, color in RULES:
        y0 = round(top + inner * y_frac)
        x0 = round(left)
        x1 = round(left + inner * w_frac)
        for y in range(y0, min(y0 + rule_h, size)):
            for x in range(x0, min(x1, size)):
                px[y][x] = color
    return px


def write_png(path, px):
    size = len(px)
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("3B", *c) for c in row) for row in px
    )

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    with open(path, "wb") as f:
        f.write(png)
    print(f"{path}  {size}x{size}  {len(png):,} bytes")


if __name__ == "__main__":
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, "icons")
    os.makedirs(out, exist_ok=True)
    for size in (180, 192, 512):
        write_png(os.path.join(out, f"icon-{size}.png"), render(size))
