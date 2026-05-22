"""
Generate RetailScan PWA icons in all required sizes.
Run: python generate_icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

SIZES   = [72, 96, 128, 144, 152, 192, 384, 512]
OUT_DIR = os.path.join("static", "icons")
os.makedirs(OUT_DIR, exist_ok=True)


def make_icon(size: int) -> Image.Image:
    """
    Draw a rounded-square icon:
      • purple gradient background
      • white shopping-bag silhouette in the centre
      • small white lightning bolt accent
    """
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── Gradient background ─────────────────────────────────
    # Top colour #6366f1 → bottom colour #8b5cf6
    r1, g1, b1 = 99,  102, 241   # #6366f1
    r2, g2, b2 = 139, 92,  246   # #8b5cf6
    for y in range(size):
        t   = y / size
        r   = int(r1 + (r2 - r1) * t)
        g   = int(g1 + (g2 - g1) * t)
        b   = int(b1 + (b2 - b1) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # ── Rounded corners via mask ────────────────────────────
    radius = int(size * 0.22)
    mask   = Image.new("L", (size, size), 0)
    md     = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.putalpha(mask)

    # ── White shopping-bag shape ────────────────────────────
    draw = ImageDraw.Draw(img)
    m    = size * 0.15       # outer margin
    bw   = size - m * 2      # bag width
    bh   = bw * 0.72         # bag height
    by   = size * 0.36       # bag top-y
    br   = bw * 0.1          # bag corner radius

    # Handle
    hw   = bw * 0.38
    hh   = size * 0.18
    hx   = m + (bw - hw) / 2
    hy   = by - hh + size * 0.02
    hstroke = max(2, int(size * 0.055))
    draw.arc(
        [hx, hy, hx + hw, hy + hh * 2],
        start=200, end=340,
        fill=(255, 255, 255, 255),
        width=hstroke,
    )

    # Bag body
    draw.rounded_rectangle(
        [m, by, m + bw, by + bh],
        radius=br,
        fill=(255, 255, 255, 200),
    )

    # Scan lines inside bag (3 horizontal lines)
    lm    = m + bw * 0.18
    lw    = bw * 0.64
    ls    = bh * 0.18
    lh    = max(1, int(size * 0.025))
    lc    = (99, 102, 241, 200)
    ly0   = by + bh * 0.32
    for i in range(3):
        y0 = ly0 + i * ls
        draw.rounded_rectangle([lm, y0, lm + lw, y0 + lh],
                                radius=lh // 2, fill=lc)

    return img


for sz in SIZES:
    icon = make_icon(sz)
    path = os.path.join(OUT_DIR, f"icon-{sz}.png")
    icon.save(path, "PNG")
    print(f"  ✓  {path}")

print("All icons generated.")
