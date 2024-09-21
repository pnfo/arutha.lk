<script setup>

import { getPossibleMatches, isSinglishQuery } from '@pnfo/singlish-search'
import { dictionaryInfos } from '@/stores/sinhala'
import { useSavedStore, useSettingsStore } from '@/stores/savedStore'
import { copyClipboard, queryDb, parseDictRows } from '@/stores/utils';
import { useRoute } from 'vue-router'
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import VAlert from '@/components/VAlert.vue';

const settingsStore = useSettingsStore(), historyStore = useSavedStore('history')
const route = useRoute()
const searchTerm = computed(() => route.params.term.trim())
const searchError = ref('')
const maxResults = 50

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.addEventListener('click', handleClickOutside))

import { LibraryBigIcon, CircleCheckBigIcon, CircleIcon } from 'lucide-vue-next';
import VButton from '@/components/VButton.vue';
import DictionaryEntry from '@/components/DictionaryEntry.vue';

const selectedDicts = computed({
  get() { return settingsStore.settings.dicts },
  set(val) { settingsStore.setSetting('dicts', val) },
})

const isOpen = ref(false), dropdownRef = ref(null)

const toggleDict = (ind) => {
  selectedDicts.value = isSelected(ind) ? selectedDicts.value.filter(i => i != ind) : [...selectedDicts.value, ind]
}
const isSelected = (ind) => selectedDicts.value.includes(ind)
const handleClickOutside = (event) => {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
      isOpen.value = false
    }
}

const isLoading = ref(false), searchResults = ref([])
const fetchSearchResults = async () => {
    isLoading.value = true
    const exact = searchTerm.value.endsWith('.')
    const term = exact ? searchTerm.value.slice(0, -1) : searchTerm.value + '%'
    const matches = isSinglishQuery(term) ? getPossibleMatches(term) : [term]
    let dictIndexes = selectedDicts.value
    try {
        if (!term.length) {
            throw new Error('empty-input')
        } else if (matches.length > 300) { // 5 is the index of english_to_sinhala
            if (!dictIndexes.includes(5)) throw new Error('singlish-explosion')
            else dictIndexes = [5]
        } else if (!matches.length) { // will result in empty where clauses below
            dictIndexes = [5]
        }

        const query = dictIndexes.map(i => {
            const dictId = dictionaryInfos[i].id, 
              usedMatches = dictId == 'english_to_sinhala' ? [term] : matches,
              where = usedMatches.map(match => `word LIKE "${match}"`).join(' OR ')
            return `SELECT ${i} AS dict, word, meaning FROM ${dictId} WHERE ${where}`
        }).join(' UNION ALL ') + ' LIMIT 100'
        console.log(query)

        const rows = await queryDb(query)
        searchResults.value = rows ? parseDictRows(rows) : [] // null sent when zero results
        searchError.value = ''

    } catch(e) {
        console.log(e)
        searchResults.value = []
        searchError.value = e.message
    } finally {
        isLoading.value = false
    }
}

watchEffect(fetchSearchResults)

const searchStatus = computed(() => {
  const term = searchTerm.value, numResults = searchResults.value.length
  if (searchError.value == 'input-error') {
    return { text: `ඔබ විසින් ඇතුලු කළ සෙවුම් පදයේ වරදක් ඇත. පහත බොත්තම ඔබා උදව් ලබා ගන්න.`, type: 'error' }
  } else if (searchError.value == 'empty-input') { 
    return { text: `at least enter one letter to start searching.`, type: 'error' }
  } else if (searchError.value == 'singlish-explosion') { 
    return { text: `technical. make the singlish short.`, type: 'error' }
  } else if (searchError.value) { // some server error including network
    return { text: searchError.value, type: 'error' }
  } else if (numResults == 0) {
    return { text: `“${term}” යන සෙවුම සඳහා ගැළපෙන වචන ශබ්දකෝෂ වල අඩංගු නොවේ.`, type: 'warning' }
  } else if (numResults < maxResults) {
    return { text: `“${term}” යන සෙවුම සඳහා ගැළපෙන වචන ${numResults} ක් හමුවිය.`, type: 'success' }
  } else {
    return { text: `ඔබගේ “${term}” යන සෙවුම සඳහා ගැළපෙන වචන ${maxResults} කට වඩා හමුවිය. එයින් මුල් ${maxResults} පහත දැක්වේ.`, type: 'warning' }
  }
})

</script>

<template>
  <VAlert :border="true" :color="searchStatus.type">
    <div>{{ searchStatus.text }}</div>
  </VAlert>
  <div class="relative" ref="dropdownRef">
    <VButton @click="isOpen = !isOpen" :prependIcon="LibraryBigIcon" class="bg-sky-400 dark:bg-sky-800 bg-opacity-50">
      {{ `${selectedDicts.length}/${dictionaryInfos.length} ශබ්දකෝෂ තෝරන්න` }}
    </VButton>
    <div v-if="isOpen" class="absolute z-10 w-100 mt-1 border border-gray-300 rounded-md shadow-xl bg-gray-200" >
      <ul class="max-h-80 overflow-auto" >
        <li class="text-sm p-2">සෙවුම් ප්‍රතිඵල ලැබිය යුතු ශබ්දකෝෂ තෝරන්න</li>
        <li v-for="dict in dictionaryInfos" :key="dict.index" @click="toggleDict(dict.index)" :class="isSelected(dict.index) ? 'text-black' : 'text-gray-500'"
            class="p-2 cursor-pointer hover:bg-blue-200 flex items-center space-x-2">
          <CircleCheckBigIcon v-if="isSelected(dict.index)" class="text-green-700"></CircleCheckBigIcon>
          <CircleIcon v-else></CircleIcon>
          <span class="ml-3">{{ dict.title }}</span>
        </li>
      </ul>
    </div>
  </div>
  
  <div v-if="isLoading" role='status' class='max-w-sm animate-pulse'>
      <h3 class='h-3 bg-gray-300 rounded-full w-48 mb-4'></h3>
      <p class='h-2 bg-gray-300 rounded-full max-w-[380px] mb-2.5'></p>
      <p class='h-2 bg-gray-300 rounded-full max-w-[340px] mb-2.5'></p>
      <p class='h-2 bg-gray-300 rounded-full max-w-[320px] mb-2.5'></p>
  </div>
  <div v-else class="container"> 
    <div class="sm:columns-2 xl:columns-3">
        <DictionaryEntry v-for="(entry, i) in searchResults" :entry="entry" :key="i" class="break-inside-avoid-column"/>
    </div>
  </div>
</template>

<style scoped>

</style>