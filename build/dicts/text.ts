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

export function readTextDict(file: string, opts: { aliases?: boolean } = {}): DictRow[] {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
  const rows: DictRow[] = []
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) continue
    const words = opts.aliases ? lines[0].split(/\s*,\s*/).filter(Boolean) : [lines[0]]
    rows.push({ word: words[0].normalize('NFC'), aliases: words.slice(1).map(w => w.normalize('NFC')), meaning: lines.slice(1).join('\n').normalize('NFC') })
  }
  return rows
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
