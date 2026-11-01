// The launcher icons of the Android app from design/brand/icon/*.svg:
//   node design/tools/android-icons.mjs <android project>/app/src/main/res
// mipmap-<density>/ic_launcher(_round).png (legacy, 48dp), ic_launcher_{foreground,background,monochrome}.png (adaptive,
// 108dp) and mipmap-anydpi-v26/ic_launcher(_round).xml.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { chromium } = await import(`${root}/node_modules/playwright/index.mjs`)
const res = process.argv[2]
if (!res) { console.error('usage: node design/tools/android-icons.mjs <res dir>'); process.exit(2) }
const icon = f => fs.readFileSync(`${root}/design/brand/icon/${f}.svg`, 'utf8')
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const LAYERS = [['ic_launcher', 'icon-rounded', 48], ['ic_launcher_round', 'icon-round', 48], ['ic_launcher_foreground', 'adaptive-foreground', 108],
  ['ic_launcher_background', 'adaptive-background', 108], ['ic_launcher_monochrome', 'adaptive-monochrome', 108]]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [d, k] of Object.entries(DENSITIES)) {
  fs.mkdirSync(`${res}/mipmap-${d}`, { recursive: true })
  for (const [name, src, dp] of LAYERS) {
    const px = Math.round(dp * k)
    await page.setViewportSize({ width: px, height: px })
    await page.setContent(`<body style="margin:0">${icon(src).replace('<svg ', `<svg style="width:${px}px;height:${px}px;display:block" `)}</body>`)
    await page.screenshot({ path: `${res}/mipmap-${d}/${name}.png`, omitBackground: true })
  }
}
await browser.close()
fs.mkdirSync(`${res}/mipmap-anydpi-v26`, { recursive: true })
const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`
for (const n of ['ic_launcher', 'ic_launcher_round']) fs.writeFileSync(`${res}/mipmap-anydpi-v26/${n}.xml`, xml)
console.log('icons written to', res)
