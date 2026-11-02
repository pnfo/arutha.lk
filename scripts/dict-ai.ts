/**
 * M3 AI review of the Sinhala dictionaries (the pattern of cst scripts/dict-ai.ts): Claude on the user's plan
 * (`claude -p`, scripts/lib/claude.ts, every call cached in .cache/dict-ai) proposes exact text fixes; the results are
 * kept in data/dict-ai/review.jsonl (committed) and `apply` turns the sure ones into data/dict-fixes/<code>.tsv, which
 * the build applies (build/dicts/text.ts readTextDict). The text reviewed is the cleaned text (cleanLine).
 *
 *   npx tsx scripts/dict-ai.ts flagged [--dry]      the entries the mechanical checks flag (brackets, vowel signs,
 *                                                   unknown labels, see references to nowhere)
 *   npx tsx scripts/dict-ai.ts pilot [--n 300]      a random sample of English-Sinhala entries: the error rate decides
 *                                                   whether a full run is worth it
 *   npx tsx scripts/dict-ai.ts compare [--n 300]    the pilot by Opus (default effort), Opus low, Sonnet medium and
 *                                                   Gemini (GEMINI_API_KEY, --gemini gemini-4-argon); every distinct fix
 *                                                   judged blind by Opus (high) -> .cache/reports/dict-ai-compare.md
 *   npx tsx scripts/dict-ai.ts trial [--n 1000] [--seed 12345]  the prompt rounds (a new seed: a new sample): Opus low and Gemini review a sample with the prompts
 *       data/dict-ai/review.md (+ review-<model>.md), Opus (high) judges every distinct fix blind (judge.md) ->
 *       .cache/reports/dict-ai-trial.md: precision, recall, cost, and per model its wrong fixes and the errors it missed
 *   npx tsx scripts/dict-ai.ts full --from 0 --to 10000   the production review of English-Sinhala (entries in file order):
 *       Opus low and Gemini review each entry; a fix both made or Opus alone made is kept, a Gemini-only fix only when
 *       Opus (high) judges it right (50 entries a judge call) -> data/dict-ai/es-<from>-<to>.jsonl; prints the usage
 *   npx tsx scripts/dict-ai.ts apply                review.jsonl -> data/dict-fixes/*.tsv (English-Sinhala fixes are
 *                                                   mirrored into Sinhala-English, where the sense is the headword)
 *   npx tsx scripts/dict-ai.ts report               -> .cache/reports/dict-ai.md (every fix, before -> after)
 *   common: --model opus --jobs 4
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextDict } from '../build/dicts/text'
import type { DictRow } from '../build/dicts/types'
import { Claude, pool, type AskOptions } from './lib/claude'
import { Gemini } from './lib/gemini'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (name: string, def?: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }
const STORE = path.join(repo, 'data/dict-ai/review.jsonl')
const FILES: Record<string, { file: string; aliases?: boolean }> = {
  'english-sinhala': { file: 'english_to_sinhala.txt' }, 'sinhala-english': { file: 'sinhala_to_english.txt' },
  sankshiptha: { file: 'sankshiptha.txt', aliases: true }, akshara: { file: 'akshara_vinyasa.txt', aliases: true },
}
const rows = (code: string): DictRow[] => readTextDict(path.join(repo, 'data/dicts', FILES[code].file), { aliases: FILES[code].aliases })
const head = (r: DictRow) => [r.word, ...(r.aliases ?? [])].join(', ')
const entryText = (r: DictRow) => `${head(r)}\n${r.meaning}`

const SYSTEM = `You proofread entries of Sinhala dictionaries (the Sinhala Dictionary Office's සංක්ෂිප්ත සිංහල ශබ්දකෝෂය and
අක්ෂර වින්‍යාස ශබ්දකෝෂය, and an English-Sinhala / Sinhala-English dictionary). The text is old digitised data: typing errors,
broken Unicode (a vowel sign typed twice or in the wrong place, a lost letter), unbalanced brackets, mistyped labels.
Propose only fixes you are sure of, as exact replacements: "from" is an exact substring of the entry (long enough to be
unique, at most one line), "to" its corrected text. Do not restyle, reword, add meanings or change correct text. A wrong
English-Sinhala translation may be fixed only when it is clearly wrong (not merely a different choice of word).
kind: typo (spelling / Unicode), bracket, label, ref (a see reference), wrong (a wrong meaning), other.
When nothing is surely wrong, return no fixes.`
const SCHEMA = {
  type: 'object', required: ['fixes'], properties: {
    fixes: {
      type: 'array', items: {
        type: 'object', required: ['headword', 'from', 'to', 'kind', 'why'],
        properties: { headword: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, kind: { type: 'string' }, why: { type: 'string' } },
      },
    },
  },
}
interface Fix { code: string; headword: string; from: string; to: string; kind: string; why: string; job: string }
const claude = new Claude({ system: SYSTEM, cacheDir: path.join(repo, '.cache/dict-ai'), model: arg('--model', 'opus')!, dry: args.includes('--dry') })

function readStore(): Fix[] { return fs.existsSync(STORE) ? fs.readFileSync(STORE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [] }
function writeStore(fixes: Fix[]) {
  const seen = new Set<string>()
  const out = fixes.filter(f => { const k = [f.code, f.headword, f.from].join('\t'); return !seen.has(k) && seen.add(k) })
  fs.writeFileSync(STORE, out.map(f => JSON.stringify(f)).join('\n') + '\n')
}

/** a batch of entries of one dictionary, with a note per entry on what was flagged */
type Ask = (prompt: string) => Promise<{ fixes: Omit<Fix, 'code' | 'job'>[] } | null>
const byClaude = (o: AskOptions = {}): Ask => p => claude.ask('review-1', p, SCHEMA, o)
async function review(job: string, code: string, items: { r: DictRow; note?: string }[], ask: Ask = byClaude()): Promise<Fix[]> {
  const prompt = `Dictionary: ${code}\n\n` + items.map(({ r, note }) => `<entry>\n${entryText(r)}\n</entry>${note ? `\nflagged: ${note}` : ''}`).join('\n\n')
  const a = await ask(prompt)
  const byHead = new Map(items.map(({ r }) => [r.word, r]))
  return (a?.fixes ?? []).flatMap(f => {
    const r = byHead.get(f.headword.split(',')[0].trim()) ?? items.find(({ r }) => entryText(r).includes(f.from))?.r
    // only exact substrings of the entry are kept
    return r && f.from && f.from !== f.to && entryText(r).includes(f.from) ? [{ ...f, headword: r.word, code, job }] : []
  })
}
const chunks = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

async function flagged() {
  const jobs: { code: string; items: { r: DictRow; note: string }[] }[] = []
  for (const code of ['english-sinhala', 'sankshiptha', 'akshara']) {
    const abbrevs = JSON.parse(fs.readFileSync(path.join(repo, 'data/abbrev', `${code === 'english-sinhala' ? 'sinhala-english' : code}.json`), 'utf8'))
    const all = rows(code), heads = new Set(all.flatMap(r => [r.word, ...(r.aliases ?? [])]))
    const items: { r: DictRow; note: string }[] = []
    for (const r of all) {
      const t = entryText(r), notes: string[] = []
      if (t.split('(').length !== t.split(')').length || t.split('[').length !== t.split(']').length) notes.push('unbalanced brackets')
      if (/[ා-ෟෲෳ][්ා-ෟෲෳ]/.test(t)) notes.push('two vowel signs in a row')
      if (code === 'english-sinhala' && /(^|[\s(])[ංඃ්ා-ෟ]/m.test(t)) notes.push('a sign at the start of a word')
      const labels = [...t.matchAll(/\[([^\]]{1,24})\]/g)].map(m => m[1]).filter(l => abbrevs[l] === undefined && !/\+/.test(l))
      if (code !== 'english-sinhala' && labels.length) notes.push(`labels not in the list: ${labels.join(', ')} (the list: ${Object.keys(abbrevs).join(' ')})`)
      for (const m of t.matchAll(/(\S+) බ\./g)) if (!heads.has(m[1])) {
        const near = [...heads].filter(h => h.slice(0, 2) === m[1].slice(0, 2)).sort((a, b) => lev(a, m[1]) - lev(b, m[1])).slice(0, 6)
        notes.push(`the see reference "${m[1]} බ." is not a headword; the closest headwords: ${near.join(', ')}`)
      }
      if (notes.length) items.push({ r, note: notes.join('; ') })
    }
    for (const c of chunks(items, 10)) jobs.push({ code, items: c })
    console.log(code, items.length, 'flagged')
  }
  return run('flagged', jobs)
}

/** a fixed sample of English-Sinhala in batches of 15 (the same entries every run: the calls stay cached) */
function sample(n: number): DictRow[][] {
  const all = rows('english-sinhala'), pick: DictRow[] = []
  for (let x = 12345; pick.length < n;) { x = (x * 1103515245 + 12345) % 2 ** 31; pick.push(all[x % all.length]) }
  return chunks(pick, 15)
}
async function pilot() {
  const n = +arg('--n', '300')!
  return run('pilot', sample(n).map(c => ({ code: 'english-sinhala', items: c.map(r => ({ r })) })), n)
}

// ---------------- the comparison of models ----------------
const JUDGE_SYSTEM = `You are an expert in Sinhala and English lexicography. For each proposed fix of a dictionary entry,
decide whether applying it makes the entry correct: "right" (a real error, correctly fixed), "wrong" (the text was right,
or the fix is wrong or makes it worse), "unsure". Judge each fix on its own; several fixes may address the same error.`
const JUDGE_SCHEMA = {
  type: 'object', required: ['verdicts'], properties: {
    verdicts: { type: 'array', items: { type: 'object', required: ['id', 'verdict'], properties: { id: { type: 'integer' }, verdict: { type: 'string', enum: ['right', 'wrong', 'unsure'] }, note: { type: 'string' } } } },
  },
}
/** the cost of the Claude calls of a run, from the usage stored with each cached call */
function claudeCost(prompts: string[], o: AskOptions): { cost: number; ms: number; out: number } {
  let cost = 0, ms = 0, out = 0
  for (const p of prompts) {
    const f = claude.cacheFile('review-1', p, o)
    if (!fs.existsSync(f)) continue
    const u = JSON.parse(fs.readFileSync(f, 'utf8')).usage ?? {}
    cost += u.cost ?? 0; ms += u.ms ?? 0; out += u.output ?? 0
  }
  return { cost, ms, out }
}
async function compare() {
  const n = +arg('--n', '300')!, batches = sample(n)
  const gem = new Gemini({ system: SYSTEM, cacheDir: path.join(repo, '.cache/dict-ai'), model: arg('--gemini', 'gemini-4-argon')!, price: [2, 10] })
  const variants: { name: string; ask: Ask; o?: AskOptions }[] = [
    { name: 'opus (default)', ask: byClaude(), o: {} },
    { name: 'opus low', ask: byClaude({ effort: 'low' }), o: { effort: 'low' } },
    { name: 'sonnet medium', ask: byClaude({ model: 'sonnet', effort: 'medium' }), o: { model: 'sonnet', effort: 'medium' } },
    { name: gem.o.model, ask: p => gem.ask('review-1', p, SCHEMA) },
  ]
  const prompts = batches.map(c => `Dictionary: english-sinhala\n\n` + c.map(r => `<entry>\n${entryText(r)}\n</entry>`).join('\n\n'))
  const found = new Map<string, Fix[]>()
  for (const v of variants) {
    const t0 = Date.now()
    found.set(v.name, (await pool(batches, +arg('--jobs', '4')!, c => review('compare', 'english-sinhala', c.map(r => ({ r })), v.ask))).flat())
    console.log(v.name, found.get(v.name)!.length, 'fixes', `${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  // every distinct fix (entry, from, to), judged blind, one call per entry batch
  const key = (f: Fix) => [f.headword, f.from.trim(), f.to.trim()].join('\t')
  const distinct = new Map<string, Fix>()
  for (const fs_ of found.values()) for (const f of fs_) distinct.set(key(f), f)
  const verdict = new Map<string, string>()
  const judge = new Claude({ system: JUDGE_SYSTEM, cacheDir: path.join(repo, '.cache/dict-ai'), model: 'opus' })
  await pool(batches, 4, async c => {
    const heads = new Set(c.map(r => r.word))
    const fixes = [...distinct.values()].filter(f => heads.has(f.headword)).sort((a, b) => key(a).localeCompare(key(b)))
    if (!fixes.length) return
    const prompt = c.filter(r => fixes.some(f => f.headword === r.word)).map(r => `<entry>\n${entryText(r)}\n</entry>`).join('\n\n') +
      '\n\nProposed fixes:\n' + fixes.map((f, i) => `${i}. [${f.headword}] "${f.from.trim()}" -> "${f.to.trim()}"`).join('\n')
    const a = await judge.ask<{ verdicts: { id: number; verdict: string }[] }>('judge-1', prompt, JUDGE_SCHEMA, { effort: 'high' })
    for (const v of a?.verdicts ?? []) if (fixes[v.id]) verdict.set(key(fixes[v.id]), v.verdict)
  })
  const right = [...distinct.keys()].filter(k => verdict.get(k) === 'right')
  // the errors found: a right fix counts once per entry and "from" (two right fixes of the same text are one error)
  const errKey = (k: string) => k.split('\t').slice(0, 2).join('\t')
  const errors = new Set(right.map(errKey))
  const out = ['# AI review: models compared', '', `${n} English-Sinhala entries, ${distinct.size} distinct fixes, ${right.length} right ` +
    `(${errors.size} errors), judged blind by Opus (high effort)`, '',
    '| model | fixes | right | wrong | unsure | precision | errors found (recall) | cost of the run | per 63k entries | s per call |', '|---|---|---|---|---|---|---|---|---|---|']
  for (const v of variants) {
    const ks = [...new Set(found.get(v.name)!.map(key))]
    const c = (x: string) => ks.filter(k => verdict.get(k) === x).length
    const rec = new Set(ks.filter(k => verdict.get(k) === 'right').map(errKey)).size
    const usage = v.o ? claudeCost(prompts, v.o) : { cost: gem.total.cost, ms: gem.total.ms, out: gem.total.output }
    out.push(`| ${v.name} | ${ks.length} | ${c('right')} | ${c('wrong')} | ${c('unsure')} | ${(100 * c('right') / Math.max(1, ks.length)).toFixed(0)}% | ` +
      `${rec} (${(100 * rec / Math.max(1, errors.size)).toFixed(0)}%) | $${usage.cost.toFixed(2)} | $${(usage.cost * 63290 / n).toFixed(0)} | ${(usage.ms / 1000 / batches.length).toFixed(0)} |`)
  }
  out.push('', 'Claude costs are the API-equivalent cost reported by `claude -p` (on the plan they use the plan\'s limits); Gemini at $2 / $10 per 1M tokens. Gemini cost counts only uncached calls of this run.', '',
    '## The fixes', '', '| headword | from | to | verdict | by |', '|---|---|---|---|---|')
  for (const [k, f] of distinct) out.push(`| ${f.headword} | ${f.from.trim()} | ${f.to.trim()} | ${verdict.get(k) ?? '?'} | ${variants.filter(v => found.get(v.name)!.some(x => key(x) === k)).map(v => v.name).join(', ')} |`.replace(/\n/g, ' '))
  fs.writeFileSync(path.join(repo, '.cache/reports/dict-ai-compare.md'), out.join('\n'))
  console.log(out.slice(0, 10).join('\n'))
}

async function run(job: string, jobs: { code: string; items: { r: DictRow; note?: string }[] }[], entries?: number) {
  let done = 0
  const found = (await pool(jobs, +arg('--jobs', '4')!, async j => {
    const f = await review(job, j.code, j.items)
    if (++done % 5 === 0) console.log(`${done}/${jobs.length}`)
    return f
  })).flat()
  writeStore([...readStore().filter(f => f.job !== job), ...found])
  console.log(`${job}: ${found.length} fixes${entries ? ` in ${entries} entries` : ''}`)
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t }
  }
  return d[b.length]
}

function apply() {
  const tsv = new Map<string, string[]>()
  const add = (code: string, ...f: string[]) => tsv.set(code, [...(tsv.get(code) ?? []), f.map(x => x.replace(/\n/g, '\\n')).join('\t')])
  const renamed = new Map<string, string>() // Sinhala-English headwords that several fixes change: the fixes in turn
  const prod: Fix[] = fs.readdirSync(path.join(repo, 'data/dict-ai')).filter(f => /^es-\d+-\d+\.jsonl$/.test(f))
    .flatMap(f => fs.readFileSync(path.join(repo, 'data/dict-ai', f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)))
    .filter((x: { by: string; v?: string }) => x.by !== 'gemini' || x.v === 'right')
    .map((x: { h: string; f: string; t: string; by: string }) => ({ code: 'english-sinhala', headword: x.h, from: x.f, to: x.t, kind: x.by, why: '', job: 'full' }))
  // the same fix with and without the sense number ("3. [n.] x", "[n.] x"): once
  const seen = new Set<string>(), bare = (x: string) => x.replace(/^\d+\.\s*/, '')
  for (const f of [...readStore(), ...prod]) {
    const k = [f.code, f.headword, bare(f.from)].join('\t') // two fixes of the same text: the first
    if (f.kind === 'reject' || seen.has(k)) continue
    seen.add(k)
    let whole = false
    // the Sinhala sense of an English entry is a Sinhala-English headword, its labels are on that entry's line of the
    // English word: the same fix there
    if (f.code === 'english-sinhala') {
      esIndex ??= new Map(rows('english-sinhala').map(r => [r.word, r.meaning.split('\n')]))
      for (const line of (esIndex.get(f.headword) ?? []).filter(l => l.includes(f.from))) {
        const [oldLab, oldSense] = split(line), [newLab, newSense] = split(line.replace(f.from, f.to))
        if (oldLab !== newLab) add('sinhala-english', oldSense, `${oldLab}${f.headword}`, `${newLab}${f.headword}`)
        if (oldSense !== newSense && oldLab === newLab) {
          const cur = renamed.get(oldSense) ?? oldSense
          const [, from] = split(f.from.trim()), [, to] = split(f.to.trim()) // "3. අරුවය": the sense alone
          renamed.set(oldSense, cur === oldSense ? newSense : cur.replace(cur.includes(f.from.trim()) ? f.from.trim() : from, cur.includes(f.from.trim()) ? f.to.trim() : to))
          whole = true
        }
      }
    }
    // a corrected sense is renamed everywhere (senses.tsv), other fixes are fixes of the entry
    if (!whole) add(f.code, f.headword, f.from, f.to)
  }
  for (const [a, b] of renamed) add('senses', a, b)
  for (const [code, lines] of tsv) {
    fs.writeFileSync(path.join(repo, 'data/dict-fixes', `${code}.tsv`),
      `# ${code === 'senses' ? 'English-Sinhala senses renamed everywhere: sense, corrected sense' : `${code}: headword, text, replacement`} (scripts/dict-ai.ts apply; hand edits: add lines at the end)\n${[...new Set(lines)].join('\n')}\n`)
    console.log(code, lines.length)
  }
}
let esIndex: Map<string, string[]> | undefined
/** a sense line of English-Sinhala: [its labels ("[n.] "), the Sinhala sense] (without the number) */
function split(line: string): [string, string] {
  const m = /^(?:\d+\.\s*)?((?:\[[^\]]*\]\s*)*)(.*)$/.exec(line)!
  return [m[1], m[2].trim()]
}

function report() {
  const fixes = readStore()
  const out = ['# AI review of the dictionaries', '', `${fixes.length} fixes`, '']
  for (const job of [...new Set(fixes.map(f => f.job))]) {
    out.push(`## ${job}`, '', '| dict | headword | kind | from | to | why |', '|---|---|---|---|---|---|')
    for (const f of fixes.filter(f => f.job === job)) out.push(`| ${f.code} | ${f.headword} | ${f.kind} | ${f.from} | ${f.to} | ${f.why} |`.replace(/\n/g, ' '))
    out.push('')
  }
  fs.writeFileSync(path.join(repo, '.cache/reports/dict-ai.md'), out.join('\n'))
  console.log('wrote .cache/reports/dict-ai.md')
}

// ---------------- the prompt rounds (compact: {h, f, t} answers, 25 entries a call, the judge answers id lists) ----------------
const COMPACT = {
  type: 'object', required: ['fixes'], properties: {
    fixes: { type: 'array', items: { type: 'object', required: ['h', 'f', 't'], properties: { h: { type: 'string' }, f: { type: 'string' }, t: { type: 'string' } } } },
  },
}
const JUDGE2 = { type: 'object', required: ['right', 'wrong'], properties: { right: { type: 'array', items: { type: 'integer' } }, wrong: { type: 'array', items: { type: 'integer' } } } }
const readPrompt = (name: string) => { const f = path.join(repo, 'data/dict-ai', `${name}.md`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : '' }
const hash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8)
type Compact = { fixes: { h: string; f: string; t: string }[] }

async function trial() {
  const n = +arg('--n', '1000')!, gemModel = arg('--gemini', 'gemini-4-argon')!
  const all = rows('english-sinhala'), pick: DictRow[] = []
  for (let x = +arg('--seed', '12345')!; pick.length < n;) { x = (x * 1103515245 + 12345) % 2 ** 31; pick.push(all[x % all.length]) }
  const batches = chunks([...new Map(pick.map(r => [r.word, r])).values()], 25)
  const cache = path.join(repo, '.cache/dict-ai')
  const sys = (m: string) => [readPrompt('review'), readPrompt(`review-${m}`)].filter(Boolean).join('\n\n')
  const opus = new Claude({ system: sys('opus'), cacheDir: cache, model: 'opus' })
  const gem = new Gemini({ system: sys('gemini'), cacheDir: cache, model: gemModel, price: [2, 10] })
  const variants: { name: string; ask: (p: string) => Promise<Compact | null>; file?: (p: string) => string }[] = [
    { name: 'opus low', ask: p => opus.ask(`rv-${hash(sys('opus'))}`, p, COMPACT, { effort: 'low' }), file: p => opus.cacheFile(`rv-${hash(sys('opus'))}`, p, { effort: 'low' }) },
    { name: gemModel, ask: p => gem.ask(`rv-${hash(sys('gemini'))}`, p, COMPACT), file: p => gem.cacheFile(`rv-${hash(sys('gemini'))}`, p) },
  ]
  const prompt = (c: DictRow[]) => c.map(entryText).join('\n\n')
  type F = { h: string; f: string; t: string }
  const key = (x: F) => [x.h, x.f, x.t].join('\t')
  const found = new Map<string, Set<string>>(), byKey = new Map<string, F>()
  for (const v of variants) {
    const got = (await pool(batches, +arg('--jobs', '6')!, async c => {
      const a = await v.ask(prompt(c)), text = new Map(c.map(r => [r.word, entryText(r)]))
      // only exact substrings of a reviewed entry
      return (a?.fixes ?? []).map(x => ({ h: x.h.trim(), f: x.f.trim(), t: x.t.trim() })).filter(x => x.f && x.f !== x.t && text.get(x.h)?.includes(x.f))
    })).flat()
    found.set(v.name, new Set(got.map(key)))
    for (const x of got) byKey.set(key(x), x)
    console.log(v.name, got.length, 'fixes')
  }
  // the judge: one call per batch with its fixes, ids in the call
  const judge = new Claude({ system: readPrompt('judge'), cacheDir: cache, model: 'opus' })
  const verdict = new Map<string, 'right' | 'wrong'>()
  await pool(batches, 6, async c => {
    const heads = new Set(c.map(r => r.word)), fx = [...byKey.values()].filter(x => heads.has(x.h)).sort((a, b) => key(a).localeCompare(key(b)))
    if (!fx.length) return
    const p = c.filter(r => fx.some(x => x.h === r.word)).map(entryText).join('\n\n') + '\n\nFixes:\n' + fx.map((x, i) => `${i}. ${x.h}: ${x.f} → ${x.t}`).join('\n')
    const a = await judge.ask<{ right: number[]; wrong: number[] }>(`jd-${hash(readPrompt('judge'))}`, p, JUDGE2, { effort: 'high' })
    for (const i of a?.right ?? []) if (fx[i]) verdict.set(key(fx[i]), 'right')
    for (const i of a?.wrong ?? []) if (fx[i]) verdict.set(key(fx[i]), 'wrong')
  })
  const errKey = (k: string) => k.split('\t').slice(0, 2).join('\t')
  const errors = new Set([...byKey.keys()].filter(k => verdict.get(k) === 'right').map(errKey))
  const line = (k: string) => { const x = byKey.get(k)!; return `- ${x.h}: ${x.f} → ${x.t}` }
  const out = [`# AI review trial: ${batches.flat().length} English-Sinhala entries`, '',
    `prompts: review ${hash(readPrompt('review'))}, opus +${hash(readPrompt('review-opus'))}, gemini +${hash(readPrompt('review-gemini'))}; ` +
    `${byKey.size} distinct fixes, ${errors.size} errors (right fixes, judged blind by Opus high)`, '',
    '| model | fixes | right | wrong | precision | errors found | cost | per 63k entries | output tokens |', '|---|---|---|---|---|---|---|---|---|']
  const sections: string[] = []
  for (const v of variants) {
    const ks = [...found.get(v.name)!], right = ks.filter(k => verdict.get(k) === 'right'), wrong = ks.filter(k => verdict.get(k) === 'wrong')
    const mine = new Set(right.map(errKey)), missed = [...byKey.keys()].filter(k => verdict.get(k) === 'right' && !mine.has(errKey(k)))
    let cost = 0, outTok = 0
    for (const c of batches) { const f = v.file!(prompt(c)); if (fs.existsSync(f)) { const u = JSON.parse(fs.readFileSync(f, 'utf8')).usage ?? {}; cost += u.cost ?? 0; outTok += u.output ?? 0 } }
    out.push(`| ${v.name} | ${ks.length} | ${right.length} | ${wrong.length} | ${(100 * right.length / Math.max(1, ks.length)).toFixed(0)}% | ` +
      `${mine.size} (${(100 * mine.size / Math.max(1, errors.size)).toFixed(0)}%) | $${cost.toFixed(2)} | $${(cost * 63290 / batches.flat().length).toFixed(0)} | ${outTok} |`)
    sections.push(`## ${v.name}: wrong (${wrong.length})`, ...wrong.map(line), '', `## ${v.name}: missed (${missed.length})`, ...[...new Map(missed.map(k => [errKey(k), k])).values()].map(line), '')
  }
  const both = [...found.values()].reduce((a, b) => new Set([...a].filter(k => b.has(k))))
  out.push('', `both models: ${both.size} identical fixes, ${[...both].filter(k => verdict.get(k) === 'right').length} right; ` +
    `union: ${new Set([...byKey.keys()].filter(k => verdict.get(k) === 'right').map(errKey)).size} errors`, '', ...sections)
  fs.writeFileSync(path.join(repo, `.cache/reports/dict-ai-trial-${arg('--seed', '12345')}.md`), out.join('\n'))
  console.log(out.slice(0, 9).join('\n'))
}

async function full() {
  const from = +arg('--from', '0')!, to = +arg('--to', '10000')!, gemModel = arg('--gemini', 'gemini-4-argon')!
  const batches = chunks(rows('english-sinhala').slice(from, to), 25)
  const cache = path.join(repo, '.cache/dict-ai')
  const sys = (m: string) => [readPrompt('review'), readPrompt(`review-${m}`)].filter(Boolean).join('\n\n')
  const opus = new Claude({ system: sys('opus'), cacheDir: cache, model: 'opus', stopOnLimit: args.includes('--stop-on-limit') })
  const gem = new Gemini({ system: sys('gemini'), cacheDir: cache, model: gemModel, price: [2, 10] })
  const judge = new Claude({ system: readPrompt('judge'), cacheDir: cache, model: 'opus', stopOnLimit: args.includes('--stop-on-limit') })
  type F = { h: string; f: string; t: string; by?: string; v?: string }
  const key = (x: F) => [x.h, x.f, x.t].join('\t')
  const clean = (a: Compact | null, c: DictRow[]) => {
    const text = new Map(c.map(r => [r.word, entryText(r)]))
    return (a?.fixes ?? []).map(x => ({ h: x.h.trim(), f: x.f.trim(), t: x.t.trim() })).filter(x => x.f && x.f !== x.t && text.get(x.h)?.includes(x.f))
  }
  let done = 0
  const reviewed = await pool(batches, +arg('--jobs', '6')!, async c => {
    const p = c.map(entryText).join('\n\n')
    const [o, g] = await Promise.all([opus.ask<Compact>(`rv-${hash(sys('opus'))}`, p, COMPACT, { effort: 'low' }), gem.ask<Compact>(`rv-${hash(sys('gemini'))}`, p, COMPACT)])
    if (++done % 20 === 0) console.log(`reviewed ${done}/${batches.length}`)
    const fixes = new Map<string, F>()
    for (const x of clean(o, c)) fixes.set(key(x), { ...x, by: 'opus' })
    for (const x of clean(g, c)) { const k = key(x); fixes.set(k, { ...x, by: fixes.has(k) ? 'both' : 'gemini' }) }
    return { c, fixes: [...fixes.values()] }
  })
  // the judge: the Gemini-only fixes, two review batches a call, only the entries they touch
  await pool(chunks(reviewed, 2), 6, async pair => {
    const fx = pair.flatMap(b => b.fixes).filter(x => x.by === 'gemini')
    if (!fx.length) return
    const heads = new Set(fx.map(x => x.h))
    const p = pair.flatMap(b => b.c).filter(r => heads.has(r.word)).map(entryText).join('\n\n') + '\n\nFixes:\n' + fx.map((x, i) => `${i}. ${x.h}: ${x.f} → ${x.t}`).join('\n')
    const a = await judge.ask<{ right: number[]; wrong: number[] }>(`jd-${hash(readPrompt('judge'))}`, p, JUDGE2, { effort: 'high' })
    for (const i of a?.right ?? []) if (fx[i]) fx[i].v = 'right'
    for (const i of a?.wrong ?? []) if (fx[i]) fx[i].v = 'wrong'
  })
  const all = reviewed.flatMap(b => b.fixes)
  fs.writeFileSync(path.join(repo, `data/dict-ai/es-${from}-${to}.jsonl`), all.map(x => JSON.stringify(x)).join('\n') + '\n')
  const n = (by: string, v?: string) => all.filter(x => x.by === by && (v === undefined || x.v === v)).length
  const usd = (u: { cost: number }) => `$${u.cost.toFixed(2)}`
  console.log(`${to - from} entries: ${all.length} fixes; both ${n('both')}, Opus only ${n('opus')}, Gemini only ${n('gemini')} ` +
    `(judged right ${n('gemini', 'right')}, wrong ${n('gemini', 'wrong')}, unsure ${n('gemini') - n('gemini', 'right') - n('gemini', 'wrong')}); ` +
    `kept ${n('both') + n('opus') + n('gemini', 'right')}`)
  console.log(`usage of this run (uncached calls): Opus review ${opus.calls} calls ${usd(opus.total)}, judge ${judge.calls} calls ${usd(judge.total)} ` +
    `(API-equivalent, on the plan), Gemini ${gem.calls} calls ${usd(gem.total)}`)
}

const cmd = args[0]
if (cmd === 'flagged') await flagged()
else if (cmd === 'pilot') await pilot()
else if (cmd === 'compare') await compare()
else if (cmd === 'trial') await trial()
else if (cmd === 'full') await full()
else if (cmd === 'apply') apply()
else if (cmd === 'report') report()
else console.log('flagged | pilot [--n 300] | apply | report')
