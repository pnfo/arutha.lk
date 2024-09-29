/**
* read text/json files of dicts and populate the all dict db
* each dict gets its own table
*/
import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'; // Import the sqlite3 module and enable verbose logging
sqlite3.verbose()
import vk from 'vkbeautify'

const dictionaryList = ['sankshiptha', 'akshara_vinyasa', 'pali_buddhadatta', 'pali_sumangala', 'sinhala_to_english', 'english_to_sinhala']

const openDb = (file, isWrite = true) => {
    const mode = isWrite ? (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE) : sqlite3.OPEN_READONLY;
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(file, mode, err => err ? reject(err) : resolve(db));
    })
}

const runAsync = async (db, sql, params) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
}

const entryCounts = {}
const db = await openDb('../server-data/all-dict.db') // move to server-data after finalizing the db
for (const dictId of dictionaryList) {
    const entries = fs.readFileSync(`dict-input/${dictId}.txt`, 'utf-8').split('\n\n').map(entryStr => {
        // todo - if multiple words break to multiple rows in the table
        const firstNewlineIndex = entryStr.indexOf('\n')
        const word = entryStr.slice(0, firstNewlineIndex).trim()
        const meaning = entryStr.slice(firstNewlineIndex + 1).trim() // +1 to exclude the newline itself
        return [word, meaning]
    })
    await writeToSqlite(db, dictId, entries)
    console.log(`wrote ${entries.length} entries to table ${dictId}`)
    entryCounts[dictId] = entries.length
}
db.close()
fs.writeFileSync('../public/sanketha/entry-counts.json', vk.json(JSON.stringify(entryCounts)), 'utf-8')

// write to sqlite db
async function writeToSqlite(db, dictId, entries) {
    await runAsync(db, 'BEGIN')
    await runAsync(db, `DROP TABLE IF EXISTS ${dictId};`);
    // without rowid, the word becomes primary key (no duplicates allowed), also an extra index is not needed
    await runAsync(db, `CREATE TABLE ${dictId} (word TEXT NOT NULL PRIMARY KEY, meaning TEXT NOT NULL) WITHOUT ROWID;`);
    // const stmt = db.prepare(`INSERT INTO ${dictId} (word, meaning) VALUES (?, ?)`);
    // for (const pair of entries) {
    //     stmt.run(pair); 
    // }
    // stmt.finalize(); 
    for (const pair of entries) {
        //console.log(pair)
        await runAsync(db, `INSERT INTO ${dictId} (word, meaning) VALUES (?, ?)`, pair);
    }
    await runAsync(db, 'COMMIT')
}

// generate one sitemap for all dictionaries
const getSitemap = (dictId, resultsPerPage = 24) => {
    const numPages = Math.ceil(entryCounts[dictId] / resultsPerPage), sitemapLines = []
    for (let i = 1; i <= numPages; i++) sitemapLines.push(`https://arutha.lk/bookpage/${dictId}/${i}`)
    return sitemapLines.join('\n')
}
fs.writeFileSync(`../public/sitemap.txt`, dictionaryList.map(id => getSitemap(id)).join('\n'), 'utf-8')