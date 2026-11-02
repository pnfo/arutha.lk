import { describe, expect, it } from 'vitest'
import { markupMeaning, newStats, type MarkupCtx } from './text'

const ctx = (heads: string[], linkSenses = false): MarkupCtx => ({
  abbrevs: { 'නා.': 'නාම පදය', 'නා.ප්‍ර.': 'නාම ප්‍රකෘතිය', 'ක්‍රි.': 'ක්‍රියා පදය', 'ව්‍යාක.': 'ව්‍යාකරණයෙහි', 'සං.': 'සංස්කෘත', 'පා.': 'පාලි', 'n.': 'Noun' },
  isHeadword: w => heads.includes(w), linkSenses, stats: newStats(),
})
const m = (meaning: string, c = ctx([])) => markupMeaning({ word: 'x', meaning }, c)

describe('text dictionary markup', () => {
  it('escapes the text before marking it up', () => {
    expect(m('a <b> & c')).toBe('a &lt;b&gt; &amp; c')
  })
  it('marks labels and sense numbers', () => {
    expect(m('[නා.] අංකය')).toBe('<abbr data-a="නා.">නා.</abbr> අංකය')
    expect(m('1. [නා.] a\n2. (ව්‍යාක.) b')).toBe('<b class="sn">1.</b> <abbr data-a="නා.">නා.</abbr> a<br><b class="sn">2.</b> (<abbr data-a="ව්‍යාක.">ව්‍යාක.</abbr>) b')
    // the number after the labels comes first
    expect(m('[ක්‍රි.] 1. පමුණුවා')).toBe('<b class="sn">1.</b> <abbr data-a="ක්‍රි.">ක්‍රි.</abbr> පමුණුවා')
    // an unknown label stays a grammar label
    const c = ctx([])
    expect(m('[Xyz.] a', c)).toBe('<span class="gram">Xyz.</span> a')
    expect(c.stats.unknownLabels.get('Xyz.')).toBe(1)
  })
  it('marks the labels of etymology brackets', () => {
    expect(m('මිදුල (පා. සං. අඞ්ගණ)')).toBe('මිදුල (<abbr data-a="පා.">පා.</abbr> <abbr data-a="සං.">සං.</abbr> අඞ්ගණ)')
  })
  it('links breakups and see references to headwords', () => {
    const c = ctx(['අංග', 'අඞ්කය'])
    expect(m('[අංග+අංගී]\n[නා.] අංකය; අඞ්කය බ.', c)).toBe(
      '<span class="breakup">[<a data-dict="අංග">අංග</a> + අංගී]</span><br><abbr data-a="නා.">නා.</abbr> අංකය; <a data-dict="අඞ්කය">අඞ්කය</a> බ.')
    expect(m('ශ්‍රී බ.', c)).toBe('ශ්‍රී බ.')
    expect(c.stats.unresolvedRefs).toEqual(['ශ්‍රී'])
  })
  it('links the senses of the English-Sinhala dictionaries', () => {
    expect(m('1. [n.] ආදරය\n2. [n.] නැති වචනය', ctx(['ආදරය'], true))).toBe(
      '<b class="sn">1.</b> <abbr data-a="n.">n.</abbr> <a data-dict="ආදරය">ආදරය</a><br><b class="sn">2.</b> <abbr data-a="n.">n.</abbr> නැති වචනය')
  })
})

describe('the cleaning of the text (M3)', async () => {
  const { cleanLine } = await import('./text')
  it('fixes the encoding', () => {
    expect(cleanLine('ඇල්fපැල්fපා')).toBe('ඇල්ෆැල්ෆා')
    expect(cleanLine('අ‍ඥේයවාදය ‍තොරතුර')).toBe('අඥේයවාදය තොරතුර') // joiners that join nothing
    expect(cleanLine('ක්‍ෂණ ක්‍රම ක්‍ය')).toBe('ක්‍ෂණ ක්‍රම ක්‍ය') // kept
    expect(cleanLine('a b​c')).toBe('a bc')
  })
  it('fixes the spacing and punctuation', () => {
    expect(cleanLine(' තේරුම ;  අදහස . ')).toBe('තේරුම; අදහස.')
    expect(cleanLine('(නා. ) ( වෙන්කර ) x')).toBe('(නා.) (වෙන්කර) x')
    expect(cleanLine('පාපී ; ; සාපරාධි.. ආදී...')).toBe('පාපී; සාපරාධි. ආදී...')
  })
})
