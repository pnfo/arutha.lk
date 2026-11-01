// Store listing texts of the app lk.pitaka.dictionary (Play, App Store), si-LK and en-US. Checked by `node release/store/listing.mjs`.
// Used by scripts/play/play-listing.mjs, play-release.mjs and scripts/asc/asc-submit.mjs.

const features = {
  si: `• සංක්ෂිප්ත සිංහල ශබ්දකෝෂය සහ අක්ෂර වින්‍යාස ශබ්දකෝෂය (සිංහල ශබ්දකෝෂ කාර්යාංශය)
• ඉංග්‍රීසි – සිංහල සහ සිංහල – ඉංග්‍රීසි ශබ්දකෝෂ
• බුද්ධදත්ත හිමියන්ගේ පාලි-සිංහල අකාරාදිය සහ සුමඞ්ගල හිමියන්ගේ පාලි-සිංහල ශබ්දකෝෂය
• Digital Pāḷi Dictionary: පාලි වචනයක ඕනෑම විභක්ති රූපයකින් (buddhassa, ධම්මස්ස) මූල වචනය සහ ව්‍යාකරණ
• සිංහල අකුරෙන්, සිංග්ලිෂ් වලින් (akuru → අකුරු) හෝ ඉංග්‍රීසියෙන් ලියන්න – අකුරු ලියන විටම යෝජනා
• වචනය හමු නොවූ විට තේරුම් තුළින්ද සොයයි (අම්මා → මව, ජනිත්‍රී …)
• තරු ලකුණු (bookmarks), history, සුදු / පුස්කොළ / අඳුරු වර්ණ, අකුරු ප්‍රමාණය
• අන්තර්ජාලය නැතිව සියල්ල ක්‍රියා කරයි. දැන්වීම් නැත, ගිණුම් නැත.`,
  en: `• The Concise Sinhala Dictionary and the Sinhala Spelling Dictionary (Sinhala Dictionary Office)
• English–Sinhala and Sinhala–English dictionaries
• The Pali–Sinhala dictionaries of Ven. Buddhadatta and Ven. Sumaṅgala
• The Digital Pāḷi Dictionary: type any inflected Pali form (buddhassa, ධම්මස්ස) and get its headword and grammar
• Type in Sinhala, Singlish (akuru → අකුරු) or English, with suggestions as you type
• Finds words by their meanings too (අම්මා → මව, ජනිත්‍රී …)
• Bookmarks, history, light / sepia / dark themes, text size
• Everything works offline. No ads, no accounts.`,
}

export const listing = {
  'si-LK': {
    title: 'ශබ්දකෝෂය: Sinhala English Pali',
    short: 'සිංහල, ඉංග්‍රීසි, පාලි ශබ්දකෝෂ – අන්තර්ජාලය නැතිවද. arutha.lk',
    full: `සිංහල වචනවල තේරුම්, ඉංග්‍රීසි වචනවල සිංහල තේරුම් සහ පාලි වචනවල අර්ථ එකම තැනකින් – arutha.lk වෙබ් අඩවියේ ශබ්දකෝෂය ඔබගේ දුරකථනයේ, අන්තර්ජාලය නැතිවද.

${features.si}

pitaka.lk පාලි-සිංහල ශබ්දකෝෂ app එකේ සහ arutha.lk app එකේ නව සංස්කරණයයි.
වැරදි හෝ නැති වචන: path.nirvana@gmail.com`,
    whatsNew: 'නව සංස්කරණය: සිංහල, ඉංග්‍රීසි සහ පාලි ශබ්දකෝෂ හතක් එකම app එකක (arutha.lk), පාලි විභක්ති රූප (DPD), සිංග්ලිෂ් යෝජනා, තරු ලකුණු, අඳුරු වර්ණ.',
    // App Store
    subtitle: 'සිංහල ඉංග්‍රීසි පාලි ශබ්දකෝෂ',
    promo: 'සිංහල, ඉංග්‍රීසි සහ පාලි වචනවල තේරුම් එකම තැනකින් – අන්තර්ජාලය නැතිවද. දැන්වීම් නැත.',
    keywords: 'ශබ්දකෝෂය,සිංහල,පාලි,ඉංග්‍රීසි,තේරුම,dictionary,sinhala,pali,english,singlish,arutha,dpd',
  },
  'en-US': {
    title: 'ශබ්දකෝෂය: Sinhala English Pali',
    short: 'Sinhala, English–Sinhala and Pali–Sinhala dictionaries, offline. arutha.lk',
    full: `Sinhala word meanings, English–Sinhala and Sinhala–English, and Pali–Sinhala with the Digital Pāḷi Dictionary – the dictionaries of arutha.lk on your phone, offline.

${features.en}

The new version of the pitaka.lk Pali–Sinhala dictionary app and the arutha.lk app.
Errors or missing words: path.nirvana@gmail.com`,
    whatsNew: 'New: seven Sinhala, English and Pali dictionaries in one app (arutha.lk), Pali inflected forms (DPD), Singlish suggestions, bookmarks, dark theme.',
    subtitle: 'Sinhala English Pali offline',
    promo: 'Sinhala, English–Sinhala and Pali–Sinhala dictionaries in one app – offline, no ads.',
    keywords: 'dictionary,sinhala,pali,english,sinhalese,singlish,arutha,dpd,meaning,translate,sri lanka,buddhist',
  },
}

/** the App Store name: Latin letters only (App Store Connect rejects Sinhala in the name); the home screen still shows
 *  ශබ්දකෝෂය (CFBundleDisplayName, apple/project.yml) */
export const appStoreName = 'Arutha Sinhala Dictionary'

/** the App Store description: it rejects Sinhala letters in every text (2026-11), so English only, Latin examples */
export const appStoreDescription = `Sinhala word meanings, English–Sinhala and Sinhala–English, and Pali–Sinhala with the Digital Pāḷi Dictionary – the dictionaries of arutha.lk on your iPhone and iPad, offline.

• The Concise Sinhala Dictionary and the Sinhala Spelling Dictionary (Sinhala Dictionary Office)
• English–Sinhala and Sinhala–English dictionaries
• The Pali–Sinhala dictionaries of Ven. Buddhadatta and Ven. Sumaṅgala
• The Digital Pāḷi Dictionary: type any inflected Pali form (buddhassa, dhammassa) and get its headword and grammar
• Type in Sinhala, in Singlish (akuru, budu) or in English, with suggestions as you type
• Finds words by their meanings too (amma → mother)
• Bookmarks, history, light / sepia / dark themes, text size
• Everything works offline. No ads, no accounts, no data collected.

Errors or missing words: path.nirvana@gmail.com`

export const privacyUrl = 'https://arutha.lk/privacy-policy.html'
export const supportUrl = 'https://arutha.lk/about'
export const marketingUrl = 'https://arutha.lk/'

// store limits (Play: title 30, short 80, full 4000, release notes 500; App Store: name 30, subtitle 30, promo 170, keywords 100)
const LIMITS = { title: 30, short: 80, full: 4000, whatsNew: 500, subtitle: 30, promo: 170, keywords: 100 }
export function check() {
  const errors = []
  for (const [lang, l] of Object.entries(listing)) {
    for (const [k, max] of Object.entries(LIMITS)) if ([...l[k]].length > max) errors.push(`${lang} ${k}: ${[...l[k]].length} > ${max}`)
  }
  return errors
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const e = check()
  if (appStoreName.length > 30 || /[^\x20-\x7e]/.test(appStoreName)) e.push(`appStoreName: ${appStoreName}`)
  const en = listing['en-US']
  for (const [k, v] of Object.entries({ appStoreDescription, subtitle: en.subtitle, promo: en.promo, keywords: en.keywords, whatsNew: en.whatsNew }))
    if (/[\u0d80-\u0dff]/.test(v)) e.push(`App Store ${k}: Sinhala letters are rejected there`)
  if ([...appStoreDescription].length > 4000) e.push('appStoreDescription > 4000')
  for (const [lang, l] of Object.entries(listing)) console.log(lang, Object.fromEntries(Object.keys(LIMITS).map(k => [k, [...l[k]].length])))
  console.log(e.length ? e.join('\n') : 'all within the limits')
  process.exit(e.length ? 1 : 0)
}
