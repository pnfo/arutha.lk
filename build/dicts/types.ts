/** A dictionary entry as read by an importer, before markup (text) or with markup (cst). */
export interface DictRow {
  word: string
  /** the meaning: plain text lines (text importer) or html (cst) */
  meaning: string
  /** variant headwords of the same entry ("අංක, අඞ්ක") */
  aliases?: string[]
  hom?: number
}

/** The language of the headwords, which decides how they are displayed and looked up. */
export type Src = 'si' | 'pi' | 'en'

export interface DictDef {
  code: string
  /** the v1 table name (old urls, bookpages, localStorage) */
  v1?: string
  /** language of the meanings */
  lang: 'si' | 'en'
  src: Src
  name: string
  short: string
  descr: string
  origin: string
}
