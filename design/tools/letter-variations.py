# Light background variations of the letter icon (Abhaya Uni, Alakamanda): design/brand/letter-variations/
# (the exploration that chose Abhaya Bold C for brand.py)
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand import fit, svg, text, ROOT

F = os.path.expanduser('~/Library/Fonts/')
FONTS = {'abhaya': F + 'AbhayaUni-Regular.ttf', 'abhaya-bold': F + 'AbhayaUni-Bold.ttf', 'alakamanda': F + 'UN-Alakamanda.ttf'}
LK = F + 'AbhayaUni-Regular.ttf'
# name: (background, gradient end or None, letter, border or None)
PALETTES = {
    'cream-maroon': ('#fdf6ea', None, '#7a1824', None),
    'white-maroon': ('#ffffff', None, '#8e1f2e', '#e8dcd0'),
    'parchment-brown': ('#f4ead5', '#ead9b8', '#5f280c', None),
    'gold-maroon': ('#fbe7b5', '#f3cf7a', '#6e1c22', None),
    'rose-maroon': ('#fbeaea', '#f3d2d2', '#7a1824', None),
    'cream-saffron': ('#fff8ec', None, '#c2621f', None),
}
OUT = f'{ROOT}/design/brand/letter-variations'
os.makedirs(OUT, exist_ok=True)

def bg(name, rx=0):
    b, b2, _, border = PALETTES[name]
    defs = f'<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{b}"/><stop offset="1" stop-color="{b2}"/></linearGradient>' if b2 else ''
    fill = 'url(#g)' if b2 else b
    stroke = f' stroke="{border}" stroke-width="16"' if border else ''
    return defs, f'<rect x="8" y="8" width="1008" height="1008" rx="{rx}" fill="{fill}"{stroke}/>' if border else f'<rect width="1024" height="1024" rx="{rx}" fill="{fill}"/>'

for font, fpath in FONTS.items():
    for pal, (_, _, fg, _) in PALETTES.items():
        defs, rect = bg(pal)
        open(f'{OUT}/{font}--{pal}.svg', 'w').write(svg(1024, 1024, rect + fit(fpath, 'අ', 860, 860, 512, 512, fg), defs))
        # title bar: the icon (rounded) + රුත in the font + .lk in Abhaya, the letter colour
        defs, rect = bg(pal, 200)
        rest, w = text(fpath, 'රුත', 0, 64, 64, fg)
        lk, w2 = text(LK, '.lk', 0, 64, 56, fg)
        ic = f'<g transform="scale(0.078)">{rect}{fit(fpath, "අ", 860, 860, 512, 512, fg)}</g>'
        body = ic + f'<g transform="translate(90 -4)">{rest}</g><g transform="translate({94 + w:.0f} -4)">{lk}</g>'
        open(f'{OUT}/{font}--{pal}--title.svg', 'w').write(svg(int(110 + w + w2), 90, body, defs))
print(len(FONTS) * len(PALETTES), 'variations in', OUT)
