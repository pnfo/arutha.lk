# Data pipeline

`npm run build:dict` → `db/dict.db` (~360 MB, ~10 s), `db/build-info.json` (content hash), `.cache/reports/dict-build.md`,
`data/cst.lock`. It needs tipitaka.app's built `../cst/db/dict.db` (there: `npm run upstream -- --dpd --dicts &&
npm run build:dict`); `--cst <path>` for another place.

| code | v1 id | source | headwords |
|---|---|---|---|
| sankshiptha | sankshiptha | `data/dicts/sankshiptha.txt` (Sinhala Dictionary Office) | Sinhala; "a, b" = variants |
| akshara | akshara_vinyasa | `data/dicts/akshara_vinyasa.txt` | Sinhala |
| si-buddhadatta | pali_buddhadatta | tipitaka.app (github.com/pnfo/pali-sinhala-dictionary) | Roman, shown in Sinhala script |
| si-sumangala | pali_sumangala | tipitaka.app (same), with the page numbers of the book | Roman, shown in Sinhala script |
| dpd | – | tipitaka.app: DPD (CC BY-NC-SA 4.0), 1.2M inflected forms | Roman lemmas |
| sinhala-english | sinhala_to_english | `data/dicts/sinhala_to_english.txt` (from `english-dict.json`) | Sinhala |
| english-sinhala | english_to_sinhala | `data/dicts/english_to_sinhala.txt` (from `english-dict.json`) | English |

* **Text format**: entries separated by blank lines, the headword on the first line, the meaning on the next ones.
  Markup (`build/dicts/text.ts`, tests in `text.test.ts`): labels → `<abbr data-a>` when in `data/abbrev/<code>.json`
  (else `<span class="gram">`, counted in the report), sense numbers, breakups `[a+b]`, see references `X බ.` and the
  English↔Sinhala senses → `<a data-dict>` when the target is a headword.
* **The report** lists the labels not in the abbreviation lists and the see references without a headword: data work
  for M3 (`data/dict-fixes/`).
* **Cleaning and fixes (M3)**, applied by `readTextDict` to the text dictionaries:
  * `cleanLine`: Unicode NFC, ෆ typed as `fප` (an old font conversion), joiners that join nothing, invisible
    characters, spaces around punctuation (`X ; Y`, `(නා. )`), doubled punctuation. About 15.5k entries change, most
    of them sankshiptha's ` ;`.
  * `data/dict-fixes/<code>.tsv` (headword, text, replacement): hand and AI fixes of one entry. The build report lists
    fixes that no longer match.
  * `data/dict-fixes/senses.tsv` (sense, corrected sense): a Sinhala sense of English-Sinhala corrected everywhere, on
    every English entry and as the Sinhala-English headword (entries that meet are merged).
  * `npm run dict:scan` (`build/m3-scan.py`): a read-only scan of the source text, counts and samples →
    `.cache/reports/m3-scan.md`.
  * `npm run dict:ai -- flagged | pilot | apply | report` (`scripts/dict-ai.ts`): Claude on the plan (`claude -p`, cached in
    `.cache/dict-ai`) proposes exact replacements → `data/dict-ai/review.jsonl` (committed) → `apply` writes the tsv
    files; `report` → `.cache/reports/dict-ai.md`. A fix to drop: set its `kind` to `reject` in review.jsonl, then `apply`.
* **Fixture**: `npm run build:dict:fixture` → `e2e/fixtures/db/dict.db` (committed, ~0.7 MB): the headwords of
  `e2e/fixtures/words.txt` and the DPD forms listed there (`~form`). Used by `go test` and the e2e tests.
* **lastmod** of the sitemaps: a headword keeps the date of the previous build while its entries are unchanged.
* **Parity**: `npm run parity` checks that every word of the v1 db (`legacy/server-data/all-dict.db`) has a page
  (2026-11-01: all Sinhala and English words; 67 of 42k Pali words were v1 misspellings that tipitaka.app's data corrected).
