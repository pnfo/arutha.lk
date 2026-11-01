/**
 * One-time migration of the v1 site's localStorage (same origin, arutha.lk): bookmarks of dictionary entries
 * ("<dict index>-<word>") become bookmarks of the word pages, the dictionary choice (indexes) becomes codes, the
 * theme and the text size carry over. The v1 keys are left in place.
 */
import { readJson, writeJson } from './storage'

/** the v1 dictionary indexes (legacy/src/stores/sinhala.js dictionaryInfos) */
export const V1_DICTS = ['sankshiptha', 'akshara', 'si-buddhadatta', 'si-sumangala', 'sinhala-english', 'english-sinhala']
const DONE = 'arutha-migrated-1'

export interface Bookmark { word: string; time: number }
export type Theme = 'light' | 'sepia' | 'dark'
export interface SavedSettings { theme?: Theme; textSize?: number; dicts?: string[]; hidden?: string[] }

interface V1Settings { darkMode?: boolean; fontSize?: number; dicts?: number[] }
type V1Bookmarks = Record<string, { time?: number; entry?: { word?: string } }>

export function migrateV1(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): { bookmarks: Bookmark[]; settings: SavedSettings } | null {
  try {
    if (storage.getItem(DONE)) return null
    storage.setItem(DONE, '1')
  } catch {
    return null
  }
  const parse = <T>(k: string): T | null => { try { const s = storage.getItem(k); return s ? JSON.parse(s) as T : null } catch { return null } }
  const v1s = parse<V1Settings>('settings')
  const v1b = parse<V1Bookmarks>('bookmarks')
  let theme: string | null = null
  try { theme = storage.getItem('theme') } catch { /* ignore */ }
  if (!v1s && !v1b && !theme) return null

  const bookmarks: Bookmark[] = []
  const seen = new Set<string>()
  for (const [k, v] of Object.entries(v1b || {})) {
    const m = /^(\d+)-(.+)$/.exec(k)
    if (!m) continue
    const dict = V1_DICTS[Number(m[1])]
    const word = dict === 'english-sinhala' ? m[2].toLowerCase() : m[2]
    if (seen.has(word)) continue
    seen.add(word)
    bookmarks.push({ word, time: v?.time || Date.now() })
  }
  bookmarks.sort((a, b) => b.time - a.time)

  const settings: SavedSettings = {}
  if (theme === 'dark' || theme === 'light') settings.theme = theme
  if (typeof v1s?.fontSize === 'number' && v1s.fontSize) settings.textSize = Math.min(28, Math.max(14, 18 + v1s.fontSize))
  // v1 showed two dictionaries by default ([0, 1]): v3 shows all; a different choice is kept, the others hidden
  const chosen = (v1s?.dicts || []).map(i => V1_DICTS[i]).filter(Boolean)
  const isDefault = chosen.length === 2 && chosen[0] === 'sankshiptha' && chosen[1] === 'akshara'
  if (chosen.length && !isDefault) settings.dicts = chosen
  return { bookmarks, settings }
}

/** applies the migration to the v3 stores' storage (main.ts, before the stores load) */
export function runMigration() {
  const m = migrateV1()
  if (!m) return
  if (m.bookmarks.length) {
    const cur = readJson<Bookmark[]>('arutha-bookmarks-1', [])
    const have = new Set(cur.map(b => b.word))
    writeJson('arutha-bookmarks-1', [...cur, ...m.bookmarks.filter(b => !have.has(b.word))])
  }
  if (Object.keys(m.settings).length) writeJson('arutha-settings-1', { ...m.settings, ...readJson<SavedSettings>('arutha-settings-1', {}) })
}
