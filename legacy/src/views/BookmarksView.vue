<script lang="js" setup>
import { useSettingsStore, useSavedStore } from '@/stores/savedStore'
import { computed } from 'vue';
import VAlert from '@/components/VAlert.vue';
import DictionaryEntry from '@/components/DictionaryEntry.vue';

const settingsStore = useSettingsStore(), bookmarksStore = useSavedStore('bookmarks')

const bookmarks = computed(() => {
    return Object.entries(bookmarksStore.state).map(([key, info]) => info.entry)
})
function tsToStr(time) {
    const seconds = (Date.now() - time) / 1000
    if (60 > seconds) return `තත්පර ${Math.floor(seconds)} කට පෙර` // using less than operator (even in a comment) gives an error when dev tools are enabled
    else if (3600 > seconds) return `විනාඩි ${Math.floor(seconds / 60)} කට පෙර`
    else if (86400 > seconds) return `පැය ${Math.floor(seconds / 3600)} කට පෙර`
    else if (2592000 > seconds) return `දින ${Math.floor(seconds / 86400)} කට පෙර`
    else return `මාස ${Math.floor(seconds / 2592000)} කට පෙර`
}
const bookmarkStatus = computed(() => {
    if (bookmarks.value.length) {
        return { text: `ඔබ විසින් තරු යෙදූ වචන ${bookmarks.value.length} ක් ඇත.`, type: 'success' }
    } else {
        return { text: `ඔබ විසින් කිසිම වචනයක තරු යොදා නැත. සෙවුම් ප්‍රතිඵල වල තරු ලකුණ මත ක්ලික් කිරීමෙන් ඒවා එකතු කර ගත හැකිය.`, type: 'info' }
    }
})
</script>

<template>
  <div :style="settingsStore.fontSizeStyle">

    <VAlert :border="true" :color="bookmarkStatus.type">
      <div>{{ bookmarkStatus.text }}</div>
    </VAlert>
    
    <div class="container"> 
      <div class="sm:columns-2 xl:columns-3">
          <DictionaryEntry v-for="(entry, i) in bookmarks" :entry="entry" :key="i" class="break-inside-avoid-column"/>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
