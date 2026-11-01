// The Google Play listing of the app (lk.pitaka.dictionary), si-LK and en-US: the texts of release/store/listing.mjs, the
// screenshots of scripts/store-screenshots.mjs (play-phone, play-tablet-7, play-tablet-10), the feature graphic and the
// icon (design/brand/icon), all in one edit:
//   node scripts/play/play-listing.mjs [--dry]     (--dry checks the texts and lists the images only)
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, listing } from '../../release/store/listing.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = join(ROOT, 'release/store-screenshots'), BRAND = join(ROOT, 'design/brand/icon')
const IMAGES = [['phoneScreenshots', join(SHOTS, 'play-phone')], ['sevenInchScreenshots', join(SHOTS, 'play-tablet-7')],
  ['tenInchScreenshots', join(SHOTS, 'play-tablet-10')], ['featureGraphic', join(BRAND, 'feature-1024x500.png')], ['icon', join(BRAND, 'play-512.png')]]
const files = p => p.endsWith('.png') ? [p] : readdirSync(p).filter(f => f.endsWith('.png')).sort().map(f => join(p, f))

const errors = check()
if (errors.length) throw new Error(errors.join('\n'))
for (const [, p] of IMAGES) if (!existsSync(p)) throw new Error(`missing ${p} (node scripts/store-screenshots.mjs, design/tools/render.mjs)`)
if (process.argv.includes('--dry')) {
  for (const [lang, l] of Object.entries(listing)) console.log(`== ${lang}\n${l.title}\n${l.short}\n\n${l.full}\n`)
  for (const [type, p] of IMAGES) console.log(type, files(p).length)
  process.exit(0)
}

const { api, PACKAGE } = await import('./play.mjs')
const e = `/edits/${(await api('POST', '/edits')).id}`
try {
  for (const [language, l] of Object.entries(listing)) {
    await api('PUT', `${e}/listings/${language}`, { language, title: l.title, shortDescription: l.short, fullDescription: l.full })
    for (const [type, p] of IMAGES) {
      await api('DELETE', `${e}/listings/${language}/${type}`)
      for (const f of files(p)) await api('POST', `${e}/listings/${language}/${type}`, { bytes: readFileSync(f), type: 'image/png' })
    }
    console.log(PACKAGE, 'listing', language)
  }
  await api('POST', `${e}:commit`)
  console.log('committed')
} catch (err) {
  await api('DELETE', e).catch(() => {})
  throw err
}
