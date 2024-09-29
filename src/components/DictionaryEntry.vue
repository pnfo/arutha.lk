<script setup>
import { copyClipboard, toggleBookmark, isStarred } from '@/stores/utils';
import { useSavedStore } from '@/stores/savedStore';
import { dictionaryInfos, useSinhalaStore } from '@/stores/sinhala';
import { computed } from 'vue'

const props = defineProps({
  entry: Object,
})
const dictInfo = computed(() => dictionaryInfos[props.entry.dict])
const bookmarksStore = useSavedStore('bookmarks')

const item = computed(() => {
  if (!useSinhalaStore().loaded) return []
  const entry = props.entry
  // TODO patterns need to be changed for the akshaya vinyasa dict. currently does not show sankheta within round brackets
  const pattern = /(^\d+\. ?|\[.*?\.\]|\(.*?\.\))/g, sankethaPatttern = /\[.*?\.\]|\(.*?\.\)/
  return {...entry,  
    lineParts: entry.meaning.map(l => l.split(pattern)
      .filter(pt => pt.length).map(text => {
        let type = 'normal', tooltip
        if (sankethaPatttern.test(text)) {
          const upart = text.slice(1, -1)
          tooltip = useSinhalaStore().sanketha[dictInfo.value.id][upart]
          if (tooltip) type = 'sanketha'
        }
        return {type, text, tooltip}
    }))}
})
import LetterPIcon from './icons/LetterPIcon.vue';
import LetterSIcon from './icons/LetterSIcon.vue';
import LetterEIcon from './icons/LetterEIcon.vue';
import StarFilledIcon from './icons/StarFilledIcon.vue';
import { ShareIcon, StarIcon } from 'lucide-vue-next';

</script>

<template>
      <div class="py-3 px-2 relative group/entry hover:dark:bg-gray-800 hover:bg-gray-200">

        <div class="flex items-center gap-2">

          <span class="group/icon relative">
            <LetterSIcon v-if="entry.dict <= 1" class="w-5 text-orange-500 opacity-25 hover:opacity-100"></LetterSIcon>
            <LetterPIcon v-else-if="entry.dict <= 3" class="w-5 text-green-500 opacity-25 hover:opacity-100"></LetterPIcon>
            <LetterEIcon v-else class="w-5 text-blue-500 opacity-25 hover:opacity-100"></LetterEIcon>
            <span class="tooltip group-hover/icon:block">{{ dictInfo.title }}</span>
          </span>
          
          <span class="text-xl text-orange-800 dark:text-orange-300">
            {{ item.word }}
          </span>
          <span v-if="item.breakup" class="text-green-800 dark:text-green-500">{{ item.breakup }}</span>

          <span class="invisible group-hover/entry:visible flex">
            <span class="ml-1 p-1 rounded-full text-yellow-700 hover:bg-gray-300 focus:outline-none" :class="{visible: isStarred(entry)}"
              @click="toggleBookmark(entry)">
              <StarFilledIcon v-if="isStarred(entry)" class="w-4"></StarFilledIcon>
              <StarIcon v-else class="w-4"></StarIcon>
            </span>
            <span class="ml-1 p-1 rounded-full text-blue-700 hover:bg-gray-300 focus:outline-none"
              @click="copyClipboard(item.words[0] + '.')">
              <ShareIcon class="w-4"></ShareIcon>
            </span>
          </span>
          
        </div>
          <div v-for="(line, i) in item.lineParts" :key="i">
            <span v-for="part in line" :class="part.type" class="group relative">
              {{ part.text }}
              <span v-if="part.tooltip" class="tooltip group-hover:block whitespace-nowrap">
                  {{ part.tooltip }}
              </span>
            </span>
          </div>
      </div>
  </template>
  
  <style scoped>
  .sanketha { 
    @apply relative text-green-800 dark:text-green-300; 
  }
  .tooltip {
    @apply absolute z-10 hidden text-sm bg-white dark:bg-gray-800 rounded shadow-lg p-2;
  }
  </style>