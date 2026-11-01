# Brand assets: the letter අ (Abhaya Uni Bold) in maroon on a gold gradient ("Abhaya Bold C", chosen 2026-11-01 from
# design/brand/letter-variations). Writes design/brand/icon/*.svg (rendered to png by render.mjs) and the title bar
# logos (logo-light.svg, logo-dark.svg: the icon followed by රුත.lk).
#   python3 -m venv .venv && .venv/bin/pip install fonttools brotli uharfbuzz
#   .venv/bin/python design/tools/brand.py && node design/tools/render.mjs
# Text is converted to paths (text2path.py, HarfBuzz shaping) so the svgs need no fonts.
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SI_BOLD = '/Volumes/2TB/node/tipitaka.lk/web/src/assets/fonts/AbhayaUni-Bold.woff2'
LA_REG = '/Volumes/2TB/node/cst/web/src/assets/fonts/NotoSerif-Regular.woff2'
_cache = {}

GOLD_TOP, GOLD_BOTTOM, MAROON, BROWN = '#fbe7b5', '#f3cf7a', '#6e1c22', '#5f280c'
DARK_TEXT = '#f0c08a'  # the dark theme's primary colour (web/src/styles/main.css)


def shape(font, text):
    if (font, text) not in _cache:
        _cache[(font, text)] = json.loads(subprocess.check_output([sys.executable, f'{HERE}/text2path.py', font, text]))
    return _cache[(font, text)]


def fit(font, text, box_w, box_h, cx, cy, fill):
    """text scaled to fit the box (keeping its proportions), centred on (cx, cy)"""
    g = shape(font, text)
    w0, h0 = g['xMax'] - g['xMin'], g['yMax'] - g['yMin']
    s = min(box_w / w0, box_h / h0)
    tx, ty = cx - (g['xMin'] + w0 / 2) * s, cy - (g['yMin'] + h0 / 2) * s
    return f'<path fill="{fill}" transform="translate({tx:.1f} {ty:.1f}) scale({s:.4f})" d="{g["d"]}"/>'


def text(font, txt, x, baseline, size, fill):
    """text at font size `size`, left edge of the ink at x; returns (svg, width)"""
    g = shape(font, txt)
    s = size / g['upm']
    return f'<path fill="{fill}" transform="translate({x - g["xMin"] * s:.1f} {baseline:.1f}) scale({s:.4f})" d="{g["d"]}"/>', (g['xMax'] - g['xMin']) * s


def svg(w, h, body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><defs>{defs}</defs>{body}</svg>\n'


DEFS = f'<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{GOLD_TOP}"/><stop offset="1" stop-color="{GOLD_BOTTOM}"/></linearGradient>'
# the letter fills the tile with its stem standing on the bottom edge (more room above: balanced)
LETTER = fit(SI_BOLD, 'අ', 860, 860, 512, 512 + (1024 - 942), MAROON)


def scaled(fg, k, cx=512, cy=512):
    return f'<g transform="translate({cx} {cy}) scale({k}) translate(-512 -512)">{fg}</g>'


def tile(rx):
    return f'<rect width="1024" height="1024" rx="{rx}" fill="url(#bg)"/>'


def assets():
    out = {}
    out['icon-square'] = svg(1024, 1024, tile(0) + LETTER, DEFS)  # iOS, Play (the stores round the corners)
    out['icon-rounded'] = svg(1024, 1024, tile(224) + LETTER, DEFS)  # PWA "any", the web pages
    # maskable / adaptive: inside the safe circle (PWA 80%, Android adaptive 66/108)
    out['icon-maskable'] = svg(1024, 1024, tile(0) + scaled(LETTER, 0.8), DEFS)
    out['adaptive-foreground'] = svg(1024, 1024, scaled(LETTER, 0.62))
    out['adaptive-background'] = svg(1024, 1024, tile(0), DEFS)
    # Android 13 themed icons: the letter alone, one colour (the system tints it)
    out['adaptive-monochrome'] = svg(1024, 1024, scaled(fit(SI_BOLD, 'අ', 860, 860, 512, 512 + (1024 - 942), '#000000'), 0.62))
    out['icon-round'] = svg(1024, 1024, '<circle cx="512" cy="512" r="512" fill="url(#bg)"/>' + scaled(LETTER, 0.86), DEFS)
    out['favicon'] = svg(1024, 1024, tile(200) + LETTER, DEFS)

    def banner(w, h, k, x, y, tx, s1, s2, s3):
        t1, _ = text(SI_BOLD, 'අරුත.lk', tx, y - s1 * 0.12, s1, MAROON)
        t2, _ = text(SI_BOLD, 'සිංහල ශබ්දකෝෂය', tx, y + s2 * 1.05, s2, MAROON)
        t3, _ = text(LA_REG, 'Sinhala · English · Pali', tx, y + s2 * 1.05 + s3 * 1.9, s3, BROWN)
        icon = f'<g transform="translate({x - 512 * k} {y - 512 * k}) scale({k})"><rect width="1024" height="1024" rx="224" fill="{MAROON}" opacity="0.08"/>{LETTER}</g>'
        return svg(w, h, f'<rect width="{w}" height="{h}" fill="url(#bg)"/>' + icon + t1 + t2 + t3, DEFS)
    out['og'] = banner(1200, 630, 0.42, 290, 315, 560, 150, 64, 40)
    out['feature-graphic'] = banner(1024, 500, 0.36, 250, 250, 480, 120, 52, 32)

    # title bar: the icon then රුත.lk (the icon's අ begins the word); dark theme: the text in the theme's gold
    for name, color in (('logo-light', MAROON), ('logo-dark', DARK_TEXT)):
        h, size = 64, 52
        word, w = text(SI_BOLD, 'රුත.lk', 70, 46, size, color)
        icon = f'<g transform="scale({h / 1024})">{tile(200)}{LETTER}</g>'
        out[name] = svg(int(70 + w + 4), h, icon + word, DEFS)
    return out


if __name__ == '__main__':
    d = f'{ROOT}/design/brand/icon'
    os.makedirs(d, exist_ok=True)
    for k, v in assets().items():
        open(f'{d}/{k}.svg', 'w').write(v)
    print('wrote', d)
