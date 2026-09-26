"""Convert Google Fonts Cabin to a local Three.js typeface.

Requires fonttools. Usage: python build-about-font.py path/to/Cabin-variable.ttf
Source: https://github.com/google/fonts/tree/main/ofl/cabin
The accompanying Cabin-OFL.txt must remain alongside the generated asset.
"""
import json
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen

font = instantiateVariableFont(TTFont(sys.argv[1]), {"wght": 700, "wdth": 100}, inplace=False)
glyph_set = font.getGlyphSet()
scale = 1000 / font['head'].unitsPerEm

class TypefacePen(BasePen):
    def __init__(self):
        super().__init__(glyph_set)
        self.commands = []
        self.start = None
    def emit(self, command, *points):
        self.commands.append(command)
        for point in points:
            self.commands.extend(str(round(v * scale, 3)) for v in point)
    def _moveTo(self, p):
        self.start = p
        self.emit('m', p)
    def _lineTo(self, p): self.emit('l', p)
    def _curveToOne(self, a, b, end): self.emit('b', end, a, b)
    def _qCurveToOne(self, control, end): self.emit('q', end, control)
    def _closePath(self): self.emit('l', self.start)
    def _endPath(self): pass

glyphs = {}
for codepoint, name in font.getBestCmap().items():
    # Include the Latin set, punctuation, and typographic quotes for later copy edits.
    if codepoint > 255 and not 0x2000 <= codepoint <= 0x206F: continue
    glyph = glyph_set[name]
    pen = TypefacePen()
    bounds_pen = BoundsPen(glyph_set)
    glyph.draw(pen)
    glyph.draw(bounds_pen)
    bounds = bounds_pen.bounds or (0, 0, 0, 0)
    glyphs[chr(codepoint)] = {
        'ha': round(glyph.width * scale, 3),
        'x_min': round(bounds[0] * scale, 3),
        'x_max': round(bounds[2] * scale, 3),
        'o': ' '.join(pen.commands),
    }
result = {
    'glyphs': glyphs, 'familyName': 'Cabin Bold', 'resolution': 1000,
    'ascender': font['hhea'].ascent * scale,
    'descender': font['hhea'].descent * scale,
    'underlinePosition': font['post'].underlinePosition * scale,
    'underlineThickness': font['post'].underlineThickness * scale,
    'boundingBox': {k: getattr(font['head'], k) * scale for k in ['xMin','xMax','yMin','yMax']},
    'original_font_information': {
        'copyright': font['name'].getDebugName(0),
        'license': font['name'].getDebugName(13),
        'source': 'https://github.com/google/fonts/tree/main/ofl/cabin',
        'axes': {'wght': 700, 'wdth': 100},
    },
}
output = Path(__file__).resolve().parents[1] / 'public/assets/about-light-study/fonts/cabin_bold.typeface.json'
output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Wrote {len(glyphs)} Cabin Bold glyphs to {output}')
