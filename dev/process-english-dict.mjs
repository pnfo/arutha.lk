'use strict'

import fs from 'fs'; // Import the file system module
import vk from 'vkbeautify'

const createOrAppend = (obj, key, value) => {
    if (obj[key]) {
        obj[key].push(value)
    } else {
        obj[key] = [value]
    }
}

const appendToGroups = (obj, key, value, a) => {
    if (obj[key]) {
        // const noSpace = value.replace(/ /g, '')
        // if (value != noSpace && obj[key][noSpace]) console.log(value)
        if (!obj[key][value]) obj[key][value] = [a]
        else {
            obj[key][value].push(a)
        }
    } else {
        obj[key] = ({[value]: [a]})
    }
}

//const englishGroups = {}, sinhalaGroups = {}
const englishGroups = {}
let duplicateCount = 0

const data = fs.readFileSync('english-dict.json', 'utf8'); 
const jsonData = JSON.parse(data);
console.log(`total entries in the english dict ${jsonData.length}`)
const dedupedDict = jsonData.filter(entry => {
    if (!entry.s || !entry.e) console.error(`empty s or e ${entry}`)
    
    appendToGroups(englishGroups, entry.e, entry.s, entry.a)
    // if (isDup) {
    //     duplicateCount++
    //     //console.log(entry)
    // }
    // return !isDup

    // const aStr = entry.a ? `[${entry.a}] ` : ''
    // createOrAppend(englishGroups, entry.e + ' ', aStr + entry.s)
    // createOrAppend(sinhalaGroups, entry.s, aStr + entry.e)
});
console.log(`num duplicates ${duplicateCount}`)

// const groupsToDictStr = groups => Object.entries(groups).map(([key, arr]) => 
//     arr.length > 1 ? key.trim() + '\n' + arr.map((line, i) => `${i+1}. ${line}`).join('\n') : key.trim() + '\n' + arr[0]
// ).join('\n\n')

const groupsToDictStr = groups => Object.entries(groups).map(([key, meanings]) => {
    const entries = Object.entries(meanings)
    const mStr = entries.map(([meaning, types], i) => 
        (entries.length > 1 ? `${i+1}. ` : '') + 
        types.map(a => a ? `[${a}]` : '').join('') + ' ' + 
        meaning.trim()
    ).join('\n')
    
    return key.trim() + '\n' + mStr
}).join('\n\n')

//fs.writeFileSync('english-deduped-2.json', vk.json(JSON.stringify(dedupedDict.reverse())), 'utf8')
fs.writeFileSync('english-to-sinhala.txt', groupsToDictStr(englishGroups), 'utf-8')
// fs.writeFileSync('sinhala-to-english.txt', groupsToDictStr(sinhalaGroups), 'utf-8')


