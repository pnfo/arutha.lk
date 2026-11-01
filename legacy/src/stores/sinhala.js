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
        const sanketha = {} // not reactive but const (needs to be const)
        const loaded = ref(false), searchCache = reactive({}), entryCounts = reactive({})

        async function loadData() {
            try {
                let sankethaData, countsData;

                // --- ANDROID MODE ---
                if (window.AndroidBackend) {
                    // Read files via Java Bridge (Sync execution, very fast for local files)
                    // Note: Pass the path relative to the 'assets' folder
                    const sankethaJsonStr = window.AndroidBackend.readAssetFile('dist/sanketha/sanketha.json');
                    const countsJsonStr = window.AndroidBackend.readAssetFile('dist/sanketha/entry-counts.json');

                    if (!sankethaJsonStr || !countsJsonStr) {
                        throw new Error("Failed to load JSON assets via Android Bridge");
                    }

                    sankethaData = JSON.parse(sankethaJsonStr);
                    countsData = JSON.parse(countsJsonStr);
                }
                // --- WEB MODE server ---
                else {
                    const [sankethaRes, countsRes] = await Promise.all([
                        fetch(import.meta.env.BASE_URL + 'sanketha/sanketha.json'),
                        fetch(import.meta.env.BASE_URL + 'sanketha/entry-counts.json')
                    ]);

                    if (!sankethaRes.ok) throw new Error(`${sankethaRes.status} - ${sankethaRes.statusText}`);
                    if (!countsRes.ok) throw new Error(`${countsRes.status} - ${countsRes.statusText}`);

                    sankethaData = await sankethaRes.json();
                    countsData = await countsRes.json();
                }

                // --- MERGE DATA (Common Logic) ---
                Object.assign(sanketha, sankethaData);
                Object.assign(entryCounts, countsData);

                sanketha['english_to_sinhala'] = sanketha['sinhala_to_english'];
                console.log(`sanketha loaded: ${Object.keys(sanketha).length}`);
                loaded.value = true;

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

        return { loadData, loaded, sanketha, entryCounts }
    })()
}