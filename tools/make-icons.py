"""Generate the app icons (2x2 grid of colors) without any dependency."""
import struct, zlib, sys, os

COLORS = [(0xFF, 0, 0), (0, 0xC8, 0), (0, 0x50, 0xFF), (0xFF, 0xE6, 0)]

def png(size, path):
    half, gap = size // 2, max(2, size // 40)
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            if abs(x - half) < gap or abs(y - half) < gap:
                row += bytes((17, 17, 17))
            else:
                row += bytes(COLORS[(y >= half) * 2 + (x >= half)])
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    data = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", raw) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(data)

out = sys.argv[1] if len(sys.argv) > 1 else "icons"
for s in (180, 192, 512):
    png(s, os.path.join(out, f"icon-{s}.png"))
