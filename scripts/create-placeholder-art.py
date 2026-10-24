"""Original, fictitious placeholder portraits. No model, photo or network is used."""
from pathlib import Path
import math
import struct
import zlib

WIDTH, HEIGHT, SCALE = 480, 640, 2
W, H = WIDTH * SCALE, HEIGHT * SCALE
ROOT = Path(__file__).resolve().parent.parent


def rgb(value):
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))


def portrait(name, coat, hair, skin):
    pixels = bytearray(W * H * 3)
    for y in range(H):
        shade = int(224 - 14 * y / H)
        pixels[y * W * 3:(y + 1) * W * 3] = bytes((shade, shade + 3, shade + 2)) * W

    def ellipse(cx, cy, rx, ry, color, shading=0):
        cx, cy, rx, ry = (v * SCALE for v in (cx, cy, rx, ry))
        base = rgb(color)
        for y in range(max(0, int(cy - ry)), min(H, int(cy + ry) + 1)):
            dy = (y + .5 - cy) / ry
            half = rx * math.sqrt(max(0, 1 - dy * dy))
            for x in range(max(0, int(cx - half)), min(W, int(cx + half) + 1)):
                variation = shading * ((x - cx) / rx * -.35 - dy * .18)
                at = (y * W + x) * 3
                pixels[at:at + 3] = bytes(max(0, min(255, round(c + variation))) for c in base)

    def rect(x1, y1, x2, y2, color):
        color = bytes(rgb(color))
        for y in range(max(0, int(y1 * SCALE)), min(H, int(y2 * SCALE))):
            left, right = max(0, int(x1 * SCALE)), min(W, int(x2 * SCALE))
            pixels[(y * W + left) * 3:(y * W + right) * 3] = color * (right - left)

    ellipse(240, 660, 220, 196, coat, 20)
    rect(207, 375, 273, 505, skin)
    ellipse(240, 224, 126, 166, hair, 15)
    ellipse(124, 283, 22, 36, skin, 12)
    ellipse(356, 283, 22, 36, skin, 12)
    ellipse(240, 279, 108, 144, skin, 27)
    ellipse(237, 126, 111, 63, hair, 10)
    # Symmetric, neutral front-facing face with a closed mouth.
    ellipse(192, 241, 27, 5, hair)
    ellipse(288, 241, 27, 5, hair)
    for x in (192, 288):
        ellipse(x, 267, 24, 10, '#f6f3e9')
        ellipse(x, 267, 8, 9, '#76614a')
        ellipse(x, 267, 4, 6, '#292a2a')
        ellipse(x - 2, 264, 2, 2, '#ffffff')
    ellipse(241, 303, 12, 26, skin, 28)
    ellipse(243, 324, 12, 3, '#b08b73')
    ellipse(240, 354, 29, 4, '#9c665e')
    ellipse(240, 354, 25, 1.3, '#6e4d47')
    ellipse(240, 488, 31, 18, '#efe6cf')
    rect(235, 506, 245, 640, '#bba87f')
    for y in (535, 580, 625):
        ellipse(240, y, 5, 5, '#443e37')

    # Supersample down to a small RGB PNG using only standard-library code.
    rows = bytearray()
    for y in range(HEIGHT):
        rows.append(0)
        for x in range(WIDTH):
            for channel in range(3):
                total = sum(pixels[((y * SCALE + dy) * W + x * SCALE + dx) * 3 + channel]
                            for dy in range(SCALE) for dx in range(SCALE))
                rows.append(total // (SCALE * SCALE))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', WIDTH, HEIGHT, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b'')
    directory = ROOT / 'content' / 'characters' / name
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'ref.png').write_bytes(png)
    print(f'Created procedural {name} portrait ({len(png)} bytes).')


portrait('odile', '#7a343b', '#aaa394', '#dbb99c')
portrait('rocco', '#3d6269', '#42342c', '#cda181')
portrait('pim', '#bd8c40', '#66513a', '#ead0aa')
