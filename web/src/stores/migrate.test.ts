import { describe, expect, it } from 'vitest'
import { migrateV1 } from './migrate'

function storage(init: Record<string, string>) {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('v1 localStorage migration', () => {
  it('moves the bookmarks, theme, text size and dictionary choice', () => {
    const s = storage({
      // as v1 saved them (legacy/src/stores/utils.js, savedStore.js)
      bookmarks: JSON.stringify({ '0-ධර්මය': { time: 2, coll: 'dict', entry: { dict: 0, word: 'ධර්මය' } }, '5-Love': { time: 3, coll: 'dict', entry: {} }, '4-ධර්මය': { time: 1 } }),
      settings: JSON.stringify({ darkMode: true, fontSize: 2, dicts: [2, 3] }),
      theme: 'dark',
    })
    const r = migrateV1(s)!
    expect(r.bookmarks.map(b => b.word)).toEqual(['love', 'ධර්මය'])
    expect(r.settings).toEqual({ theme: 'dark', textSize: 20, dicts: ['si-buddhadatta', 'si-sumangala'] })
    expect(migrateV1(s)).toBeNull() // once
  })
  it('turns the v1 default dictionaries into all dictionaries', () => {
    const r = migrateV1(storage({ settings: JSON.stringify({ dicts: [0, 1], fontSize: 0 }) }))!
    expect(r.settings).toEqual({})
  })
  it('does nothing for a new visitor', () => {
    expect(migrateV1(storage({}))).toBeNull()
  })
})
