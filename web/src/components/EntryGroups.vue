<!-- The entries of a headword, grouped by dictionary (in the order the engine gives: the chosen order). -->
<template>
  <div class="space-y-3">
    <section v-for="g in groups" :key="g.dict" class="card" :data-dict="g.dict" data-testid="dict-entries">
      <header class="mb-1.5 flex items-center gap-2">
        <DictBadge :code="g.dict" />
        <RouterLink :to="`/dict/${g.dict}`" class="text-sm font-medium text-muted hover:text-fg">{{ byCode(g.dict)?.name || g.dict }}</RouterLink>
      </header>
      <div class="text space-y-2">
        <div v-for="(e, i) in limited(g.entries)" :key="i">
          <div v-if="showWord(e)" class="font-semibold">{{ e.word }}<sup v-if="e.hom" class="ml-0.5 text-xs text-muted">{{ e.hom }}</sup></div>
          <MeaningHtml :html="e.meaning" :dict="e.dict" :class="{ 'line-clamp-3': compact }" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DictEntry } from '@/data/types'
import { useDicts } from '@/composables/dict'
import DictBadge from './DictBadge.vue'
import MeaningHtml from './MeaningHtml.vue'

const props = defineProps<{ entries: DictEntry[]; headword: string; compact?: boolean }>()
const { byCode } = useDicts()
const groups = computed(() => {
  const out: { dict: string; entries: DictEntry[] }[] = []
  for (const e of props.entries) {
    const last = out[out.length - 1]
    if (last && last.dict === e.dict) last.entries.push(e)
    else out.push({ dict: e.dict, entries: [e] })
  }
  return out
})
const limited = (es: DictEntry[]) => (props.compact ? es.slice(0, 1) : es)
// the stored word when it differs from the headword shown (Roman Pali, a variant, a homonym)
const showWord = (e: DictEntry) => !!e.hom || (byCode(e.dict)?.src !== 'pi' && e.word !== props.headword && e.word.toLowerCase() !== props.headword)
</script>
