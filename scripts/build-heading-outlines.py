"""Extract Space Grotesk 700 contours from the installed OFL font for the hover effect.
Requires fonttools and brotli. Runtime serves only the resulting compact JSON.
"""
import json,re
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
root=Path(__file__).resolve().parent.parent
font=TTFont(root/'node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2')
font=instantiateVariableFont(font,{'wght':700},inplace=True)
glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); out={}
for char in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?—–-+/&\'’':
 name=cmap.get(ord(char))
 if not name:continue
 pen=SVGPathPen(glyphs);glyphs[name].draw(pen)
 path=pen.getCommands()
 out[char]=['M'+piece for piece in path.split('M') if piece]
(root/'src/experience/heading-outlines.json').write_text(json.dumps({'units':font['head'].unitsPerEm,'glyphs':out},separators=(',',':')))
