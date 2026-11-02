<!-- DPD's analysis of a Pali word form: the headwords it is a form of, with the case / tense, and how a compound
     splits (e.g. buddhassa: buddha, masc dat / gen sg) -->
<template>
  <div v-if="rows.length || a.deconstructor?.length" class="rounded-xl border border-line bg-surface2 px-3 py-2 font-ui text-sm" data-testid="dpd-analysis">
    <div class="mb-1 font-semibold text-muted"><span class="pali">{{ a.word }}</span> – {{ S.grammar }}</div>
    <table v-if="rows.length" class="w-full">
      <tr v-for="(r, i) in rows" :key="i">
        <td class="pali pr-3 font-medium">{{ r[0] }}</td><td class="cursor-help pr-3 text-accent" :title="`${posSi(r[1])} (${r[1]})`">{{ shortSi(r[1]) }}</td>
        <td class="cursor-help text-muted" :title="`${codesSi(r[2], keep)} (${r[2]})`" @click="full = full === i ? -1 : i">{{ full === i ? codesSi(r[2], keep) : codesSi(r[2], keep, ' ', true) }}</td>
      </tr>
    </table>
    <div v-if="a.deconstructor?.length" class="mt-1"><span class="text-muted">{{ S.deconstruction }}: </span>
      <span v-for="(d, i) in a.deconstructor" :key="i" class="pali">{{ i ? ' · ' : '' }}{{ d }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Analysis } from '@/data/types'
import { S } from '@/strings'
import { codesSi, posSi, shortSi } from '@/composables/grammar'

const props = defineProps<{ a: Analysis }>()
const keep = (w: string) => w // the Pali words stay in Roman letters
const full = ref(-1) // the row shown with the full names (tap)
const rows = computed(() => (props.a.grammar || []).slice(0, 12))
</script>

<style scoped>
.pali { font-family: 'latn-serif', 'Noto Serif', Georgia, serif; }
</style>
