# Deploying

Droplet `tipitaka.lk` (1 CPU, 1 GB RAM, shared with tipitaka.app and tipitaka.lk), nginx `arutha.lk.conf` →
127.0.0.1:3000 (unchanged from v1).

1. `npm run build:dict` (needs `../cst/db/dict.db`).
2. `scripts/deploy.sh` prints the plan. `scripts/deploy.sh --stage` uploads a release and runs it on 127.0.0.1:3001
   (live site untouched, no sudo): `ssh -L 3001:127.0.0.1:3001 tipitaka.lk`, then http://localhost:3001. Stop it with
   `ssh tipitaka.lk 'kill $(cat www/arutha.lk/stage.pid)'`.
3. `scripts/deploy.sh --go`: points `~/www/arutha.lk/current` at the release, installs the units
   (`server/arutha_lk.service`, the watchdog timer) when they changed, restarts and waits for `/api/health` to report
   the new content hash. The db is uploaded zstd compressed (only when new) and shared by releases.
   The restart needs no password with this sudoers rule (once; installing changed units still asks):
   ```
   ssh -t tipitaka.lk 'echo "janaka ALL=(root) NOPASSWD: /usr/bin/systemctl restart arutha_lk" | sudo tee /etc/sudoers.d/arutha-deploy >/dev/null \
     && sudo chmod 440 /etc/sudoers.d/arutha-deploy && sudo visudo -cf /etc/sudoers.d/arutha-deploy'
   ```
4. `~/www/arutha.lk/stats.env` with `STATS_PASSWORD=...` for https://arutha.lk/stats.

## The first v3 deploy (cutover)
The v1 files stay where they are (`~/www/arutha.lk/arutha_lk_linux_intel`, `dist/`, `server-data/`); v3 lives in
`releases/` and `current`. `--go` replaces the v1 unit with the v3 one (same name, same port). Rollback to v1:
```
scp legacy/server/arutha_lk.service tipitaka.lk:/tmp/ && ssh -t tipitaka.lk 'sudo install -m 644 /tmp/arutha_lk.service /etc/systemd/system/ \
  && sudo systemctl daemon-reload && sudo systemctl restart arutha_lk'
```
After a few weeks: `rm -rf ~/www/arutha.lk/{arutha_lk_linux_intel,dist,server-data}`.
Then: resubmit https://arutha.lk/sitemap.xml in Search Console (the v1 sitemap.txt redirects to it) and record the
numbers in `dev-docs/seo.md`.

## pitaka.lk/dict → arutha.lk
Into `pitaka.lk/nginx/pitaka.lk.conf` (server block of pitaka.lk, before the regex locations; `^~` wins over them),
after v3 runs on arutha.lk:
```nginx
    # the dictionary moved to arutha.lk (2026-11)
    location = /dict { return 301 https://arutha.lk/dict/pali; }
    location ^~ /dict/ {
        location = /dict/intro.html {
            if ($arg_goto = usage) { return 301 https://arutha.lk/about#help; }
            if ($arg_goto = abbre) { return 301 https://arutha.lk/abbreviations/pali_buddhadatta; }
            if ($arg_goto = download) { return 301 https://arutha.lk/about#apps; }
            return 301 https://arutha.lk/dict/pali;
        }
        location = /dict/intro_sumangala.pdf { return 301 https://arutha.lk/dict/intro_sumangala.pdf; }
        return 301 https://arutha.lk/dict/pali;
    }
```
Installed 2026-11-01 (pitaka.lk `nginx/pitaka.lk.conf`, `dict` removed from its `dev/deploy.sh`). The sitemap
https://arutha.lk/sitemap.xml was submitted to Search Console the same day (API, webmasters scope).

## Load
`server/guard.go` (from tipitaka.app): at most 2 page renders and 2 searches at once; a crawler gets 503 +
Retry-After when busy, a person the app shell. `/api/health` → `load`. Unit: `MemoryHigh=250M`, `MemoryMax=350M`,
restart always; the watchdog restarts a server that does not answer `/api/health` three times.
