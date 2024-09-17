import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'

export const dictionaryInfos = [
    { index: 0, id: 'sankshiptha', title: 'සංක්ෂිප්ත සිංහල ශබ්දකෝෂය', icon: 'mdi-alpha-s', color: 'star' },
    { index: 1, id: 'akshara_vinyasa', title: 'අක්ෂර වින්‍යාසය ශබ්දකෝෂය', icon: 'mdi-alpha-a', color: 'success' },
    { index: 2, id: 'pali_buddhadatta', title: 'බුද්ධදත්ත පාලි අකාරාදිය', desc: 'පොල්වත්තේ බුද්ධදත්ත හිමි, පාලි-සිංහල අකාරාදිය', icon: 'mdi-alpha-a', color: 'success' },
    { index: 3, id: 'pali_sumangala', title: 'සුමඞ්ගල පාලි ශබ්දකෝෂය', desc: 'මඩිතියවෙල සිරි සුමඞ්ගල හිමි, පාලි-සිංහල ශබ්දකෝෂය', icon: 'mdi-alpha-a', color: 'success' },
    { index: 4, id: 'sinhala_to_english', title: 'sinhala_to_english', desc: 'පොල්වත්තේ බුද්ධදත්ත හිමි, පාලි-සිංහල අකාරාදිය', icon: 'mdi-alpha-a', color: 'success' },
    { index: 5, id: 'english_to_sinhala', title: 'english_to_sinhala', desc: 'මඩිතියවෙල සිරි සුමඞ්ගල හිමි, පාලි-සිංහල ශබ්දකෝෂය', icon: 'mdi-alpha-a', color: 'success' },
]

export function useSinhalaStore(dictionaryId) {
    return defineStore(dictionaryId, () => {
        const entries = [], sanketha = {} // not reactive but const
        const loaded = ref(false), searchCache = reactive({})
        
        async function loadData() {
            try {
                const startTime = performance.now()

                const [dictResponse, sankethaResponse] = await Promise.all([
                    fetch(import.meta.env.BASE_URL + dictionaryId + '-dict.txt'),
                    fetch(import.meta.env.BASE_URL + dictionaryId + '-sanketha-counts.json')
                ]);
              
                if (!dictResponse.ok || !sankethaResponse.ok) {
                    throw new Error('Network response was not ok');
                }
              
                const dictData = await dictResponse.text(); // Assuming the dict file is plain text
                const sankethaData = await sankethaResponse.json();

                entries.push(...parseDictionary(dictData))
                Object.assign(sanketha, sankethaData)
                console.log(`Dict ${dictionaryId} loaded. entries: ${entries.length}, sanketha: ${Object.keys(sanketha).length} in ${Math.ceil(performance.now() - startTime)} ms.`)
                loaded.value = true
            } catch (error) {
                console.error(`Error loading dict ${dictionaryId}:`, error);
            }
        }
        const search = computed(() => (regexpStr, maxResults = 50) => {
            if (searchCache[regexpStr]) return searchCache[regexpStr]

            const results = [], regexp = new RegExp(regexpStr)
            if (!loaded.value) return results
            loop: for (const entry of entries) {
                if (entry.words.some(w => regexp.test(w))) {
                    results.push(entry)
                    if (results.length >= maxResults) break loop
                }
            }
            searchCache[regexpStr] = results
            return results
        })
        function parseDictionary(text) {
            return text.split('\n\n').map(g => g.split('\n').map(l => l.trim()))
                .map(g => {
                    const breakup = /^\[.+?\+.+?\]$/.test(g[1]) ? g[1] : ''
                    const meaning = breakup ? g.slice(2) : g.slice(1)
                    return {word: g[0], words: g[0].split(', '), meaning, breakup}
                })
        }
    
        return { search, loadData, loaded, entries, sanketha }
    })()
}