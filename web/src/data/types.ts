/** The JSON of the engine ops (server/engine: call.go, search.go, word.go, dict.go). */

export interface Meta { contentHash: string; builtAt: string; dpdVersion?: string; dpdCitation?: string; headwords: number }

export type Src = 'si' | 'pi' | 'en'

export interface DictInfo {
  code: string; lang: string; name: string; short: string; desc?: string; origin?: string; entries: number
  src: Src; v1?: string; abbrevs?: Record<string, string>
}

export interface DictEntry { dict: string; word: string; hom?: number; meaning: string; dist: number }

export interface DpdRoot { root: string; meaning: string; group: number; sign: string; sanskritRoot?: string; sanskritMeaning?: string }

export interface DpdHead {
  id: number; lemma: string; pos: string; grammar: string; meaning: string; meaningLit?: string; meaning2?: string
  construction?: string; rootKey?: string; rootBase?: string; derivedFrom?: string; sanskrit?: string; plusCase?: string
  compoundType?: string; compoundConstruction?: string; notes?: string; stem?: string; pattern?: string; example?: string
  source?: string; sutta?: string; ebtCount: number; root?: DpdRoot
}

/** DPD's analysis of a typed Pali form: [[lemma, pos, grammar], ...] and compound splits */
export interface Analysis { word: string; grammar?: [string, string, string][]; deconstructor?: string[] }

/** a headword in a list: its displayed form (Pali in Sinhala script), sources (comma separated) and dictionaries */
export interface WordRef { word: string; src: string; dicts: string[] }

export interface Card { word: string; src: string; tier: number; via?: string; entries: DictEntry[]; dpd: DpdHead[] }

export interface SearchResult {
  query: string; exact: boolean; cards: Card[]; total: number; page: number; more: boolean
  analysis?: Analysis; singlish?: string[]
}

export interface BookRef { dict: string; v1: string; page: number }

export interface WordPage {
  word: string; src: string; roman?: string; entries: DictEntry[]; dpd: DpdHead[]; analysis?: Analysis
  prev?: WordRef; next?: WordRef; pages: BookRef[]; also: WordRef[]
}

export interface BookWord { word: string; entries: DictEntry[] }
export interface BookPage { dict: string; v1: string; name: string; page: number; pages: number; words: BookWord[] }

export interface Letter { letter: string; dict: string; v1: string; page: number }
export interface DictLanding { code: string; about?: string; dicts: DictInfo[]; letters: Letter[]; words: WordRef[] }

/** the search tiers (server/engine/search.go) */
export const TIER = { exact: 0, inflection: 1, singlish: 2, prefix: 3, stem: 4, meaning: 5 } as const
