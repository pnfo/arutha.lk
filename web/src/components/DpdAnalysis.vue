<!-- DPD's analysis of a Pali word form: the headwords it is a form of, with the case / tense, and how a compound
     splits (e.g. buddhassa: buddha, masc dat / gen sg) -->
<template>
  <div v-if="rows.length || a.deconstructor?.length" class="rounded-xl border border-line bg-surface2 px-3 py-2 font-ui text-sm" data-testid="dpd-analysis">
    <div class="mb-1 font-semibold text-muted"><span class="pali">{{ a.word }}</span> – {{ S.grammar }}</div>
    <table v-if="rows.length" class="w-full">
      <tr v-for="(r, i) in rows" :key="i">
        <td class="pali pr-3 font-medium">{{ r[0] }}</td><td class="pr-3 text-accent">{{ r[1] }}</td><td class="text-muted">{{ r[2] }}</td>
      </tr>
    </table>
    <div v-if="a.deconstructor?.length" class="mt-1"><span class="text-muted">{{ S.deconstruction }}: </span>
      <span v-for="(d, i) in a.deconstructor" :key="i" class="pali">{{ i ? ' · ' : '' }}{{ d }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Analysis } from '@/data/types'
import { S } from '@/strings'

const props = defineProps<{ a: Analysis }>()
const rows = computed(() => (props.a.grammar || []).slice(0, 12))
</script>

<style scoped>
.pali { font-family: 'latn-serif', 'Noto Serif', Georgia, serif; }
</style>
