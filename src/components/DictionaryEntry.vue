<script setup>
import { copyClipboard, toggleBookmark } from '@/stores/utils';
import { useSavedStore } from '@/stores/savedStore';
import { dictionaryInfos, useSinhalaStore } from '@/stores/sinhala';
import { computed } from 'vue'

const props = defineProps({
  entry: Object,
})
console.log(props.entry)
const dictInfo = computed(() => dictionaryInfos[props.entry.dict])
const bookmarksStore = useSavedStore('bookmarks')

const item = computed(() => {
  const entry = props.entry
  // TODO patterns need to be changed for the akshaya vinyasa dict. currently does not show sankheta within round brackets
  const pattern = /(^\d+\. ?|\[.*?\]|\(.*?\.\))/g, sankethaPatttern = /\[.*?\]|\(.*?\.\)/
  return {...entry, starred: bookmarksStore.state[entry.word], 
    lineParts: entry.meaning.map(l => l.split(pattern)
      .filter(pt => pt.length).map(text => {
        let type = 'normal', tooltip
        if (sankethaPatttern.test(text)) {
          const upart = text.slice(1, -1)
          tooltip = useSinhalaStore(dictInfo.value.id).sanketha[upart].title
          if (tooltip) type = 'sanketha'
        }
        return {type, text, tooltip}
    }))}
})
import LetterPIcon from './icons/LetterPIcon.vue';
import LetterSIcon from './icons/LetterSIcon.vue';
import LetterEIcon from './icons/LetterEIcon.vue';
import { ShareIcon, StarIcon } from 'lucide-vue-next';

</script>

<template>
    <div class="p-2">
      <div class="bg-white shadow rounded-lg p-2 relative group" v-bind="props">
        <div class="flex items-center">
          <LetterEIcon class="w-5 text-green-800 hover:text-green-600"></LetterEIcon>
          <div :class="`text-${dictInfo.color}`" class="mr-2">
            <component :is="dictInfo.icon" size="small" /> 
          </div>
          <span class="word text-xl text-primary">{{ item.word }}</span>
          <span v-if="item.breakup" class="pl-2 text-green-800 dark:text-green-500">{{ item.breakup }}</span>
          <button 
            v-if="isHovering || item.starred" 
            @click="toggleBookmark(item.word, item.starred)" 
            class="text-star ml-1 p-1 rounded-full hover:bg-gray-200 focus:outline-none group-hover:block hidden" 
          >
            <StarIcon></StarIcon>
          </button>
          <button 
            v-if="isHovering" 
            @click="copyClipboard(item.words[0] + '.')" 
            class="text-info ml-1 p-1 rounded-full hover:bg-gray-200 focus:outline-none group-hover:block hidden"
          >
            <ShareIcon></ShareIcon>
          </button>
        </div>
  
        <div class="meaning mt-2">
          <div v-for="(line, i) in item.lineParts" :key="i">
            <span v-for="part in line" :class="part.type">
              {{ part.text }}
              <span v-if="part.tooltip" class="relative group">
                <span class="inline-block align-baseline">
                  {/* Content that triggers the tooltip */}
                </span>
                <div class="absolute z-10 invisible group-hover:visible bg-primary text-white p-2 rounded-md shadow-md whitespace-nowrap">
                  {{ part.tooltip }}
                </div>
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <style scoped>
  .word { 
    @apply text-xl; 
  }
  .breakup { 
    @apply text-green-500; 
  }
  .sanketha { 
    @apply text-sm text-green-500; 
  }
  </style>