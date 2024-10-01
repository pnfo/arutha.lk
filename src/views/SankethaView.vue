<script setup>
import { useSinhalaStore, dictionaryInfos } from '@/stores/sinhala'
import { useRoute, useRouter } from 'vue-router'
import { watchEffect, computed, ref } from 'vue';
import VAlert from '@/components/VAlert.vue';
import VSkeleton from '@/components/VSkeleton.vue';

const route = useRoute(), router = useRouter()
const dictInfo = computed(() => dictionaryInfos.find(({id}) => route.params.dictId == id))
const selectedDict = computed({
  get: () => dictInfo.value.index,
  set: (i) => router.replace(`/abbreviations/${dictionaryInfos[i].id}`) // this will change the addressbar without refreshing the whole page
})

const isLoading = ref(false), sankethaCounts = ref([])
async function loadData() {
    if (!useSinhalaStore().loaded) return
    try {
        isLoading.value = true
        const dictId = dictInfo.value.id == 'english_to_sinhala' ? 'sinhala_to_english' : dictInfo.value.id
        const response = await fetch(import.meta.env.BASE_URL + `sanketha/${dictId}-sanketha-counts.json`)
        if (!response.ok) throw new Error(`${response.status} - ${response.statusText}`);
        
        const json = await response.json()
        sankethaCounts.value = Object.entries(useSinhalaStore().sanketha[dictId]).map(
            ([abbreviation, title]) => ({abbreviation, title, count: json[abbreviation] ? json[abbreviation].count : 0})
        )
        console.log(`sanketha counts loaded: ${sankethaCounts.value.length}`)

    } catch (error) {
        console.error(`Error loading sanketha`, error);
        sankethaCounts.value = []
    } finally {
        isLoading.value = false
    }
}

watchEffect(loadData)

</script>

<template>
<div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
        <label>ශබ්දකෝෂය </label>
        <select v-model="selectedDict" class="block px-3 py-2 dark:bg-black border border-gray-300 rounded-md">
            <!-- can't apply styles to options since it is rendered by os -->
            <option v-for="info in dictionaryInfos" :key="info.index" :value="info.index">
                {{ info.title }}
            </option>
        </select>
    </div>
    

    <div v-if="isLoading">
        <VSkeleton></VSkeleton>
    </div>
    <div v-else>
        <VAlert color="info"> {{ `මෙම ${dictInfo.desc || dictInfo.title}ේ වචන ${useSinhalaStore().entryCounts[dictInfo.id].toLocaleString()} ක තේරුම් අන්තර්ගතව ඇත. එහි යෙදෙන කෙටි යෙදුම් වල විස්තර පහතින් බලන්න.` }}</VAlert>
        <table class="max-w-[600px] w-full my-3 border-collapse">
            <thead class="bg-gray-300 dark:bg-gray-700">
                <tr>
                    <td class="border border-gray-300 p-2">කෙටි යෙදුම</td>
                    <td class="border border-gray-300 p-2">විස්තරය</td>
                    <td class="border border-gray-300 p-2">යෙදුනු වාරගණන</td>
                </tr>
            </thead>
            <tbody>
                <tr v-for="({abbreviation, title, count}, i) in sankethaCounts" :key="i" class="even:bg-gray-200 even:dark:bg-gray-800">
                    <td class="border border-gray-300 p-2">{{ abbreviation }}</td>
                    <td class="border border-gray-300 p-2">{{ title }}</td>
                    <td class="border border-gray-300 p-2">{{ count }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
</template>