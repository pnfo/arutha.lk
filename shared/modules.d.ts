declare module '@pnfo/pali-converter' {
  export const Script: Record<string, string>
  export function convert(text: string, toScript: string, fromScript: string, options?: Record<string, unknown>): string
}
declare module '@pnfo/singlish-search' {
  export const singlish_vowels: [string, string][]
  export const singlish_specials: [string, string][]
  export const singlish_consonants: [string, string][]
  export const singlish_combinations: [string, string][]
  export function getPossibleMatches(input: string, opts?: { maxMatches?: number }): string[]
  export function isSinglishQuery(q: string): boolean
}
