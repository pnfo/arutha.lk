# arutha.lk – Sinhala · English · Pali dictionary

The website https://arutha.lk and the apps (Android / iOS `lk.pitaka.dictionary`, "ශබ්දකෝෂය"): the Concise Sinhala
Dictionary and the Spelling Dictionary of the Sinhala Dictionary Office, English↔Sinhala, the Pali-Sinhala
dictionaries of Buddhadatta and Sumaṅgala, and the Digital Pāḷi Dictionary (inflections and grammar). It replaces
pitaka.lk/dict. No ads, no accounts.

Go engine + server (`server/`), Vue 3 + TypeScript web app (`web/`), SQLite built by `build/`. See
[dev-docs/architecture.md](dev-docs/architecture.md).

```sh
npm install
npm run build:dict            # db/dict.db (needs ../cst/db/dict.db: tipitaka.app)
npm run build:web && npm run build:server
server/bin/arutha_lk          # http://127.0.0.1:3000
npm run dev                   # vite on :5173, /api proxied to :3000
npm test && npm run test:go && npm run test:e2e
```
Deploy: [dev-docs/deploy.md](dev-docs/deploy.md). The v1 site is in `legacy/` until v3 is live.
