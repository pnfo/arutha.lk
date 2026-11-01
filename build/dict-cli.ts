/**
 * npm run build:dict [-- --cst <tipitaka.app dict.db>]   -> db/dict.db, .cache/reports/dict-build.md, data/cst.lock
 * npm run build:dict:fixture                              -> e2e/fixtures/db/dict.db (the words of e2e/fixtures/words.txt)
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildDict } from './dict'

const args = process.argv.slice(2)
const opt = (name: string, def: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }
const fixture = args.includes('--fixture')
const out = fixture ? 'e2e/fixtures/db/dict.db' : opt('--out', 'db/dict.db')
const cstDb = opt('--cst', '../cst/db/dict.db')
// the fixture: the headwords of e2e/fixtures/words.txt, and its DPD forms (lines starting with ~)
const lines = fixture ? fs.readFileSync('e2e/fixtures/words.txt', 'utf8').split('\n').map(l => l.replace(/#.*/, '').trim().normalize('NFC')).filter(Boolean) : []
const only = fixture ? new Set(lines.filter(l => !l.startsWith('~'))) : undefined
const forms = fixture ? new Set(lines.filter(l => l.startsWith('~')).map(l => l.slice(1))) : undefined

const t0 = Date.now()
const { report, cst } = buildDict({ dataDir: 'data', cstDb, out, prev: out, only, forms })
const mb = (fs.statSync(out).size / 2 ** 20).toFixed(0)
report.push('', `${out}: ${mb} MB in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
fs.mkdirSync('.cache/reports', { recursive: true })
const rep = fixture ? '.cache/reports/dict-build-fixture.md' : '.cache/reports/dict-build.md'
fs.writeFileSync(rep, report.join('\n') + '\n')
// the content hash for the app build (web/vite.config.ts buildInfo)
fs.writeFileSync(path.join(path.dirname(out), 'build-info.json'), JSON.stringify({ content_hash: report.find(l => l.startsWith('content hash'))?.slice(13) || '' }) + '\n')
if (!fixture) {
  // which cst build the Pali data came from (committed: a changed lock = new Pali data)
  fs.writeFileSync('data/cst.lock', JSON.stringify({ source: path.resolve(cstDb).replace(/^.*\/node\//, '../'), builtAt: cst.builtAt, dpdVersion: cst.dpdVersion }, null, 2) + '\n')
}
console.log(report.join('\n'))
