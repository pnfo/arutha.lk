<!-- A dictionary meaning (sanitised html): cross references open the word's page, abbreviations explain themselves
     in a popover (the dictionary's list, data/abbrev). -->
<template>
  <div class="meaning" @click="onClick" v-html="clean" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { cleanMeaning, useDicts, wordPath } from '@/composables/dict'
import { showPopover } from '@/composables/ui'

const props = defineProps<{ html: string; dict: string }>()
const router = useRouter()
const { byCode } = useDicts()
const clean = computed(() => cleanMeaning(props.html))

function onClick(e: MouseEvent) {
  const t = e.target as Element | null
  const a = t?.closest?.('a[data-dict]')
  if (a) {
    e.preventDefault()
    router.push(wordPath(a.getAttribute('data-dict') || ''))
    return
  }
  const ab = t?.closest?.('abbr[data-a]')
  if (ab) {
    e.stopPropagation()
    const key = ab.getAttribute('data-a') || ''
    const d = byCode(props.dict)
    // english-sinhala uses the labels of sinhala-english (build/dict.ts)
    const text = d?.abbrevs?.[key] ?? byCode('sinhala-english')?.abbrevs?.[key] ?? ''
    if (text) showPopover(ab, key, text)
  }
}
</script>
