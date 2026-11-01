import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ftsTokens, key, scriptOf } from './normalize'

// golden vectors shared with server/engine (keys_test: Key, FtsTokens). UPDATE_GOLDEN=1 rewrites the file.
const KEYS = ['ක්‍රියාව', 'ක්රියාව', 'Dhammā', '  love   story ', 'අඞ්ක', 'ධර්මය‍', 'a.d.', 'Ñāṇa', 'බුද්ධ​', 'පුද්ගල%', 'ආදරය කරනවා']
const FTS = ['<b class="sn">1.</b> <abbr data-a="n.">n.</abbr> <a data-dict="ආදරය">ආදරය</a>', 'Love; affection &amp; care', 'ක්‍රියා-පදය (ව්‍යාක.)', 'dhammā, 2005']
const golden = () => ({ key: KEYS.map(k => [k, key(k)]), fts: FTS.map(s => ({ in: s, out: ftsTokens(s) })) })
const FILE = new URL('./normalize.golden.json', import.meta.url)

describe('normalize', () => {
  it('matches the golden vectors (server/engine keys_test reads them too)', () => {
    if (process.env.UPDATE_GOLDEN || !fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(golden(), null, 1) + '\n')
    expect(JSON.parse(fs.readFileSync(FILE, 'utf8'))).toEqual(golden())
  })
  it('makes Sinhala keys without joiners', () => {
    expect(key('ක්‍රියාව')).toBe(key('ක්රියාව'))
    expect(key('Dhammā')).toBe('dhamma')
    expect(key('  love   story ')).toBe('love story')
  })
  it('tokenises meanings', () => {
    expect(ftsTokens('<b class="sn">1.</b> <abbr data-a="n.">n.</abbr> ආදරය; love')).toEqual(['1', 'n', 'ආදරය', 'love'])
  })
  it('knows the script', () => {
    expect(scriptOf('ධම්ම')).toBe('si')
    expect(scriptOf('dhammā')).toBe('ro')
    expect(scriptOf('123')).toBe('other')
  })
})
