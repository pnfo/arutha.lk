import { describe, expect, it } from 'vitest'
import { codesSi, grammarSi, plusCaseSi, shortSi } from './grammar'

const keep = (w: string) => w // arutha.lk: the Pali words in Roman letters

describe('DPD grammar in Sinhala (from tipitaka.lk)', () => {
  it('the analysis of a form', () => {
    expect(codesSi('masc voc sg', keep)).toBe('පුල්ලිඞ්ග · ආලපන විභක්ති · ඒකවචන')
    expect(codesSi('fem instr sg', keep, ' ', true)).toBe('ඉ කරණ ඒ.ව.')
    expect([shortSi('pp'), shortSi('noun')]).toEqual(['අතීත කිතක', 'නාම'])
  })
  it('the grammar notes of headwords, the Pali words as they are', () => {
    expect(grammarSi('pp of karoti', keep)).toBe('karoti හි අතීත කිතක')
    expect(grammarSi('fem, abstr from vajati', keep)).toBe('ඉත්ථිලිඞ්ග, භාව නාම, vajati යන්නෙන්')
    expect(plusCaseSi('+acc or +dat')).toBe('+කර්ම විභක්ති හෝ +සම්ප්‍රදාන විභක්ති')
  })
})
