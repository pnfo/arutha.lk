// Renders design/brand/<concept>/*.svg to png with Chromium, and design/brand/compare.png (all concepts side by side)
//   node design/tools/render.mjs        (needs playwright: uses ../cst/node_modules until arutha has its own)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { chromium } = await import(fs.existsSync(`${root}/node_modules/playwright`) ? 'playwright' : '/Volumes/2TB/node/cst/node_modules/playwright/index.mjs')
const brand = `${root}/design/brand`
// svg -> [png name, width, height]
const outputs = {
    'icon-square': [['icon-1024', 1024], ['play-512', 512], ['apple-touch-180', 180]],
    'icon-rounded': [['pwa-192', 192], ['pwa-512', 512]],
    'icon-maskable': [['maskable-512', 512]],
    'adaptive-foreground': [['adaptive-foreground-432', 432]],
    'adaptive-background': [['adaptive-background-432', 432]],
    'favicon': [['favicon-32', 32], ['favicon-48', 48]],
    'og': [['og-1200x630', 1200, 630]],
    'feature-graphic': [['feature-1024x500', 1024, 500]],
}
const browser = await chromium.launch()
const page = await browser.newPage()
const concepts = ['icon']
const png = (c, n) => 'data:image/png;base64,' + fs.readFileSync(`${brand}/${c}/${n}.png`).toString('base64')
for (const c of concepts) {
    for (const [src, list] of Object.entries(outputs)) {
        const svg = fs.readFileSync(`${brand}/${c}/${src}.svg`, 'utf8')
        for (const [name, w, h = w] of list) {
            await page.setViewportSize({ width: w, height: h })
            await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg style="width:${w}px;height:${h}px;display:block" `)}</body>`)
            await page.screenshot({ path: `${brand}/${c}/${name}.png`, omitBackground: true })
        }
    }
}
// comparison sheet: a phone home screen row (with an adaptive mask), browser tab, og card
const col = c => `<div class="col"><h2>${c}</h2>
  <div class="phone">${['', '', ''].map(() => '<i></i>').join('')}<b><img src="${png(c, 'maskable-512')}" class="circle"><span>ශබ්දකෝෂය</span></b>
    <b><img src="${png(c, 'pwa-192')}"><span>arutha.lk</span></b>${['', ''].map(() => '<i></i>').join('')}</div>
  <div class="tab"><img src="${png(c, 'favicon-32')}" width="16"> අරුත.lk සිංහල ශබ්දකෝෂය <span>×</span></div>
  <img src="${png(c, 'og-1200x630')}" class="og"><img src="${png(c, 'feature-1024x500')}" class="og"></div>`
await page.setViewportSize({ width: 1500, height: 900 })
await page.setContent(`<style>body{margin:0;padding:20px;background:#e9e9ee;font:14px sans-serif;display:flex;gap:24px}
  .col{width:470px} h2{margin:0 0 8px} .phone{display:flex;flex-wrap:wrap;gap:14px;padding:16px;border-radius:24px;background:linear-gradient(#3a4b6b,#7f6a8f);width:438px;box-sizing:border-box}
  .phone i{width:64px;height:64px;border-radius:50%;background:#ffffff33} .phone b{width:64px;text-align:center;color:#fff;font-weight:normal;font-size:10px}
  .phone img{width:64px;height:64px;display:block} .circle{border-radius:50%} .tab{margin:12px 0;background:#fff;border-radius:10px 10px 0 0;padding:8px 12px;display:flex;gap:8px;align-items:center;width:300px}
  .tab span{margin-left:auto;color:#888} .og{width:470px;display:block;margin-bottom:10px;border-radius:8px}</style>${concepts.map(col).join('')}`)
await page.screenshot({ path: `${brand}/compare.png`, fullPage: true })
await browser.close()
console.log('rendered', concepts.join(', '))
