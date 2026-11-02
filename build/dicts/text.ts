/**
 * The text format of data/dicts/*.txt: entries separated by blank lines, the headword on the first line
 * ("අංක, අඞ්ක": variants separated by commas when `aliases` is set), the meaning on the lines after it.
 *
 * Markup (the vocabulary of web/src/composables/dict.ts cleanMeaning; the text is html-escaped first):
 *  - [නා.] (ව්‍යාක.) [n.]          -> <abbr data-a="නා.">නා.</abbr> when the label is in the dictionary's list
 *                                     (data/abbrev/<code>.json), otherwise <span class="gram">
 *  - (සං. අඞ්කන පා. අඞ්කුස)         -> abbreviations inside etymology brackets
 *  - "1. " at the start of a line   -> <b class="sn">1.</b>
 *  - [අංග+අංගී] as the first line   -> <span class="breakup">, parts that are headwords linked
 *  - "අඞ්කය බ." (see)               -> <a data-dict="අඞ්කය"> when it is a headword
 *  - linkSenses: a sense that is a headword (English-Sinhala senses are Sinhala-English headwords and back)
 * Lines are joined with <br>.
 */
import fs from 'node:fs'
import { escapeAttr, escapeHtml } from '@shared/normalize'
import type { DictRow } from './types'

/**
 * The mechanical cleaning of a line (M3): Unicode NFC, ෆ written as "fප" (an old font conversion), joiners that join
 * nothing (a ZWJ belongs after the hal kirima: ක්‍ෂ ක්‍ය ක්‍ර), invisible characters, the spacing around punctuation
 * ("X ; Y", "(නා. )") and doubled punctuation ("; ;", "..", not "...").
 */
export function cleanLine(s: string): string {
  return s.normalize('NFC')
    .replace(/f\u0db4/g, '\u0dc6')
    .replace(/(^|[^\u0dca])\u200d+/g, '$1').replace(/\u200d+(?=$|[^\u0d9a-\u0dc6])/g, '').replace(/\u200c/g, '')
    .replace(/[\u00a0\t]/g, ' ').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u00ad\u200b\ufeff]/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/ +([,;:)\]])/g, '$1').replace(/([([]) +/g, '$1').replace(/ +\.(?=\s|$)/g, '.')
    .replace(/([,;])(?: ?\1)+/g, '$1').replace(/(?<!\.)\.\.(?!\.)/g, '.')
    .trim()
}

/**
 * The hand fixes of a dictionary (data/dict-fixes/<code>.tsv: headword, text, replacement; \\n a line break; # comments): applied to the
 * entry (its headword line and meaning) after the cleaning; the fixes that found nothing are returned (build report)
 */
export function readFixes(file: string): string[][] {
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('\t').map(f => f.replace(/\\n/g, '\n').normalize('NFC')))
}

/**
 * opts.senses: the Sinhala senses of the English-Sinhala dictionary renamed everywhere (data/dict-fixes/senses.tsv: a
 * typo fixed once): on the sense lines of English-Sinhala (senses: 'lines') and as the headwords of Sinhala-English
 * (senses: 'headword')
 */
export function readTextDict(file: string, opts: { aliases?: boolean; fixes?: [string, string, string][]; missed?: string[]; senses?: Map<string, string>; sensesIn?: 'lines' | 'headword' } = {}): DictRow[] {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
  const fixes = new Map<string, [string, string][]>()
  for (const [w, a, b] of (opts.fixes ?? []) as [string, string, string][]) fixes.set(w, [...(fixes.get(w) ?? []), [a, b]])
  const rows: DictRow[] = [], used = new Set<string>()
  for (const block of text.split(/\n\s*\n/)) {
    let lines = block.split('\n').map(cleanLine).filter(Boolean)
    if (lines.length < 2) continue
    const head = fixes.has(lines[0]) ? lines[0] : lines[0].split(/\s*,\s*/)[0] // the first variant names an entry
    if (fixes.has(head)) used.add(head)
    for (const [a, b] of fixes.get(head) ?? []) {
      const joined = lines.join('\n')
      if (!joined.includes(a)) { opts.missed?.push(`${head}: ${a}`); continue }
      lines = joined.replace(a, b).split('\n').map(cleanLine).filter(Boolean)
    }
    if (opts.senses?.size) {
      if (opts.sensesIn === 'headword') lines[0] = opts.senses.get(lines[0]) ?? lines[0]
      else lines = lines.map((l, i) => {
        const m = i ? /^((?:\d+\.\s*)?(?:\[[^\]]*\]\s*)*)(.+)$/.exec(l) : null
        return m && opts.senses!.has(m[2]) ? m[1] + opts.senses!.get(m[2]) : l
      })
    }
    const words = opts.aliases ? lines[0].split(/\s*,\s*/).filter(Boolean) : [lines[0]]
    rows.push({ word: words[0], aliases: words.slice(1), meaning: lines.slice(1).join('\n') })
  }
  if (opts.sensesIn === 'headword' && opts.senses?.size) mergeSame(rows)
  for (const w of fixes.keys()) if (!used.has(w)) opts.missed?.push(`${w}: no such headword`)
  return rows
}

/** the entries of the same headword (a renamed sense meets the correct one) as one: the senses renumbered, once each */
function mergeSame(rows: DictRow[]) {
  const first = new Map<string, DictRow>()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], f = first.get(r.word)
    if (!f) { first.set(r.word, r); continue }
    const senses = [...new Set([f.meaning, r.meaning].flatMap(m => m.split('\n')).map(l => l.replace(/^\d+\.\s*/, '')))]
    f.meaning = senses.length > 1 ? senses.map((l, j) => `${j + 1}. ${l}`).join('\n') : senses[0]
    rows.splice(i--, 1)
  }
}

export interface MarkupCtx {
  abbrevs: Record<string, string>
  /** is the word a headword (of any dictionary): links are only made to existing pages */
  isHeadword: (w: string) => boolean
  linkSenses?: boolean
  /** counts of what was marked, and the labels and references that were not resolved (build report) */
  stats: { abbr: number; gram: number; breakups: number; refs: number; senseLinks: number; unknownLabels: Map<string, number>; unresolvedRefs: string[] }
}

export function newStats(): MarkupCtx['stats'] {
  return { abbr: 0, gram: 0, breakups: 0, refs: 0, senseLinks: 0, unknownLabels: new Map(), unresolvedRefs: [] }
}

const link = (w: string, text = escapeHtml(w)) => `<a data-dict="${escapeAttr(w)}">${text}</a>`

function label(l: string, ctx: MarkupCtx): string {
  if (ctx.abbrevs[l] !== undefined) {
    ctx.stats.abbr++
    return `<abbr data-a="${escapeAttr(l)}">${escapeHtml(l)}</abbr>`
  }
  ctx.stats.gram++
  ctx.stats.unknownLabels.set(l, (ctx.stats.unknownLabels.get(l) || 0) + 1)
  return `<span class="gram">${escapeHtml(l)}</span>`
}

/** the labels inside an etymology bracket: "(සං. අඞ්ගච්ඡෙදන පා. අඞ්ගච්ඡෙදන)" */
function etymology(inner: string, ctx: MarkupCtx): string {
  return inner.replace(/(^|\s)([^\s.]+\.)(?=\s|$)/g, (m, sp, a) => ctx.abbrevs[a] !== undefined ? sp + label(a, ctx) : m)
}

export function markupMeaning(row: DictRow, ctx: MarkupCtx): string {
  const lines = row.meaning.split('\n')
  const out: string[] = []
  lines.forEach((raw, i) => {
    // breakup on the first line: [අංග+අංගී]
    const bu = i === 0 && raw.match(/^\[([^\]]*\+[^\]]*)\]$/)
    if (bu) {
      ctx.stats.breakups++
      const parts = bu[1].split('+').map(p => p.trim())
      out.push(`<span class="breakup">[${parts.map(p => ctx.isHeadword(p) ? link(p) : escapeHtml(p)).join(' + ')}]</span>`)
      return
    }
    let s = escapeHtml(raw)
    let sn = ''
    // the sense number, also when labels come first ("[ක්‍රි.] 1. ..."): in front, so that the senses line up
    const num = s.match(/^((?:\[[^\][]{1,24}\]\s*)*)(\d+)\.\s+/)
    if (num) {
      sn = `<b class="sn">${num[2]}.</b> `
      s = num[1] + s.slice(num[0].length)
    }
    // labels: [නා.] [n.] [Civ.] and (පාරිභා.) - a round bracket is a label when its whole content is one
    s = s.replace(/\[([^\][]{1,24})\]/g, (_, l) => label(l.trim(), ctx))
    s = s.replace(/\(([^()\s]{1,20}\.)\)/g, (m, l) => ctx.abbrevs[l] !== undefined ? `(${label(l, ctx)})` : m)
    // etymology brackets with several labels
    s = s.replace(/\(([^()]*\.[^()]*)\)/g, (m, inner) => m.includes('<abbr') ? m : `(${etymology(inner, ctx)})`)
    // see references: "අඞ්කය බ."
    s = s.replace(/(^|[\s;,(])([^\s;,.()<>]+) බ\./g, (m, pre, w) => {
      if (ctx.isHeadword(w)) {
        ctx.stats.refs++
        return `${pre}${link(w)} බ.`
      }
      ctx.stats.unresolvedRefs.push(w)
      return m
    })
    if (ctx.linkSenses) {
      // "<labels> sense": the text after the labels is a headword of the paired dictionary
      const m = s.match(/^((?:<(?:abbr|span)[^>]*>[^<]*<\/(?:abbr|span)>\s*)*)(.+)$/)
      if (m && !m[2].includes('<')) {
        const target = unescape(m[2]).trim()
        if (ctx.isHeadword(target)) {
          ctx.stats.senseLinks++
          s = m[1] + link(target, m[2])
        }
      }
    }
    out.push(sn + s)
  })
  return out.join('<br>')
}

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
