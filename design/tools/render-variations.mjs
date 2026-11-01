// design/brand/letter-variations/compare-<font>.png: a font's palettes: icon, small sizes, title bar on white and dark
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { chromium } = await import(`${root}/node_modules/playwright/index.mjs`)
const dir = `${root}/design/brand/letter-variations`
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg') && !f.includes('--title'))
const fonts = [...new Set(files.map(f => f.split('--')[0]))]
const uri = f => 'data:image/svg+xml;base64,' + fs.readFileSync(`${dir}/${f}`).toString('base64')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 300 } })
for (const font of fonts) {
  const rows = files.filter(f => f.startsWith(font + '--')).sort().map((f, i) => {
    const n = f.replace('.svg', ''), pal = n.split('--')[1]
    return `<tr><td class="n">${String.fromCharCode(65 + i)}. ${pal}</td><td><img src="${uri(f)}" class="ic"></td>
      <td><img src="${uri(f)}" class="s48"> <img src="${uri(f)}" class="s24"></td>
      <td><div class="bar"><img src="${uri(n + '--title.svg')}" style="height:40px"></div></td>
      <td><div class="bar dark"><img src="${uri(n + '--title.svg')}" style="height:40px"></div></td>
      <td class="home"><img src="${uri(f)}" class="s48 r"></td></tr>`
  })
  await page.setContent(`<style>body{font:14px sans-serif;margin:16px;background:#eee}h2{margin:0 0 8px}td{padding:6px 10px}.n{font-weight:bold;width:130px}
    .ic{width:110px;border-radius:24px;box-shadow:0 1px 4px #0003}.s48{width:48px;border-radius:11px;vertical-align:middle;box-shadow:0 1px 3px #0003}
    .s24{width:24px;border-radius:5px;vertical-align:middle;box-shadow:0 1px 2px #0003}.bar{background:#fff;padding:10px 14px;border-radius:8px;width:220px}
    .bar.dark{background:#211e1a}.home{background:linear-gradient(#3a4b6b,#7f6a8f);border-radius:14px;padding:10px 20px}.r{border-radius:50%}</style>
    <h2>${font}</h2><table>${rows.join('')}</table>`)
  await page.screenshot({ path: `${dir}/compare-${font}.png`, fullPage: true })
}
await browser.close()
console.log(fonts.join(', '))
