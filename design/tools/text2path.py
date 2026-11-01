# usage: text2path.py font.woff2 "text" -> prints JSON {d, xMin, yMin, xMax, yMax, upm} (y flipped, font units)
import sys, json, io
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
fontpath, text = sys.argv[1], sys.argv[2]
tt = TTFont(fontpath); buf = io.BytesIO(); tt.flavor = None; tt.save(buf); data = buf.getvalue()
face = hb.Face(data); font = hb.Font(face)
b = hb.Buffer(); b.add_str(text); b.guess_segment_properties(); hb.shape(font, b, {})
gs = tt.getGlyphSet(); order = tt.getGlyphOrder()
pen = SVGPathPen(gs); bp = BoundsPen(gs); x = 0
for info, pos in zip(b.glyph_infos, b.glyph_positions):
    name = order[info.codepoint]
    t = (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)
    gs[name].draw(TransformPen(pen, t)); gs[name].draw(TransformPen(bp, t))
    x += pos.x_advance
xMin, yMin, xMax, yMax = bp.bounds
print(json.dumps({"d": pen.getCommands(), "xMin": xMin, "yMin": yMin, "xMax": xMax, "yMax": yMax, "upm": tt['head'].unitsPerEm}))
