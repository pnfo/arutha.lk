// Gets the editable App Store version of ශබ්දකෝෂය (ASC_APP) ready: the texts of release/store/listing.mjs (the App Store
// has no Sinhala listing and rejects Sinhala letters: appStoreDescription), the name, subtitle and privacy policy
// of the app, and the newest processed build (BUILD picks one); then with --submit sends it for review (with the
// screenshots of asc-screenshots.mjs). From pitaka.lk dev/apple.
//   ASC_APP=<id> node scripts/asc/asc-submit.mjs [--submit]
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { api, APP, editableVersion } from './asc.mjs'
import { appStoreDescription, appStoreName, check, listing, marketingUrl, privacyUrl, reviewNotes, reviewVideo, supportUrl } from '../../release/store/listing.mjs'

const LOCALE = 'en-US', en = listing['en-US']
if (check().length) throw new Error(check().join('\n'))
const description = appStoreDescription // no Sinhala letters: App Store Connect rejects them

const version = await editableVersion()
const first = (await api('GET', `/v1/apps/${APP}/appStoreVersions?filter[appStoreState]=READY_FOR_SALE&limit=1`)).data.length === 0
const loc = (await api('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data.find(l => l.attributes.locale === LOCALE)
if (!loc) throw new Error(`no ${LOCALE} localization`)
await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, { data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: {
  description, promotionalText: en.promo, keywords: en.keywords, supportUrl, marketingUrl,
  ...(first ? {} : { whatsNew: en.whatsNew }) } } }) // no "what's new" on the first version
console.log('texts', LOCALE)
await api('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id,
  attributes: { copyright: `© ${new Date().getFullYear()} Path Nirvana Foundation` } } })
console.log('copyright')

// App Review notes: the answers to Guideline 2.1 "Information Needed", and the screen recording as an attachment
const detail = (await api('GET', `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data
await api('PATCH', `/v1/appStoreReviewDetails/${detail.id}`, { data: { type: 'appStoreReviewDetails', id: detail.id, attributes: { notes: reviewNotes } } })
console.log('review notes')
{
  const file = readFileSync(reviewVideo), fileName = basename(reviewVideo)
  const checksum = createHash('md5').update(file).digest('hex')
  const old = (await api('GET', `/v1/appStoreReviewDetails/${detail.id}/appStoreReviewAttachments`)).data
  if (old.some(a => a.attributes.fileName === fileName && a.attributes.sourceFileChecksum === checksum)) console.log('review video: unchanged')
  else {
    for (const a of old.filter(a => a.attributes.fileName === fileName)) await api('DELETE', `/v1/appStoreReviewAttachments/${a.id}`)
    const att = (await api('POST', '/v1/appStoreReviewAttachments', { data: { type: 'appStoreReviewAttachments', attributes: { fileName, fileSize: file.length },
      relationships: { appStoreReviewDetail: { data: { type: 'appStoreReviewDetails', id: detail.id } } } } })).data
    for (const op of att.attributes.uploadOperations) {
      const r = await fetch(op.url, { method: op.method, headers: Object.fromEntries(op.requestHeaders.map(h => [h.name, h.value])),
        body: file.subarray(op.offset, op.offset + op.length) })
      if (!r.ok) throw new Error(`upload ${fileName}: ${r.status} ${await r.text()}`)
    }
    await api('PATCH', `/v1/appStoreReviewAttachments/${att.id}`, { data: { type: 'appStoreReviewAttachments', id: att.id,
      attributes: { uploaded: true, sourceFileChecksum: checksum } } })
    console.log('review video', fileName, `${(file.length / 1e6).toFixed(1)} MB`)
  }
}

// subtitle and privacy policy: the app info that can be edited
const info = (await api('GET', `/v1/apps/${APP}/appInfos`)).data.find(i => !['READY_FOR_DISTRIBUTION', 'REPLACED_WITH_NEW_INFO'].includes(i.attributes.state ?? i.attributes.appStoreState))
if (info) {
  const iloc = (await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find(l => l.attributes.locale === LOCALE)
  if (iloc) {
    await api('PATCH', `/v1/appInfoLocalizations/${iloc.id}`, { data: { type: 'appInfoLocalizations', id: iloc.id,
      attributes: { name: appStoreName, subtitle: en.subtitle, privacyPolicyUrl: privacyUrl } } })
    console.log('name, subtitle, privacy policy')
  }
}

const builds = (await api('GET', `/v1/builds?filter[app]=${APP}&filter[processingState]=VALID&filter[preReleaseVersion.version]=${version.attributes.versionString}` +
  `${process.env.BUILD ? `&filter[version]=${process.env.BUILD}` : ''}&sort=-uploadedDate&limit=1`)).data
if (!builds.length) throw new Error(`no processed build of ${version.attributes.versionString}`)
await api('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: 'builds', id: builds[0].id } })
console.log('build', builds[0].attributes.version)

if (process.argv.includes('--submit')) {
  // one that a failed run left open, or a new one
  const sub = (await api('GET', `/v1/reviewSubmissions?filter[app]=${APP}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW`)).data[0]
    ?? (await api('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP } } } } })).data
  await api('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems',
    relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } })
  await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } })
  console.log('submitted for review', version.attributes.versionString)
}
