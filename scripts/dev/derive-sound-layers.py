#!/usr/bin/env python3
"""Derive isolated sound-control layers from the supplied vibe sound artwork.

Sources (kept untouched):
  public/toolbar/vibe-sound-on.png   232x103 expanded pill artwork
  public/toolbar/vibe-sound-off.png  103x103 collapsed note-in-circle

Outputs (public/toolbar/):
  vibe-sound-shell.png      232x103 pill shell (outer frame + badge ring +
                            gradient) with the note / play / arrow glyphs
                            filled in from the surrounding gradient, so the
                            note layer can spin independently on top.
  vibe-sound-note.png       music-note glyph on transparency
  vibe-sound-play.png       play triangle on transparency
  vibe-sound-direction.png  direction arrow (points UP) on transparency

The glyphs are pure white over a smooth horizontal warm gradient, so:
  - glyph pixels are isolated by a whiteness threshold inside known regions
  - shell holes are filled by lerping the nearest solid shell pixels on the
    same row (the gradient varies horizontally, barely vertically)

Run with the tmp-media venv:  tmp-media/.venv/bin/python scripts/dev/derive-sound-layers.py
"""

from PIL import Image
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ON_PATH = ROOT / 'public' / 'toolbar' / 'vibe-sound-on.png'

WHITE_MIN = 230      # strict white: connected-component seeding
GLYPH_MIN = 160      # soft white: glyph extraction (catches AA edges)
ALPHA_MIN = 200


def load():
    im = Image.open(ON_PATH).convert('RGBA')
    return im, im.load(), im.size


def white_components(px, w, h):
    """Connected components (4-neighbour) of strict-white opaque pixels."""
    white = set()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] > ALPHA_MIN and min(p[:3]) > WHITE_MIN:
                white.add((x, y))
    visited = set()
    comps = []
    for seed in white:
        if seed in visited:
            continue
        q = deque([seed])
        visited.add(seed)
        pts = []
        while q:
            cx, cy = q.popleft()
            pts.append((cx, cy))
            for n in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if n in white and n not in visited:
                    visited.add(n)
                    q.append(n)
        comps.append(pts)
    comps.sort(key=len, reverse=True)
    return comps


def bbox(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def extract_glyph(src, region, out_path, pad=4):
    """Copy soft-white pixels inside `region` (x0,y0,x1,y1) onto transparency."""
    x0, y0, x1, y1 = region
    out = Image.new('RGBA', (x1 - x0 + 1, y1 - y0 + 1), (0, 0, 0, 0))
    spx, opx = src.load(), out.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = spx[x, y]
            if p[3] > 0 and min(p[:3]) > GLYPH_MIN:
                opx[x - x0, y - y0] = p
    # Trim fully transparent border rows/cols, then pad.
    alpha = out.getchannel('A')
    box = alpha.getbbox()
    if box:
        out = out.crop(box)
    if pad:
        padded = Image.new('RGBA', (out.width + 2 * pad, out.height + 2 * pad), (0, 0, 0, 0))
        padded.paste(out, (pad, pad))
        out = padded
    out.save(out_path)
    print(f'{out_path.name}: {out.size[0]}x{out.size[1]}')


def build_shell(src, glyph_regions, frame_comp, out_path):
    """Source image with glyph regions repainted from the row-wise gradient.

    Every pixel inside a grown glyph bbox is repainted (glyph AA fringes
    blend towards the gradient and can't be thresholded cleanly), EXCEPT
    pixels of the white outer frame / badge ring (dilated by 1px to cover
    its own AA fringe), which the note bbox slightly overlaps.
    """
    shell = src.copy()
    px = shell.load()
    w, h = shell.size

    protected = set(frame_comp)
    for (cx, cy) in frame_comp:
        protected.update(((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)))

    def is_gradient(p):
        return p[3] > ALPHA_MIN and min(p[:3]) <= 230 and not (
            p[0] > 200 and p[1] > 200 and p[2] > 200
        )

    for (rx0, ry0, rx1, ry1) in glyph_regions:
        x0, x1 = max(0, rx0 - 2), min(w - 1, rx1 + 2)
        y0, y1 = max(0, ry0 - 2), min(h - 1, ry1 + 2)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if (x, y) in protected:
                    continue
                # Anchor on clean gradient OUTSIDE the grown bbox.
                left = right = None
                for lx in range(x0 - 1, -1, -1):
                    if is_gradient(px[lx, y]):
                        left = (lx, px[lx, y])
                        break
                for rx in range(x1 + 1, w):
                    if is_gradient(px[rx, y]):
                        right = (rx, px[rx, y])
                        break
                if left and right:
                    t = (x - left[0]) / (right[0] - left[0])
                    px[x, y] = tuple(
                        round(left[1][i] + (right[1][i] - left[1][i]) * t) for i in range(4)
                    )
                elif left:
                    px[x, y] = left[1]
                elif right:
                    px[x, y] = right[1]
                # else: leave as-is (no gradient on this row)
    shell.save(out_path)
    print(f'{out_path.name}: {shell.size[0]}x{shell.size[1]}')


def main():
    im, px, (w, h) = load()
    comps = white_components(px, w, h)
    if len(comps) < 4:
        raise SystemExit(f'expected >=4 white components, found {len(comps)}')
    # comps[0] is the outer pill frame + badge ring (kept in the shell).
    # The remaining three are note / play / arrow; order them by bbox x.
    glyph_comps = sorted(comps[1:4], key=lambda c: bbox(c)[0])
    regions = [bbox(c) for c in glyph_comps]
    names = ['vibe-sound-note.png', 'vibe-sound-play.png', 'vibe-sound-direction.png']
    for name, region in zip(names, regions):
        extract_glyph(im, region, ROOT / 'public' / 'toolbar' / name)
    build_shell(im, regions, comps[0], ROOT / 'public' / 'toolbar' / 'vibe-sound-shell.png')


if __name__ == '__main__':
    main()
