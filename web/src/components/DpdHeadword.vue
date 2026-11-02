<!-- one DPD headword (Digital Pāḷi Dictionary, CC BY-NC-SA 4.0), from tipitaka.app: the meaning, opened: grammar,
     root, construction, example -->
<template>
  <article class="border-b border-line py-2 last:border-0" data-testid="dpd-head">
    <button class="flex w-full items-baseline gap-2 text-left" :aria-expanded="open" @click="open = !open">
      <span class="pali font-semibold">{{ lemma }}</span>
      <sup v-if="sense" class="text-[0.625rem] text-muted">{{ sense }}</sup>
      <span class="rounded bg-surface2 px-1.5 text-xs text-accent" :title="`${posSi(h.pos)} (${h.pos})`">{{ shortSi(h.pos) }}</span>
      <span class="min-w-0 flex-1"><b>{{ h.meaning || h.meaning2 }}</b><span v-if="h.meaningLit" class="text-muted"> · lit. {{ h.meaningLit }}</span></span>
    </button>
    <dl v-if="open" class="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-ui text-sm">
      <template v-for="row in rows" :key="row[0]">
        <dt class="text-muted">{{ row[0] }}</dt>
        <dd class="pali">{{ row[1] }}</dd>
      </template>
      <template v-if="h.example">
        <dt class="text-muted">Example</dt>
        <dd><i class="pali" v-html="cleanMeaning(h.example)" /> <span class="text-muted">{{ h.source }} {{ h.sutta }}</span></dd>
      </template>
    </dl>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DpdHead } from '@/data/types'
import { cleanMeaning } from '@/composables/dict'
import { grammarSi, plusCaseSi, posSi, shortSi } from '@/composables/grammar'

const props = defineProps<{ h: DpdHead; expanded?: boolean }>()
const open = ref(!!props.expanded)
// "dhamma 1.01" -> lemma dhamma, sense 1.01
const lemma = computed(() => props.h.lemma.replace(/\s+[\d.]+$/, ''))
const sense = computed(() => /\s([\d.]+)$/.exec(props.h.lemma)?.[1] ?? '')
const keep = (w: string) => w // the Pali words stay in Roman letters
const rows = computed(() => {
  const h = props.h
  const r: [string, string][] = []
  if (h.grammar) r.push(['ව්‍යාකරණ', grammarSi(h.grammar, keep)])
  if (h.plusCase) r.push(['+', plusCaseSi(h.plusCase)])
  if (h.root) r.push(['Root', `${h.root.root} ${h.root.group}${h.root.sign ? ' ' + h.root.sign : ''} (${h.root.meaning})`])
  if (h.rootBase) r.push(['Base', h.rootBase])
  if (h.construction) r.push(['Construction', h.construction.replace(/\n/g, '; ')])
  if (h.compoundType) r.push(['Compound', `${h.compoundType}${h.compoundConstruction ? ' · ' + h.compoundConstruction : ''}`])
  if (h.derivedFrom) r.push(['Derived from', h.derivedFrom])
  if (h.sanskrit) r.push(['Sanskrit', h.sanskrit])
  if (h.notes) r.push(['Notes', h.notes.replace(/<[^>]+>/g, '')])
  return r
})
</script>

<style scoped>
.pali { font-family: 'latn-serif', 'Noto Serif', Georgia, serif; }
</style>
