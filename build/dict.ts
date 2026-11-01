/**
 * Builds db/dict.db: the dictionaries of arutha.lk in the schema of tipitaka.app's dict.db (so that the shared
 * server/engine/dict.go works unchanged: dict, entry, dict_abbrev, breakup, dpd_*), plus
 *  - headword:     one row per displayed headword (Pali in Sinhala script), the page /<word>
 *  - hkey:         lookup keys of the headwords (shared/normalize.ts key: Sinhala, Roman Pali, English)
 *  - meaning_fts:  contentless FTS4 over the meaning words (docid = entry id, DPD head id + DPD_FTS_BASE)
 *  - bookpage:     the frozen v1 /bookpage boundaries (data/bookpages.tsv)
 * See dev-docs/data-pipeline.md.
 */
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { convert } from '@pnfo/pali-converter'
import { fold, ftsTokens, key } from '@shared/normalize'
import { CST_DICTS, copyDpd, cstInfo, cstRows } from './dicts/cst'
import { markupMeaning, newStats, readTextDict, type MarkupCtx } from './dicts/text'
import type { DictDef, DictRow, Src } from './dicts/types'

export const DPD_FTS_BASE = 100_000_000
export const BUILD_VERSION = 1 // bump when the schema or the markup changes (part of the content hash)

export const DICTS: DictDef[] = [
  { code: 'sankshiptha', v1: 'sankshiptha', lang: 'si', src: 'si', short: 'සං', name: 'සංක්ෂිප්ත සිංහල ශබ්දකෝෂය',
    descr: 'සිංහල ශබ්දකෝෂ කාර්යාංශය විසින් සකස් කළ සංක්ෂිප්ත සිංහල ශබ්දකෝෂය', origin: 'සිංහල ශබ්දකෝෂ කාර්යාංශය' },
  { code: 'akshara', v1: 'akshara_vinyasa', lang: 'si', src: 'si', short: 'අවි', name: 'අක්ෂර වින්‍යාස ශබ්දකෝෂය',
    descr: 'සිංහල වචනවල නිවැරදි අක්ෂර වින්‍යාසය, පද වර්ගය සහ නිරුක්තිය', origin: 'සිංහල ශබ්දකෝෂ කාර්යාංශය' },
  { code: 'si-buddhadatta', v1: 'pali_buddhadatta', lang: 'si', src: 'pi', short: 'බු', name: 'බුද්ධදත්ත පාලි අකාරාදිය',
    descr: 'පොල්වත්තේ බුද්ධදත්ත හිමි, පාලි-සිංහල අකාරාදිය', origin: 'github.com/pnfo/pali-sinhala-dictionary' },
  { code: 'si-sumangala', v1: 'pali_sumangala', lang: 'si', src: 'pi', short: 'සු', name: 'සුමඞ්ගල පාලි ශබ්දකෝෂය',
    descr: 'මඩිතියවෙල සිරි සුමඞ්ගල හිමි, පාලි-සිංහල ශබ්දකෝෂය', origin: 'github.com/pnfo/pali-sinhala-dictionary' },
  { code: 'dpd', lang: 'en', src: 'pi', short: 'DPD', name: 'Digital Pāḷi Dictionary',
    descr: 'Pali-English: grammar, inflections, construction, roots and meanings', origin: 'Bodhirasa Bhikkhu, dpdict.net (CC BY-NC-SA 4.0)' },
  { code: 'sinhala-english', v1: 'sinhala_to_english', lang: 'en', src: 'si', short: 'SE', name: 'සිංහල ඉංග්‍රීසි ශබ්දකෝෂය',
    descr: 'Sinhala-English dictionary', origin: '' },
  { code: 'english-sinhala', v1: 'english_to_sinhala', lang: 'si', src: 'en', short: 'ES', name: 'ඉංග්‍රීසි සිංහල ශබ්දකෝෂය',
    descr: 'English-Sinhala dictionary', origin: '' },
]
// the text dictionaries: file in data/dicts, variants split on commas, senses linked to the paired dictionary
const TEXT: Record<string, { file: string; aliases?: boolean; linkSenses?: boolean; abbrevs: string }> = {
  'sankshiptha': { file: 'sankshiptha.txt', aliases: true, abbrevs: 'sankshiptha' },
  'akshara': { file: 'akshara_vinyasa.txt', aliases: true, abbrevs: 'akshara' },
  'sinhala-english': { file: 'sinhala_to_english.txt', linkSenses: true, abbrevs: 'sinhala-english' },
  'english-sinhala': { file: 'english_to_sinhala.txt', linkSenses: true, abbrevs: 'sinhala-english' },
}

const SCHEMA = `
CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE dict (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, lang TEXT NOT NULL, name TEXT NOT NULL, short TEXT NOT NULL,
  descr TEXT NOT NULL, origin TEXT NOT NULL, entries INTEGER NOT NULL, opt_in INTEGER NOT NULL, src TEXT NOT NULL, v1 TEXT NOT NULL);
CREATE TABLE entry (id INTEGER PRIMARY KEY, dict_id INTEGER NOT NULL, word TEXT NOT NULL, fold TEXT NOT NULL, hom INTEGER NOT NULL,
  meaning TEXT NOT NULL, alias_of INTEGER, hid INTEGER NOT NULL);
CREATE TABLE dict_abbrev (dict_id INTEGER NOT NULL, abbr TEXT NOT NULL, expansion TEXT NOT NULL, PRIMARY KEY (dict_id, abbr)) WITHOUT ROWID;
CREATE TABLE breakup (word TEXT NOT NULL, fold TEXT NOT NULL, type TEXT NOT NULL, origin TEXT NOT NULL, parts TEXT NOT NULL);
CREATE TABLE headword (id INTEGER PRIMARY KEY, word TEXT NOT NULL UNIQUE, src TEXT NOT NULL, dicts TEXT NOT NULL, score INTEGER NOT NULL,
  hash TEXT NOT NULL, lastmod TEXT NOT NULL);
CREATE TABLE hkey (key TEXT NOT NULL, hid INTEGER NOT NULL, PRIMARY KEY (key, hid)) WITHOUT ROWID;
CREATE TABLE bookpage (dict_id INTEGER NOT NULL, page INTEGER NOT NULL, first TEXT NOT NULL, PRIMARY KEY (dict_id, page)) WITHOUT ROWID;
CREATE VIRTUAL TABLE meaning_fts USING fts4(content="", text, tokenize=simple);
`
const INDEXES = `
CREATE INDEX entry_fold ON entry(fold);
CREATE INDEX entry_hid ON entry(hid);
CREATE INDEX entry_dict_word ON entry(dict_id, word);
CREATE INDEX breakup_fold ON breakup(fold);
CREATE INDEX dpd_head_fold ON dpd_head(fold);
CREATE INDEX dpd_head_hid ON dpd_head(hid);
`

/** Roman Pali -> the Sinhala script headword shown on the page */
export const romanToSinh = (w: string) => convert(w, 'sinh', 'latn').normalize('NFC')
/** DPD lemma "dhamma 1.01" -> "dhamma" */
export const dpdLemmaWord = (lemma: string) => lemma.replace(/\s+\d+(\.\d+)*$/, '').trim()

export interface BuildOpts {
  dataDir: string
  /** tipitaka.app's db/dict.db */
  cstDb: string
  out: string
  /** the previous build, for the lastmod dates of unchanged headwords */
  prev?: string
  /** limit the dictionaries to these headwords (fixture) */
  only?: Set<string>
  /** with only: the DPD inflected forms kept (Roman) */
  forms?: Set<string>
}

/**
 * score (orders suggestions): 1000 per dictionary that has the word + a bonus of 0-999, the larger of DPD's
 * frequency in the early texts (best homonym) and the number of senses (a common word has many: English "love")
 */
interface HW { word: string; src: Set<Src>; dicts: Set<string>; keys: Set<string>; score: number; bonus: number; parts: string[]; id?: number }

const senses = (meaning: string) => meaning.split(/\n|<br>/).length

export function buildDict(o: BuildOpts) {
  if (!fs.existsSync(o.cstDb)) throw new Error(`${o.cstDb} not found: build tipitaka.app's dict.db first (../cst: npm run build:dict)`)
  const tmp = o.out + '.tmp'
  fs.rmSync(tmp, { force: true })
  fs.mkdirSync(path.dirname(o.out), { recursive: true })
  const db = new Database(tmp)
  db.pragma('journal_mode = OFF')
  db.pragma('synchronous = OFF')
  db.exec(SCHEMA)
  db.exec(`ATTACH DATABASE '${o.cstDb.replace(/'/g, "''")}' AS cst`)
  const cst = cstInfo(db)
  const report: string[] = [`# dict.db build report`, '', `cst dict.db built ${cst.builtAt}, DPD ${cst.dpdVersion}`, '']

  const abbrevs = (code: string): Record<string, string> => {
    const f = path.join(o.dataDir, 'abbrev', `${code}.json`)
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}
  }

  // 1. read every dictionary
  const rowsBy = new Map<string, DictRow[]>()
  for (const d of DICTS) {
    if (d.code === 'dpd') continue
    let rows: DictRow[]
    if (TEXT[d.code]) rows = readTextDict(path.join(o.dataDir, 'dicts', TEXT[d.code].file), { aliases: TEXT[d.code].aliases })
    else if (CST_DICTS.includes(d.code)) rows = cstRows(db, d.code, abbrevs(d.code))
    else throw new Error(`no importer for ${d.code}`)
    if (o.only) rows = rows.filter(r => o.only!.has(d.src === 'pi' ? romanToSinh(r.word) : r.word))
    rowsBy.set(d.code, rows)
  }
  type Dpd = { id: number; lemma: string; ebt: number }
  let dpd = db.prepare('SELECT id, lemma, ebt_count AS ebt FROM cst.dpd_head ORDER BY id').all() as Dpd[]
  if (o.only) dpd = dpd.filter(h => o.only!.has(romanToSinh(dpdLemmaWord(h.lemma))))

  // 2. headwords: the displayed form of every entry (Pali in Sinhala script)
  const hws = new Map<string, HW>()
  const hw = (word: string, src: Src, code: string, score: number) => {
    let h = hws.get(word)
    if (h && h.dicts.has(code)) score = 0 // a homonym or variant of the same dictionary
    if (!h) hws.set(word, h = { word, src: new Set(), dicts: new Set(), keys: new Set([key(word)]), score: 0, bonus: 0, parts: [] })
    h.src.add(src)
    h.dicts.add(code)
    h.score += score
    return h
  }
  const display = (d: DictDef, w: string) => d.src === 'pi' ? romanToSinh(w) : d.src === 'en' ? w.toLowerCase() : w
  for (const d of DICTS) {
    for (const r of rowsBy.get(d.code) || []) {
      const h = hw(display(d, r.word), d.src, d.code, 1000)
      if (d.src === 'pi') h.keys.add(fold(r.word))
      h.bonus = Math.max(h.bonus, Math.min(999, 40 * senses(r.meaning)))
      for (const a of r.aliases || []) hw(display(d, a), d.src, d.code, 0)
    }
  }
  for (const h of dpd) {
    const w = dpdLemmaWord(h.lemma)
    const x = hw(romanToSinh(w), 'pi', 'dpd', 0)
    x.keys.add(fold(w))
    x.bonus = Math.max(x.bonus, Math.min(999, Math.round(150 * Math.log10(1 + h.ebt))))
  }
  for (const h of hws.values()) h.score += h.bonus
  const isHeadword = (w: string) => hws.has(w) || hws.has(w.toLowerCase())

  // 3. dictionaries, entries (with markup), abbreviations
  const insDict = db.prepare('INSERT INTO dict VALUES (?,?,?,?,?,?,?,?,0,?,?)')
  const insEntry = db.prepare('INSERT INTO entry (dict_id, word, fold, hom, meaning, alias_of, hid) VALUES (?,?,?,?,?,?,?)')
  const insAbbr = db.prepare('INSERT OR IGNORE INTO dict_abbrev VALUES (?,?,?)')
  const insHead = db.prepare('INSERT INTO headword (id, word, src, dicts, score, hash, lastmod) VALUES (?,?,?,?,?,?,?)')
  const insKey = db.prepare('INSERT OR IGNORE INTO hkey VALUES (?,?)')
  const insFts = db.prepare('INSERT INTO meaning_fts (docid, text) VALUES (?,?)')
  const prevDates = previousDates(o.prev)
  const today = new Date().toISOString().slice(0, 10)
  db.transaction(() => {
    // headword ids in a stable order (by word)
    const sorted = [...hws.values()].sort((a, b) => a.word < b.word ? -1 : a.word > b.word ? 1 : 0)
    sorted.forEach((h, i) => { h.id = i + 1 })
    const dictIds = new Map<string, number>()
    DICTS.forEach((d, i) => dictIds.set(d.code, i + 1))
    for (const d of DICTS) {
      const id = dictIds.get(d.code)!
      const ab = d.code === 'dpd' ? {} : abbrevs(TEXT[d.code]?.abbrevs || d.code)
      for (const [a, x] of Object.entries(ab)) insAbbr.run(id, a, x)
      if (d.code === 'dpd') {
        insDict.run(id, d.code, d.lang, d.name, d.short, d.descr, d.origin, dpd.length, d.src, d.v1 || '')
        continue
      }
      const rows = rowsBy.get(d.code)!
      const stats = newStats()
      const ctx: MarkupCtx = { abbrevs: ab, isHeadword, linkSenses: TEXT[d.code]?.linkSenses, stats }
      const homs = new Map<string, number>()
      for (const r of rows) {
        const meaning = TEXT[d.code] ? markupMeaning(r, ctx) : r.meaning
        const w = display(d, r.word)
        const h = hws.get(w)!
        const hom = r.hom || (homs.set(r.word, (homs.get(r.word) || 0) + 1), homs.get(r.word)! > 1 ? homs.get(r.word)! : 0)
        const eid = Number(insEntry.run(id, r.word, key(r.word), hom, meaning, null, h.id).lastInsertRowid)
        h.parts.push(d.code + meaning)
        insFts.run(BigInt(eid), ftsTokens(meaning).join(' '))
        for (const a of r.aliases || []) insEntry.run(id, a, key(a), 0, '', eid, hws.get(display(d, a))!.id)
      }
      insDict.run(id, d.code, d.lang, d.name, d.short, d.descr, d.origin, rows.length, d.src, d.v1 || '')
      if (TEXT[d.code]) {
        const top = [...stats.unknownLabels].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([l, n]) => `${l} ${n}`).join(', ')
        report.push(`## ${d.code}: ${rows.length} entries`, `abbreviations ${stats.abbr}, other labels ${stats.gram}, breakups ${stats.breakups}, ` +
          `see links ${stats.refs} (unresolved ${stats.unresolvedRefs.length}), sense links ${stats.senseLinks}`)
        if (top) report.push(`labels not in data/abbrev: ${top}`)
        if (stats.unresolvedRefs.length) report.push(`unresolved see refs: ${stats.unresolvedRefs.slice(0, 30).join(', ')}`)
        report.push('')
      } else report.push(`## ${d.code}: ${rows.length} entries (from cst)`, '')
    }
    // DPD
    copyDpd(db)
    if (o.only) {
      db.exec(`DELETE FROM dpd_head WHERE id NOT IN (${dpd.map(h => h.id).join(',') || 0})`)
      const keep = db.prepare('SELECT word FROM dpd_lookup').pluck().all() as string[]
      const del = db.prepare('DELETE FROM dpd_lookup WHERE word = ?')
      for (const w of keep) if (!o.forms?.has(w)) del.run(w)
    }
    const setHid = db.prepare('UPDATE dpd_head SET hid = ? WHERE id = ?')
    const dpdMeanings = db.prepare('SELECT id, lemma, meaning, meaning_lit, meaning_2, construction FROM dpd_head').all() as { id: number; lemma: string; meaning: string; meaning_lit: string; meaning_2: string; construction: string }[]
    for (const h of dpdMeanings) {
      const x = hws.get(romanToSinh(dpdLemmaWord(h.lemma)))!
      setHid.run(x.id, h.id)
      x.parts.push('dpd' + h.id + h.meaning + h.construction)
      insFts.run(BigInt(DPD_FTS_BASE + h.id), ftsTokens([h.meaning, h.meaning_lit, h.meaning_2].join(' ')).join(' '))
    }
    report.push(`## dpd: ${dpdMeanings.length} headwords, ${db.prepare('SELECT count(*) FROM dpd_lookup').pluck().get()} inflected forms`, '')
    // headwords and their keys
    for (const h of sorted) {
      const hash = crypto.createHash('sha1').update(h.parts.join('\u0001')).digest('hex').slice(0, 16)
      const p = prevDates.get(h.word)
      insHead.run(h.id, h.word, [...h.src].sort().join(','), [...h.dicts].join(','), h.score, hash, p && p.hash === hash ? p.lastmod : today)
      for (const k of h.keys) if (k) insKey.run(k, h.id)
    }
    // frozen v1 bookpages
    const insPage = db.prepare('INSERT INTO bookpage VALUES (?,?,?)')
    const v1 = new Map(DICTS.filter(d => d.v1).map(d => [d.v1!, dictIds.get(d.code)!]))
    let pages = 0
    for (const line of fs.readFileSync(path.join(o.dataDir, 'bookpages.tsv'), 'utf8').split('\n')) {
      const [t, page, first] = line.split('\t')
      if (!line || line.startsWith('#') || !v1.has(t)) continue
      insPage.run(v1.get(t), Number(page), first)
      pages++
    }
    report.push(`headwords ${sorted.length}, keys ${db.prepare('SELECT count(*) FROM hkey').pluck().get()}, bookpages ${pages}`)
    db.exec(INDEXES)
    // content hash: the headwords' hashes, the dictionaries and the build version
    const all = crypto.createHash('sha256').update(String(BUILD_VERSION))
    for (const h of sorted) all.update(h.word + '\u0001' + (db.prepare('SELECT hash FROM headword WHERE id = ?').pluck().get(h.id) as string))
    const meta: Record<string, string> = {
      content_hash: all.digest('hex').slice(0, 16), built_at: new Date().toISOString(), build_version: String(BUILD_VERSION),
      headwords: String(sorted.length), cst_built_at: cst.builtAt, dpd_version: cst.dpdVersion, dpd_citation: cst.dpdCitation, dpd_license: cst.dpdLicense,
    }
    // the about texts of the dictionary pages (data/about/<code>.html, /dict/<code>)
    for (const code of [...DICTS.map(d => d.code), 'pali']) {
      const html = readAbout(o.dataDir, code)
      if (html) meta['about:' + code] = html
    }
    const insMeta = db.prepare('INSERT INTO meta VALUES (?,?)')
    for (const [k, v] of Object.entries(meta)) insMeta.run(k, v)
    report.push(`content hash ${meta.content_hash}`)
  })()
  db.exec('DETACH DATABASE cst')
  db.exec("INSERT INTO meaning_fts(meaning_fts) VALUES ('optimize')")
  db.exec('ANALYZE')
  db.exec('VACUUM')
  db.close()
  fs.renameSync(tmp, o.out)
  return { report, cst }
}

function previousDates(prev?: string): Map<string, { hash: string; lastmod: string }> {
  const out = new Map<string, { hash: string; lastmod: string }>()
  if (!prev || !fs.existsSync(prev)) return out
  try {
    const db = new Database(prev, { readonly: true })
    for (const r of db.prepare('SELECT word, hash, lastmod FROM headword').all() as { word: string; hash: string; lastmod: string }[]) out.set(r.word, r)
    db.close()
  } catch { /* a db of another schema: every date is today */ }
  return out
}

/** data/about/<code>.html with its <!-- include file --> lines */
export function readAbout(dataDir: string, code: string): string {
  const f = path.join(dataDir, 'about', `${code}.html`)
  if (!fs.existsSync(f)) return ''
  return fs.readFileSync(f, 'utf8').replace(/<!-- include ([\w.-]+) -->/g, (_, inc) => fs.readFileSync(path.join(dataDir, 'about', inc), 'utf8')).trim()
}
