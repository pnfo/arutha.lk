/**
 * The Pali dictionaries come from tipitaka.app's built db/dict.db (../cst, the source of truth for Pali data):
 * the Pali-Sinhala dictionaries si-buddhadatta and si-sumangala (Roman headwords, cst's markup) and DPD
 * (dpd_head, dpd_root, dpd_lookup: 1.2M inflected forms). Pattern of tipitaka.lk build/dict.ts buildLkDict.
 * cst writes the grammar labels as <span class="gram">පු</span>: they become <abbr> of our lists (data/abbrev).
 */
import type Database from 'better-sqlite3'
import { escapeAttr } from '@shared/normalize'
import type { DictRow } from './types'

export const CST_DICTS = ['si-buddhadatta', 'si-sumangala']

export interface CstInfo { builtAt: string; dpdVersion: string; dpdCitation: string; dpdLicense: string }

export function cstInfo(db: Database.Database, alias = 'cst'): CstInfo {
  const meta = Object.fromEntries((db.prepare(`SELECT k, v FROM ${alias}.meta`).all() as { k: string; v: string }[]).map(r => [r.k, r.v]))
  return { builtAt: meta.built_at || '', dpdVersion: meta.dpd_version || '', dpdCitation: meta.dpd_citation || '', dpdLicense: meta.dpd_license || '' }
}

/** the entries of a cst dictionary, with the grammar labels as abbreviations of `abbrevs` */
export function cstRows(db: Database.Database, code: string, abbrevs: Record<string, string>, alias = 'cst'): DictRow[] {
  const rows = db.prepare(`SELECT e.word, e.hom, e.meaning FROM ${alias}.entry e JOIN ${alias}.dict d ON d.id = e.dict_id
    WHERE d.code = ? AND e.alias_of IS NULL ORDER BY e.id`).all(code) as { word: string; hom: number; meaning: string }[]
  return rows.map(r => ({ word: r.word, hom: r.hom, meaning: gramToAbbr(r.meaning, abbrevs) }))
}

export function gramToAbbr(html: string, abbrevs: Record<string, string>): string {
  return html.replace(/<span class="gram">([^<]+)<\/span>/g, (m, g) => {
    const a = abbrevs[g + '.'] !== undefined ? g + '.' : abbrevs[g] !== undefined ? g : ''
    return a ? `<abbr data-a="${escapeAttr(a)}">${a}</abbr>` : m
  })
}

/** copies the DPD tables (schema from the source; dpd_head gets our headword id) */
export function copyDpd(db: Database.Database, alias = 'cst') {
  for (const t of ['dpd_head', 'dpd_root', 'dpd_lookup']) {
    const sql = (db.prepare(`SELECT sql FROM ${alias}.sqlite_master WHERE type = 'table' AND name = ?`).pluck().get(t) as string)
    db.exec(sql)
    db.exec(`INSERT INTO main.${t} SELECT * FROM ${alias}.${t}`)
  }
  db.exec('ALTER TABLE dpd_head ADD COLUMN hid INTEGER')
}
