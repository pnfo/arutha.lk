# Architecture (v3)

```
data/dicts/*.txt (Sinhala, English↔Sinhala)      ../cst/db/dict.db (tipitaka.app: DPD + the Pali-Sinhala dictionaries)
data/abbrev/*.json, data/bookpages.tsv                   │ (data/cst.lock: which build)
        └──────────────── npm run build:dict (build/, Node + better-sqlite3) ─┘
                                        ▼
db/dict.db   dict, entry, dict_abbrev, dpd_head/root/lookup (tipitaka.app's schema) + headword, hkey, meaning_fts, bookpage
        │
server/engine (Go)   suggest · search · word · browse · dictpage · lookup — JSON in, JSON out (Call / QueryJSON)
  ├── server/        website: GET /api/<op>, SSR-lite, sitemaps, robots, v1 redirects, stats, static web/dist
  └── server/mobile  gomobile bind → Android AAR / iOS xcframework (M2: the apps run the same engine next to the db)
web/     Vue 3 + TypeScript + Pinia + vue-router + Tailwind 3.4 (+ DOMPurify, unhead); VITE_APP=1 → web/dist-app
shared/  pure TS used by build, web and tests: normalize.ts (keys, tokens; = server/engine/keys.go), reserved.json
```

The architecture is tipitaka.app's (`../cst/dev-docs/architecture.md`); the v1 site (Vue JS, Go Fiber, a raw SQL
endpoint, `legacy/`) is replaced.

## Key decisions
* **One engine, no client SQL.** v1's `POST /sql-query` ran any SQL from the browser. The engine has a fixed set of
  operations (`server/engine/call.go`), the same on the server and in the apps.
* **Pali data comes from tipitaka.app.** `build/dicts/cst.ts` copies DPD and the two Pali-Sinhala dictionaries out of
  `../cst/db/dict.db`; `server/engine/{dict,normalize,lru}.go` are verbatim copies of tipitaka.app's
  (`scripts/check-sync.sh`), so a Pali word is analysed the same way in both.
* **A page per headword.** `headword` holds every displayed form (Pali in Sinhala script, English lower case); the
  page `/<word>` shows all dictionaries. Words that are also routes (`shared/reserved.json`) are at `/word/<word>`.
  Other spellings (Roman Pali, upper case, without the ZWJ of a yansaya) redirect to the canonical page.
* **Keys** (`shared/normalize.ts` key = `server/engine/keys.go` Key, golden vectors in `shared/normalize.golden.json`):
  NFC, lower case, diacritics folded, ZWJ/ZWNJ removed (ක්‍රි = ක්රි). Pali headwords also have their Roman key.
* **Search tiers** (`server/engine/search.go`): the headword · DPD inflected form → its headwords (and their entries
  in the Sinhala Pali dictionaries) · the Sinhala spellings of a Singlish query (`github.com/pnfo/singlish-search`, the
  Go port of the npm package) · prefixes · a Sinhala case ending removed · the words of the meanings (FTS4: the reverse
  lookup, English or Sinhala → Pali and back). A final `.` means the headword only; `%` `*` `?` are wildcards (v1).
  Results are paged with no cap (the engine caches the ranked list).
* **FTS4 with the simple tokenizer** over pre-tokenised text (`ftsTokens`): it is compiled into mattn/go-sqlite3 by
  default, so the server and gomobile behave the same; unicode61 would split Sinhala words at the vowel signs.
* **Frozen book pages.** `/bookpage/<v1 dict>/<page>` brought 88% of the search impressions of 2025-26: the page
  boundaries of v1 are kept in `data/bookpages.tsv` (`scripts/freeze-bookpages.ts`), a page shows the headwords from its
  first word to the next page's, whatever the data becomes.
* **SSR-lite** (`server/ssr.go`): title, description, canonical, JSON-LD (`DefinedTerm`), `<article id="ssr">` with the
  meanings and links (crawlers, no JS), `<script id="ssr-data">` with the API response (the app starts without a
  request). `seo.go`: robots, sitemap index of pages / bookpage / words-N / pali-N (with lastmod).
* **Interface text** is a mix of Sinhala and the English words people know (`web/src/strings.ts`).
* **Old devices**: Tailwind 3.4, legacy build for Chrome 53 / iOS 12, `npm run check:css` for WebView 64+.
* **Privacy**: no ads, no third party analytics; `server/stats.go` (from tipitaka.app) keeps anonymous daily counts.

## Source map
| area | files |
|---|---|
| data build | `build/dict.ts` (schema, headwords, keys, FTS, bookpages), `build/dicts/text.ts` (txt format + markup), `build/dicts/cst.ts` |
| engine | `server/engine/search.go` (suggest, search), `word.go` (word page, browse, dict page), `sitemap.go`, `keys.go`, `call.go` |
| server | `server/main.go`, `api.go`, `ssr.go`, `seo.go`, `static.go`, `guard.go`, `stats.go` |
| web | `web/src/views/{Word,Search,Browse,DictLanding,...}.vue`, `components/{SearchBox,EntryGroups,MeaningHtml,DpdHeadword}.vue`, `data/api.ts`, `stores/{settings,words,migrate}.ts` |
| v1 migration | `web/src/stores/migrate.ts` (localStorage), `server/ssr.go` (old urls), `scripts/parity-v1.ts` (every v1 word has a page) |
