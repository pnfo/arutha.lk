// Store screenshots (from tipitaka.app): six features of the app, each with a bilingual caption (Sinhala title, English
// line) on the maroon and gold of the icon, rendered from the web build by the server (the apps show the same UI) at
// the sizes of each store, all portrait (the app is a reading column).
//   npm run build:web && npm run build:server && node scripts/store-screenshots.mjs [output…]
//   -> release/store-screenshots/<output>/<n>-<scene>.png
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'release/store-screenshots')
const PORT = 3417, BASE = `http://127.0.0.1:${PORT}`
const FONTS = pathToFileURL(join(ROOT, 'web/src/assets/fonts')).href

/** store image sizes; css: the width of the screen the app is shown at (phone or tablet layout) */
const OUTPUTS = {
  'play-phone': { w: 1080, h: 1920, css: 390 },
  'play-tablet-7': { w: 1200, h: 1920, css: 640 },
  'play-tablet-10': { w: 1600, h: 2560, css: 800 },
  'apple-iphone-6.9': { w: 1320, h: 2868, css: 400 },
  'apple-ipad-13': { w: 2064, h: 2752, css: 900 },
}

const SCENES = [
  { id: 'word', title: 'වචනයක සියලු අර්ථ එකම පිටුවක', sub: 'Every dictionary on one page – offline' },
  { id: 'singlish', title: 'සිංග්ලිෂ් වලින්ද ලියන්න', sub: 'Type in Sinhala, Singlish or English' },
  { id: 'pali', title: 'පාලි විභක්ති රූපයකින් වුවද', sub: 'Any Pali word form, with its grammar (DPD)' },
  { id: 'english', title: 'ඉංග්‍රීසි – සිංහල – ඉංග්‍රීසි', sub: 'English–Sinhala and Sinhala–English' },
  { id: 'reverse', title: 'තේරුම් තුළින්ද සොයයි', sub: 'Finds words by their meanings too' },
  { id: 'themes', title: 'සුදු, පුස්කොළ, අඳුරු', sub: 'Light, sepia and dark – no ads, no accounts' },
]

let browser
async function appPage(css, cssH, { theme = 'light', textSize = 18 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: css, height: cssH }, deviceScaleFactor: 3, isMobile: css < 600, hasTouch: css < 600 })
  await ctx.addInitScript(s => {
    localStorage.setItem('arutha-settings-1', JSON.stringify(s))
    localStorage.setItem('arutha-migrated-1', '1')
    // as in the apps: no store links (main.ts .native)
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('native'))
  }, { theme, textSize })
  return ctx.newPage()
}
async function open(page, path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
}
const enc = encodeURIComponent
const shot = async (page, file) => { await page.screenshot({ path: file }); await page.context().close(); return file }

/** the app screen(s) of a scene: an image file, or [{file}] for the three themes */
async function render(scene, css, cssH, dir) {
  const file = join(dir, `${scene.id}.png`)
  switch (scene.id) {
    case 'word': {
      const p = await appPage(css, cssH)
      await open(p, '/' + enc('ධම්ම'))
      return shot(p, file)
    }
    case 'singlish': {
      const p = await appPage(css, cssH)
      await open(p, '/')
      await p.getByTestId('search-input').fill('budu')
      await p.getByTestId('search-menu').waitFor(); await p.waitForTimeout(500)
      return shot(p, file)
    }
    case 'pali': {
      const p = await appPage(css, cssH)
      await open(p, '/search/buddhassa')
      return shot(p, file)
    }
    case 'english': {
      const p = await appPage(css, cssH)
      await open(p, '/love')
      return shot(p, file)
    }
    case 'reverse': {
      const p = await appPage(css, cssH)
      await open(p, '/search/' + enc('අම්මා'))
      await p.evaluate(() => { const r = [...document.querySelectorAll('[data-testid=result]')]; r[Math.min(2, r.length - 1)]?.scrollIntoView() })
      await p.waitForTimeout(300)
      return shot(p, file)
    }
    case 'themes': { // the same page in three themes, a third of the screen each
      const parts = []
      for (const theme of ['light', 'sepia', 'dark']) {
        const p = await appPage(css, cssH, { theme })
        await open(p, '/' + enc('ධර්මය'))
        parts.push(await shot(p, join(dir, `themes-${theme}.png`)))
      }
      return parts.map(f => ({ file: f }))
    }
  }
}

function frameHtml(o, scene, img) {
  const band = Math.round(o.h * 0.2)
  const title = Math.round(o.w * 0.066), sub = Math.round(title * 0.5)
  const mx = Math.round(o.w * 0.07), radius = Math.round(o.w * 0.035)
  const boxW = o.w - 2 * mx, boxH = o.h - band
  const body = typeof img === 'string' ? `<img class="screen" src="${pathToFileURL(img).href}">`
    : `<div class="screen split">${img.map(c => `<div><img src="${pathToFileURL(c.file).href}"></div>`).join('')}</div>`
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Si; src: url('${FONTS}/AbhayaUni-Bold.woff2'); font-weight: 700 }
    @font-face { font-family: Serif; src: url('${FONTS}/NotoSerif-Regular.woff2'); font-weight: 400 }
    html, body { margin: 0; width: ${o.w}px; height: ${o.h}px; overflow: hidden }
    body { background: radial-gradient(ellipse at 50% 0%, #9a2a36 0%, #7a1824 45%, #4a0e16 100%); position: relative }
    .caption { position: absolute; left: 0; right: 0; top: 0; height: ${band}px; display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center; padding: 0 ${mx}px; box-sizing: border-box }
    h1 { margin: 0; font: 700 ${title}px Si, serif; color: #fbe7b5; line-height: 1.25 }
    p { margin: ${Math.round(sub * 0.45)}px 0 0; font: 400 ${sub}px Serif, Georgia, serif; color: #f3cf7a; line-height: 1.3 }
    .screen { position: absolute; left: ${mx}px; top: ${band}px; width: ${boxW}px; height: ${boxH + radius}px; object-fit: cover;
      object-position: top; border-radius: ${radius}px; box-shadow: 0 ${radius}px ${radius * 3}px rgba(0,0,0,.45); background: #fdfbf7 }
    .split { display: flex; overflow: hidden }
    .split > div { flex: 1; overflow: hidden } .split img { width: 300%; height: auto; display: block }
    .split > div:nth-child(2) img { margin-left: -100% } .split > div:nth-child(3) img { margin-left: -200% }
  </style></head><body><div class="caption"><h1>${scene.title}</h1><p>${scene.sub}</p></div>${body}</body></html>`
}

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(OUTPUTS)
const server = spawn(join(ROOT, 'server/bin/arutha_lk'), ['-listen', `127.0.0.1:${PORT}`], { cwd: ROOT, stdio: 'ignore' })
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)) }
  browser = await chromium.launch()
  for (const name of want) {
    const o = OUTPUTS[name], dir = join(OUT, name), raw = join(OUT, '.raw', name)
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); mkdirSync(raw, { recursive: true })
    const mx = Math.round(o.w * 0.07), band = Math.round(o.h * 0.2)
    const cssH = Math.round(o.css * (o.h - band) / (o.w - 2 * mx)) // the screen fills the frame below the caption
    for (const [n, scene] of SCENES.entries()) {
      const img = await render(scene, o.css, cssH, raw)
      const html = join(raw, `${scene.id}.html`); writeFileSync(html, frameHtml(o, scene, img))
      const page = await browser.newPage({ viewport: { width: o.w, height: o.h } })
      await page.goto(pathToFileURL(html).href); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200)
      await page.screenshot({ path: join(dir, `${n + 1}-${scene.id}.png`) }); await page.close()
    }
    console.log('wrote', dir)
  }
} finally {
  await browser?.close()
  server.kill()
}
