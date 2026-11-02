# M3 step 1: a read-only scan of the dictionary text files for mechanical problems: counts and samples per kind
#   python3 build/m3-scan.py  -> .cache/reports/m3-scan.md (and m3-scan.json: every hit, for the fixes)
import collections, json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {'sinhala-english': 'sinhala_to_english', 'english-sinhala': 'english_to_sinhala',
         'sankshiptha': 'sankshiptha', 'akshara': 'akshara_vinyasa'}
SI = re.compile('[඀-෿]')
LATIN = re.compile('[A-Za-z]')
SIGN = '්ා-ෟෲෳංඃ'  # hal, vowel signs, anusvara, visarga
checks = {
    # Unicode
    'not NFC': lambda t: unicodedata.normalize('NFC', t) != t,
    'unassigned Sinhala code point': lambda t: any(SI.match(c) and unicodedata.category(c) == 'Cn' for c in t),
    'sign at the start of a word': lambda t: re.search(f'(^|[\\s(\\[;,.])[{SIGN}]', t),
    'two vowel signs in a row': lambda t: re.search(f'[ා-ෟෲෳ][්ා-ෟෲෳ]', t),
    'stray ZWJ / ZWNJ': lambda t: re.search('(^|[^්])‍|‍($|[^රය])', t) or '‌' in t,
    'control / odd character': lambda t: re.search('[\u0000-\u0008\u000b-\u001f\u007f ­​﻿�]', t),
    # spacing, punctuation
    'double space': lambda t: '  ' in t,
    'space at an end': lambda t: t != t.strip(),
    'space before punctuation': lambda t: re.search(r'\s[,;.:)\]](\s|$)', t),
    'unbalanced brackets': lambda t: t.count('(') != t.count(')') or t.count('[') != t.count(']'),
    'repeated punctuation': lambda t: re.search(r'([,;])\s*\1|\.\.(?!\.)', t),
}


def entries(path):
    word, lines = None, []
    for ln in open(path, encoding='utf-8').read().split('\n') + ['']:
        if ln.strip() == '':
            if word is not None: yield word, lines
            word, lines = None, []
        elif word is None: word = ln
        else: lines.append(ln)


hits = collections.defaultdict(list)  # (dict, kind) -> [(word, text)]
def hit(code, kind, word, text=''): hits[(code, kind)].append((word, text[:160]))

data = {}
for code, f in FILES.items():
    data[code] = list(entries(f'{ROOT}/data/dicts/{f}.txt'))
    seen = collections.Counter(w for w, _ in data[code])
    for word, lines in data[code]:
        if seen[word] > 1: hit(code, 'headword twice', word)
        if not lines: hit(code, 'no meaning', word)
        for kind, fn in checks.items():
            for t in [word] + lines:
                if fn(t): hit(code, kind, word, t); break
        # the script of the side that should be one language
        if code == 'english-sinhala':
            if SI.search(word): hit(code, 'Sinhala letters in an English headword', word)
            for t in lines:
                if LATIN.search(re.sub(r'^\d+\.\s*|\[[^\]]*\]', '', t)): hit(code, 'English letters in a Sinhala meaning', word, t); break
        if code == 'sinhala-english':
            if LATIN.search(word): hit(code, 'English letters in a Sinhala headword', word)
            for t in lines:
                if SI.search(t): hit(code, 'Sinhala letters in an English meaning', word, t); break
        # the same sense twice in an entry
        senses = [re.sub(r'^\d+\.\s*', '', t).strip() for t in lines]
        if len(senses) != len(set(senses)): hit(code, 'the same sense twice', word, ' | '.join(lines))
        if code in ('sankshiptha', 'akshara'):
            if lines and not re.match(r'^(\d+\.\s*)?\[|^\d+\.|^\(', lines[0]): hit(code, 'first line without a [label]', word, lines[0])

# E->S and S->E should be the same pairs, read from both sides
def pairs(code, flip):
    out = set()
    for word, lines in data[code]:
        for t in lines:
            m = re.match(r'^(?:\d+\.\s*)?(?:\[([^\]]*)\]\s*)?(.+)$', t)
            if m: out.add((m[2].strip(), word, m[1] or '') if flip else (word, m[2].strip(), m[1] or ''))
    return out
es, se = pairs('english-sinhala', False), pairs('sinhala-english', True)
for p in sorted(es - se)[:2000]: hit('english-sinhala', 'pair missing in sinhala-english', p[0], f'{p[2]} {p[1]}')
for p in sorted(se - es)[:2000]: hit('sinhala-english', 'pair missing in english-sinhala', p[1], f'{p[2]} {p[0]}')
# the part-of-speech labels in use (rare ones are likely typos)
for code in ('english-sinhala', 'sinhala-english'):
    labels = collections.Counter(m for _, ls in data[code] for t in ls for m in re.findall(r'\[([^\]]*)\]', t))
    for lab, n in labels.items():
        if n < 20: hit(code, 'rare [label] (< 20 uses)', lab, str(n))

os.makedirs(f'{ROOT}/.cache/reports', exist_ok=True)
out = ['# M3 scan (read only)', '']
for code in FILES:
    out += [f'## {code}: {len(data[code])} entries', '', '| kind | count | samples |', '|---|---|---|']
    for (c, kind), hs in sorted(hits.items(), key=lambda kv: -len(kv[1])):
        if c != code: continue
        sample = ' · '.join((f'{w} → {t}' if t else w).replace('|', '¦').replace('‍', '‍')[:90] for w, t in hs[:4])
        out.append(f'| {kind} | {len(hs)} | {sample} |')
    out.append('')
open(f'{ROOT}/.cache/reports/m3-scan.md', 'w').write('\n'.join(out))
json.dump({f'{c}\t{k}': v for (c, k), v in hits.items()}, open(f'{ROOT}/.cache/reports/m3-scan.json', 'w'), ensure_ascii=False, indent=0)
print('\n'.join(out))
