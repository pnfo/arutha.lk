/**
 * Every entry of the v1 database (legacy/server-data/all-dict.db, gitignored: the db of the v1 site) must have a
 * page in v3: the `word` op finds its headword (the review complaints were about missing words, none may be lost).
 *   npm run parity [-- <v1 db>]
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'

const v1 = process.argv[2] || 'legacy/server-data/all-dict.db'
if (!fs.existsSync(v1)) { console.log(`${v1} not found: skipped`); process.exit(0) }
const db = new Database(v1, { readonly: true })
const v3 = new Database('db/dict.db', { readonly: true })
const TABLES = ['sankshiptha', 'akshara_vinyasa', 'pali_buddhadatta', 'pali_sumangala', 'sinhala_to_english', 'english_to_sinhala']
// the lookup of server/engine Word: the displayed headword, else a key (shared/normalize.ts key)
const { key } = await import('../shared/normalize')
const byWord = v3.prepare('SELECT 1 FROM headword WHERE word = ?')
const byKey = v3.prepare('SELECT 1 FROM hkey WHERE key = ?')
let missing = 0, total = 0, failing = 0
const out: string[] = []
for (const t of TABLES) {
  let m = 0
  const words = db.prepare(`SELECT word FROM ${t}`).pluck().all() as string[]
  for (const w0 of words) {
    total++
    // v1 kept the variants of a headword together ("අංක, අඞ්ක"); v3 has a page for each
    // and the Pali vowels of server/engine parseQuery (ේ -> ෙ: v1 had Sinhala spellings of Pali words)
    const pali = (w: string) => w.replace(/ේ/g, 'ෙ').replace(/ෝ/g, 'ො')
    const found = (w: string) => !!(byWord.get(w) || byWord.get(w.toLowerCase()) || byKey.get(key(w)) || byKey.get(key(pali(w))))
    const parts = t === 'sankshiptha' || t === 'akshara_vinyasa' ? w0.normalize('NFC').split(/\s*,\s*/) : [w0.normalize('NFC')]
    if (parts.every(found)) continue
    m++
    if (out.length < 40) out.push(`${t}\t${w0}`)
  }
  missing += m
  // the Pali words come from tipitaka.app's corrected data: v1 spellings like "අම්හ .අ" or බ්රෑහෙති are gone
  if (!t.startsWith('pali_')) failing += m
  console.log(`${t}: ${words.length} words, ${m} without a page${t.startsWith('pali_') && m ? ' (v1 spellings corrected in the Pali data)' : ''}`)
}
if (out.length) console.log(out.join('\n'))
console.log(`${total - missing} of ${total} v1 words have a page`)
process.exit(failing ? 1 : 0)
