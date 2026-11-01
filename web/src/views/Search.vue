<!-- The search results (/search/<q>): headwords in tiers (search.go), each with the first entries; load more. -->
<template>
  <div class="space-y-3" data-testid="search-page">
    <header class="space-y-1">
      <h1 class="font-text text-2xl font-bold">“{{ q }}”</h1>
      <p v-if="res" class="text-sm text-muted">
        {{ S.results(res.total) }}<template v-if="res.singlish?.length"> · {{ S.singlishTried }}: {{ res.singlish.slice(0, 4).join(', ') }}</template>
      </p>
    </header>
    <DpdAnalysis v-if="res?.analysis" :a="res.analysis" />
    <template v-if="res">
      <p v-if="!cards.length" class="card">{{ S.noResults }}</p>
      <article v-for="(c, i) in cards" :key="c.word" class="space-y-2" data-testid="result">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <RouterLink :to="wordPath(c.word)" class="font-text text-xl font-bold text-primary hover:underline">{{ c.word }}</RouterLink>
          <span class="text-xs text-muted">{{ srcLabel(c.src) }}</span>
          <span v-if="note(c)" class="rounded-full bg-surface2 px-2 text-xs text-muted">{{ note(c) }}</span>
        </div>
        <EntryGroups v-if="c.entries.length" :entries="c.entries" :headword="c.word" :compact="!(i === 0 && c.tier === 0)" />
        <div v-if="c.dpd.length" class="card py-2">
          <DpdHeadword v-for="h in c.dpd.slice(0, i === 0 && c.tier <= 1 ? 4 : 1)" :key="h.id" :h="h" />
        </div>
      </article>
      <div v-if="res.more || loadingMore" class="py-2 text-center">
        <button class="btn" :disabled="loadingMore" data-testid="load-more" @click="more">{{ S.loadMore }}</button>
      </div>
    </template>
    <ErrorBox v-else-if="error" @retry="load" />
    <Skeleton v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useApi } from '@/data/api'
import { TIER, type Card, type SearchResult } from '@/data/types'
import { srcLabel, wordPath } from '@/composables/dict'
import { useSettings } from '@/stores/settings'
import { useWords } from '@/stores/words'
import { S } from '@/strings'
import EntryGroups from '@/components/EntryGroups.vue'
import DpdHeadword from '@/components/DpdHeadword.vue'
import DpdAnalysis from '@/components/DpdAnalysis.vue'
import ErrorBox from '@/components/ErrorBox.vue'
import Skeleton from '@/components/Skeleton.vue'

const route = useRoute()
const api = useApi()
const settings = useSettings()
const words = useWords()
const q = computed(() => String(route.params.q || ''))
const res = ref<SearchResult | null>(null)
const cards = ref<Card[]>([])
const error = ref(false)
const loadingMore = ref(false)

async function load() {
  const want = q.value
  res.value = null
  error.value = false
  cards.value = []
  try {
    const r = await api.search(want, settings.dictParam)
    if (want !== q.value) return
    res.value = r
    cards.value = r.cards
    words.remember(want, false)
  } catch {
    error.value = true
  }
}
async function more() {
  if (!res.value) return
  loadingMore.value = true
  try {
    const r = await api.search(q.value, settings.dictParam, res.value.page + 1)
    res.value = r
    cards.value = [...cards.value, ...r.cards]
  } finally {
    loadingMore.value = false
  }
}
watch([q, () => settings.dictParam], load, { immediate: true })

function note(c: Card): string {
  switch (c.tier) {
    case TIER.inflection: return c.via ? S.inflectionOf(c.via) : ''
    case TIER.stem: return c.via ? S.stemOf(c.via) : ''
    case TIER.meaning: return S.meaningMatch
  }
  return ''
}
useHead(() => ({ title: `“${q.value}” සෙවුමේ ප්‍රතිඵල | අරුත.lk`, meta: [{ name: 'robots', content: 'noindex,follow' }] }))
</script>
