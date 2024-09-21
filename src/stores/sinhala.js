import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'

export const dictionaryInfos = [
    { index: 0, id: 'sankshiptha', title: 'සංක්ෂිප්ත සිංහල ශබ්දකෝෂය', icon: 'mdi-alpha-s', color: 'star' },
    { index: 1, id: 'akshara_vinyasa', title: 'අක්ෂර වින්‍යාසය ශබ්දකෝෂය', icon: 'mdi-alpha-a', color: 'success' },
    { index: 2, id: 'pali_buddhadatta', title: 'බුද්ධදත්ත පාලි අකාරාදිය', desc: 'පොල්වත්තේ බුද්ධදත්ත හිමි, පාලි-සිංහල අකාරාදිය', icon: 'mdi-alpha-a', color: 'success' },
    { index: 3, id: 'pali_sumangala', title: 'සුමඞ්ගල පාලි ශබ්දකෝෂය', desc: 'මඩිතියවෙල සිරි සුමඞ්ගල හිමි, පාලි-සිංහල ශබ්දකෝෂය', icon: 'mdi-alpha-a', color: 'success' },
    { index: 4, id: 'sinhala_to_english', title: 'සිංහල ඉංග්‍රීසි ශබ්දකෝෂය', desc: '', icon: 'mdi-alpha-a', color: 'success' },
    { index: 5, id: 'english_to_sinhala', title: 'ඉංග්‍රීසි සිංහල ශබ්දකෝෂය', desc: '', icon: 'mdi-alpha-a', color: 'success' },
]

export function useSinhalaStore() {
    return defineStore('sanketha', () => {
        const sanketha = {} // not reactive but const
        const loaded = ref(false), searchCache = reactive({})
        
        async function loadData() {
            try {
                const response = await fetch(import.meta.env.BASE_URL + 'sanketha/sanketha.json')
                if (!response.ok) throw new Error(`${response.status} - ${response.statusText}`);
              
                const sankethaData = await response.json();
                Object.assign(sanketha, sankethaData)
                console.log(`sanketha loaded: ${Object.keys(sanketha).length}`)
                loaded.value = true
            } catch (error) {
                console.error(`Error loading sanketha`, error);
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
    
        return { loadData, loaded, sanketha }
    })()
}