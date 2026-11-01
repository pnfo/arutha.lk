// The farewell release of the arutha.lk app (lk.arutha.dictionary, /Volumes/2TB/Android/Arutha.lk, 1.4): the dictionary
// is now the ශබ්දකෝෂය app (lk.pitaka.dictionary). In one edit: the si-LK listing gets a notice at the top, and the
// bundle goes to production (from pitaka.lk dev/play/dhammapada-farewell.mjs):
//   node scripts/play/play-farewell.mjs [--dry]     (--dry uploads, then drops the edit)
process.env.PACKAGE = 'lk.arutha.dictionary'
import { readFileSync } from 'node:fs'
const { api } = await import('./play.mjs')

const AAB = process.env.AAB || '/Volumes/2TB/Android/Arutha.lk/app/build/outputs/bundle/release/app-release.aab'
const LANG = 'si-LK', NEW_APP = 'https://play.google.com/store/apps/details?id=lk.pitaka.dictionary'
const NOTICE = `මෙම ශබ්දකෝෂය දැන් “ශබ්දකෝෂය” app එකේ, පාලි ශබ්දකෝෂ සහ Digital Pāḷi Dictionary සමඟ ඇත: ${NEW_APP}
මෙම app එක තවදුරටත් යාවත්කාලීන නොකෙරේ.`
const NOTES = `මෙම ශබ්දකෝෂය දැන් “ශබ්දකෝෂය” app එකේ (lk.pitaka.dictionary) – සිංහල, ඉංග්‍රීසි සහ පාලි ශබ්දකෝෂ, තරු ලකුණු සහ අඳුරු වර්ණ සමඟ.
මෙම app එක තවදුරටත් යාවත්කාලීන නොකෙරේ.`

const e = `/edits/${(await api('POST', '/edits')).id}`
try {
  const listing = await api('GET', `${e}/listings/${LANG}`).catch(() => null)
  if (listing) {
    const body = listing.fullDescription.includes('“ශබ්දකෝෂය” app එකේ') ? listing.fullDescription.split('\n\n').slice(1).join('\n\n') : listing.fullDescription
    const fullDescription = `${NOTICE}\n\n${body}`
    const shortDescription = 'මෙම ශබ්දකෝෂය දැන් “ශබ්දකෝෂය” app එකේ. මෙය තවදුරටත් යාවත්කාලීන නොකෙරේ.'
    if ([...shortDescription].length > 80 || [...fullDescription].length > 4000) throw new Error('too long')
    await api('PUT', `${e}/listings/${LANG}`, { ...listing, shortDescription, fullDescription })
    console.log('listing', LANG)
  } else console.log(`no ${LANG} listing: only the release`)
  const bundle = await api('POST', `${e}/bundles`, { bytes: readFileSync(AAB), type: 'application/octet-stream' })
  console.log('bundle', bundle.versionCode)
  await api('PUT', `${e}/tracks/production`, { track: 'production', releases: [{ status: 'completed', versionCodes: [String(bundle.versionCode)],
    releaseNotes: [{ language: LANG, text: NOTES }] }] })
  if (process.argv.includes('--dry')) {
    await api('DELETE', e)
    console.log('dry run: edit dropped')
  } else {
    await api('POST', `${e}:commit`).catch(err => {
      if (!/changesNotSentForReview/.test(err.message)) throw err
      return api('POST', `${e}:commit?changesNotSentForReview=true`).then(() => console.log('not sent for review: send it in the Play console'))
    })
    console.log('production committed')
  }
} catch (err) {
  await api('DELETE', e).catch(() => {})
  throw err
}
