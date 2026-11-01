// Uploads the signed bundle of the app (/Volumes/2TB/Android/Dictionary-v3, ./gradlew bundleRelease) and releases it on
// a track (TRACK, default production) with the notes of release/store/listing.mjs; the Play review follows the commit:
//   node scripts/play/play-release.mjs [--dry]     (--dry uploads, then drops the edit: nothing is released)
import { readFileSync } from 'node:fs'
import { api, PACKAGE } from './play.mjs'
import { listing } from '../../release/store/listing.mjs'

const AAB = process.env.AAB || '/Volumes/2TB/Android/Dictionary-v3/app/build/outputs/bundle/release/app-release.aab'
const TRACK = process.env.TRACK || 'production'

const e = `/edits/${(await api('POST', '/edits')).id}`
try {
  const bundle = await api('POST', `${e}/bundles`, { bytes: readFileSync(AAB), type: 'application/octet-stream' })
  console.log(PACKAGE, 'bundle', bundle.versionCode)
  await api('PUT', `${e}/tracks/${TRACK}`, { track: TRACK, releases: [{ status: 'completed', versionCodes: [String(bundle.versionCode)],
    releaseNotes: Object.entries(listing).map(([language, l]) => ({ language, text: l.whatsNew })) }] })
  if (process.argv.includes('--dry')) {
    await api('DELETE', e)
    console.log('dry run: edit dropped')
  } else {
    // Play sometimes refuses to send an edit for review itself: it is then sent from the console (Publishing overview)
    await api('POST', `${e}:commit`).catch(err => {
      if (!/changesNotSentForReview/.test(err.message)) throw err
      return api('POST', `${e}:commit?changesNotSentForReview=true`).then(() => console.log('not sent for review: send it in the Play console'))
    })
    console.log(TRACK, 'committed')
  }
} catch (err) {
  await api('DELETE', e).catch(() => {})
  throw err
}
