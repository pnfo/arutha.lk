/**
 * One-off (2026-11): the page boundaries of the v1 /bookpage/<dict>/<page> urls, which bring 88% of the search
 * impressions. v1 showed 24 entries per page in the binary order of the headword (WITHOUT ROWID primary key).
 * data/bookpages.tsv keeps the first headword of every page, so the pages keep their words as the data changes
 * (build/dict.ts: a page shows the headwords from its first word up to the next page's first word).
 *   tsx scripts/freeze-bookpages.ts [legacy/server-data/all-dict.db]
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'

const PER_PAGE = 24
const TABLES = ['sankshiptha', 'akshara_vinyasa', 'pali_buddhadatta', 'pali_sumangala', 'sinhala_to_english', 'english_to_sinhala']
const db = new Database(process.argv[2] || 'legacy/server-data/all-dict.db', { readonly: true })
const lines = ['# v1 dict id\tpage\tfirst headword (binary order, 24 a page)']
for (const t of TABLES) {
  const words = (db.prepare(`SELECT word FROM ${t}`).pluck().all() as string[])
  for (let i = 0; i < words.length; i += PER_PAGE) lines.push(`${t}\t${i / PER_PAGE + 1}\t${words[i]}`)
  console.log(t, Math.ceil(words.length / PER_PAGE), 'pages')
}
fs.writeFileSync('data/bookpages.tsv', lines.join('\n') + '\n')
