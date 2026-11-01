/**
 * Search normalisation. Must match server/engine/normalize.go (fold) and server/engine/keys.go (the rest):
 * the golden vectors of shared/normalize.golden.json are checked on both sides.
 *  - fold():   diacritic-insensitive Roman, so that "dhamma" finds dhammā / dhammaṃ (ā->a, ṃ->m, ñ->n, ṭ->t ...)
 *  - key():    the lookup key of a headword or a query in any script: NFC, lower case, folded Roman, without the
 *              joiners and invisible marks that Sinhala text carries inconsistently (ක්‍රි = ක්රි), single spaces
 *  - ftsTokens(): the words of a meaning for the full text index (simple tokenizer: the tokens joined by spaces)
 */

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function reverse(s: string): string {
  return Array.from(s).reverse().join('')
}

/** true when the user typed diacritics (then the exact column is searched, otherwise the folded one) */
export function hasDiacritics(s: string): boolean {
  return fold(s) !== s.toLowerCase()
}

// ZWJ, ZWNJ, ZWSP, soft hyphen, BOM, word joiner
const INVISIBLE = /[\u200b-\u200d\u00ad\ufeff\u2060]/g

/** lookup key (see above); the result is NFC */
export function key(s: string): string {
  return fold(s.replace(INVISIBLE, '')).normalize('NFC').replace(/\s+/g, ' ').trim()
}

const NON_WORD = /[^\p{L}\p{M}\p{N}]+/gu

/** the words of a text (html allowed) as index tokens */
export function ftsTokens(html: string): string[] {
  const text = stripTags(html).replace(/&[a-z]+;|&#\d+;/g, ' ')
  return key(text).split(NON_WORD).filter(Boolean)
}

export const stripTags = (html: string) => html.replace(/<[^>]*>/g, '')
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

const SINHALA = /[඀-෿]/
const LATIN = /[a-zA-Z]/

/** the script of a query or headword: si (has Sinhala letters), ro (Latin letters), other */
export function scriptOf(s: string): 'si' | 'ro' | 'other' {
  if (SINHALA.test(s)) return 'si'
  if (LATIN.test(fold(s))) return 'ro'
  return 'other'
}
