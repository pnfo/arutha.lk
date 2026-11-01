# Testing
* `npm test` (vitest): keys and tokens (golden vectors shared with Go), the text markup, the v1 localStorage
  migration, word urls and the reserved routes (equal to `server/ssr.go`), the meaning sanitiser.
* `npm run test:go`: engine (search tiers, DPD forms in both scripts, Singlish, stems, meanings, paging, filters,
  suggestions, word pages, variants, book pages, the native bridge) and server (pages, SSR head and JSON-LD, redirects of
  v1 urls, sitemaps, escaping, no `/sql-query`) on the fixture db. `FULL=1 go test ./engine -run Full -v`: the full db.
* `npm run test:e2e` (Playwright: chromium, webkit, Pixel 7, iPhone 14, android-sim with a simulated native bridge).
* `npm run check:css` (old WebViews), `npm run check:sync` (shared engine files), `npm run parity` (v1 words).
