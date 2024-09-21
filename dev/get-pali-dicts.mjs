'use strict'
/*
Get the pali sinhala dictionaries from tipitaka.lk (or pitaka.lk) and convert them to text format to be populated to sqlite later
Run from the dev folder
*/

import fs from 'fs' 
import vkb from 'vkbeautify'

// following list copied from pitaka.lk and modified a bit
// they have been moved to sanketha.json
const allSanketha = {
    "pali_sumangala": {
        "පු.ක්‍රි.": ["පුබ්බ ක්‍රියා", 0],
        "අ.": ["අව්‍යය සද්ද", 0],
        "පු.": ["පුල්ලිඞ්ගික", "c1"],
        "ඉ.": ["ඉත්‍ථි ලිඞ්ගික", "c1"],
        "න.": ["නපුංසක ලිඞ්ගික", "c1"],
        "ති.": ["තිලිඞ්ගික", "c1"],
        "නි.": ["නිපාත", 2], // removed occurances
        "එ.": ["එකක නිපාත", 2],
        "දු.": ["දුක නිපාත", 2],
        "ත2.": ["තතිය නිපාත", 2], // might have a small amount of this mixed with තනාදිගණය
        "ප.": ["පණ්ණාසක", 2], // removed the occurances
        "ක්‍රි.": ["ක්‍රියා", 0],
        "වි.": ["විභාවිනී", 0],
        "ව.": ["වණ්ණනා", 0],
        "d.": ["ධාතු", 0],
        "භු.": ["භුවාදිගණය", 4],
        "රු.": ["රුධාදිගණය", 4],
        "දි.": ["දිවාදිගණය", 4],
        "සු.": ["ස්වාදිගණය", 4],
        "කි.": ["කියාදිගණය", 4],
        "ත.": ["තනාදිගණය", 4], 
        "චු.": ["චුරාදිගණය", 4],
        "අ2.": ["එනම් විකරණය", 5], // might have a small amount mixed with අව්‍යය සද්ද
        "අං.": ["එනම් විකරණය", 5], // occurances removed
        "ය.": ["එනම් විකරණය", 5], // occurances removed
        "ණා.": ["එනම් විකරණය", 5], // occurances removed 
        "ණු ණ, යිර.": ["එනම් විකරණය", 5], // could not find occurances of the below 3 entries - but leave them anyway
        "ඔ, උණා.": ["එනම් විකරණය", 5],
        "ණෙ, ණය.": ["එනම් විකරණය", 5],
        // these are not tagged in the text but keep here for infomational purposes to the users
        "-": ["ආදෙස", 0],
        "+": ["එකතු කිරීම", 0],
        "=": ["සමාන", 0],
        ",": ["එම අත්‍ථර්‍", 0],
        ".": ["අන්‍යාත්‍ථර්‍", 0]    
    }, 
    "pali_buddhadatta": {
        "පූ.ක්‍රි.": ["පූර්ව ක්‍රියා", 0],
        "ක්‍රි.වි.": ["ක්‍රියා විශේෂණ", 0],
        "නි.": ["නිපාත", 0],
        "පු.": ["පුල් ලිඞ්ග", "c1"],
        "ඉ.": ["ඉත්‍ථි ලිඞ්ග", "c1"],
        "න.": ["නපුංසක ලිඞ්ග", "c1"],
        "3.": ["තුන් ලිඟු ඇති", "c1"]
    },
}

const dictId = 'pali_sumangala'
const jsonFilename = dictId == 'pali_buddhadatta' ? 'si-buddhadatta.json' : 'si-sumangala.json'

const sanketha = allSanketha[dictId]
Object.keys(sanketha).forEach(san => sanketha[san] = {title: sanketha[san][0], count: 0})

const dict = JSON.parse(fs.readFileSync('../../tipitaka.lk/dev/dicts/dict-input/' + jsonFilename, 'utf-8'))
console.log(`num entries in dict ${dictId} is ${dict.length}`)

const wordDuplicateCheck = {}
// let duplicateCount = 0
dict.forEach((entry, ind) => {
    if (!entry[0].trim() || !entry[1].trim()) console.log('empty word or meaning in line ' + entry)
    entry[1] = entry[1].replace(/<r (.+?)>(.+?)<\/r>/g, (match, group1, group2) => {
        group2 += '.' // ending dot is not there in the original dict
        if (!sanketha[group2]) console.error(`abbr ${group2} is not a known abbr in ${entry[1]}`)
        sanketha[group2].count++
        return `[${group2}]`
    })
    entry[1] = entry[1].replace(/<br>/g, '\n')

    const duplicateIndex = wordDuplicateCheck[entry[0].trim()]
    if (duplicateIndex) {
        console.error(`duplicate word ${entry[0]} in at ${duplicateIndex} ${dictId}`)
    //     dict[duplicateIndex][1] += '<br>' + entry[1] // add current meaning in a new line
    //     entry[3] = true // mark to be deleted
    //     duplicateCount++
    } else {
         wordDuplicateCheck[entry[0].trim()] = ind
    }
        
});

// const newDict = dict.filter(([_0, _1, _2, dup]) => !dup).map(([word, meaning, page]) => [word, meaning, page])
// console.log(`duplicate count ${duplicateCount}, new Dict ${newDict.length}`)
// fs.writeFileSync(`si-sumangala.json`, vkb.json(JSON.stringify(newDict)), 'utf-8')
// process.exit(0)

console.log(sanketha)

fs.writeFileSync(`../public/sanketha/${dictId}-sanketha-counts.json`, vkb.json(JSON.stringify(sanketha)), 'utf-8')

fs.writeFileSync(`dict-input/${dictId}.txt`, dict.map(([word, meaning, _1]) => `${word}\n${meaning}`).join('\n\n'), 'utf-8')