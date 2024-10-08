'use strict'

import fs from 'fs'; // Import the file system module
import vk from 'vkbeautify'

const createOrIncrement = (obj, key) => {
    if (obj[key]) {
        obj[key].count++
    } else {
        obj[key] = {count: 1}
    }
}

let duRemoveCount = 0
const appendToGroups = (obj, key, value, a) => {
    let shouldRemove = false
    if (obj[key]) {
        // const duToDa = value.replace(/ජු/g, 'ඬු')
        // if (value != duToDa && obj[key][duToDa] && !a) {
        //     console.log(value)
        //     duRemoveCount++
        //     shouldRemove = true
        // }
        if (!obj[key][value]) obj[key][value] = [a]
        else {
            // if (!a) {
            //     shouldRemove = true
            //     console.log(value)
            // }
            obj[key][value].push(a)
        }
    } else {
        obj[key] = ({[value]: [a]})
    }
    return shouldRemove
}

// const noZwj = (s) => s.replace(/\u200d/g, '') + ' '
// let filledCount = 0
// const mdrData = JSON.parse(fs.readFileSync('madhura-scraped/mdr-english-dict.json', 'utf8')), mdrGroups = {}
// mdrData.forEach(({e, s, a}) => appendToGroups(mdrGroups, e + ' ', noZwj(s), a))

const englishGroups = {}, sinhalaGroups = {}, sanketha = {}

const jsonData = JSON.parse(fs.readFileSync('english-dict.json', 'utf8'))
console.log(`total entries in the english dict ${jsonData.length}`)
const dedupedDict = jsonData.filter(entry => {
    if (!entry.s || !entry.e) console.error(`empty s or e ${entry}`)
    
    //return !appendToGroups(englishGroups, entry.e + ' ', entry.s + ' ', entry.a)
    
    appendToGroups(englishGroups, entry.e + ' ', entry.s + ' ', entry.a)
    appendToGroups(sinhalaGroups, entry.s + ' ', entry.e + ' ', entry.a)
    if (entry.a) {
        createOrIncrement(sanketha, entry.a)
    }
});
// console.log(`num duplicates ${jsonData.length - dedupedDict.length}`)
// console.log(`du remove count ${duRemoveCount}`)

const groupsToDictStr = groups => Object.entries(groups).map(([key, meanings]) => {
    const entries = Object.entries(meanings)
    const meaningsStr = entries.map(([meaning, types], i) =>{
        const typesStr = types.sort().map(a => a ? `[${a}]` : '').join('')
        return (entries.length > 1 ? `${i+1}. ` : '') + (typesStr ? typesStr + ' ' : '') + meaning.trim()
    }).join('\n')
    
    return key.trim() + '\n' + meaningsStr
}).join('\n\n')

//fs.writeFileSync('english-filled.json', vk.json(JSON.stringify(dedupedDict)), 'utf8')
fs.writeFileSync('dict-input/english_to_sinhala.txt', groupsToDictStr(englishGroups), 'utf-8')
fs.writeFileSync('dict-input/sinhala_to_english.txt', groupsToDictStr(sinhalaGroups), 'utf-8')
const sortedEntries = Object.entries(sanketha).sort((a, b) => b[1].count - a[1].count); // sort by count
fs.writeFileSync('../public/sanketha/sinhala_to_english-sanketha-counts.json', vk.json(JSON.stringify(Object.fromEntries(sortedEntries))), 'utf-8')