/**
 * this script simply checks the data file for possible errors which need to be fixed
 * the text file needs to be read and parsed by the website directly
 */
import fs from 'fs'
import vkb from 'vkbeautify'

const dictId = 'akshara-vinyasa'
const sanketha = JSON.parse(fs.readFileSync(`public/${dictId}-sanketha.json`))
Object.keys(sanketha).forEach(san => sanketha[san] = {title: sanketha[san], count: 0})
const entries = fs.readFileSync(`public/${dictId}-dict.txt`, 'utf-8').split('\n\n')
    .map(g => g.split('\n').map(l => l.trim())).map(g => ({word: g[0], meaning: g.slice(1)}))

console.log(`found ${entries.length} entries`)
const sankethaCounts = {}

const json = entries.forEach(({word, meaning}) => {
    if (word.includes('[') || word.includes(' (') || word.includes('/')) console.log(`brackets in word ${word}`)
    const subWords = word.split(', ')
    if (subWords.length != word.split(',').length) console.log(`does not have space after comma in ${word}`)
    if (subWords.length > 1 && subWords.filter(w => w.length <= 2).length) console.log(`short word part in ${word}`)
    if (!meaning.length) console.log(`empty meaning for word ${word}`)
    if (meaning.length != 1) console.log(`meaning too many lines in word ${word}, ${meaning.length}`)
    if (!meaning[0].startsWith('[')) console.log(`meaning does not start with [ for ${word}`)
    
    meaning.forEach(line => {
        [...line.matchAll(/\[([^\]\+]+)\]/g)].map(m => m[1]).forEach(san => {
            if (!sanketha[san]) console.log(`sanketha ${san} not found. in word ${word}`)
            else sanketha[san].count++
        })
    })
    meaning.forEach(line => {
        [...line.matchAll(/\([^\)]*?(\S+?\.) .*?\)/g)].map(m => m[1]).forEach(san => {
            if (!sanketha[san]) console.log(`sanketha ${san} not found. in word ${word}`)
            else sanketha[san].count++
        })
    })
    
    return [word, meaning]
})

fs.writeFileSync(`public/${dictId}-sanketha-counts.json`, vkb.json(JSON.stringify(sanketha)), 'utf-8')
//Object.entries(sankethaCounts)
//    .sort((a, b) => a[0].localeCompare(b[0])).map(pair => pair.join(',')).join('\n'), 'utf-8')

// write sitemap file
const numEntriesPerPage = 24, numPages = Math.ceil(entries.length / numEntriesPerPage), sitemapLines = []
for (let i = 1; i <= numPages; i++) sitemapLines.push(`https://arutha.lk/bookpage/${dictId}/${i}`)
fs.writeFileSync(`public/sitemap-${dictId}.txt`, sitemapLines.join('\n'), 'utf-8')