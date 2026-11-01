<template>
  <div class="space-y-3" data-testid="history-page">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">{{ S.history }}</h1>
      <button v-if="words.history.length" class="btn" @click="words.clearHistory()">{{ S.clearHistory }}</button>
    </div>
    <p v-if="!words.history.length" class="card text-muted">{{ S.noHistory }}</p>
    <ul v-else class="card divide-y divide-line py-1">
      <li v-for="h in words.history" :key="h.q + h.word" class="flex items-center gap-2 py-1.5">
        <component :is="h.word ? IconBook : IconSearch" class="h-4 w-4 shrink-0 text-muted" />
        <RouterLink :to="h.word ? wordPath(h.q) : '/search/' + encodeURIComponent(h.q)" class="min-w-0 flex-1 truncate">{{ h.q }}</RouterLink>
        <span class="text-xs text-muted">{{ new Date(h.time).toLocaleDateString() }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
import IconBook from '~icons/lucide/book-open'
import IconSearch from '~icons/lucide/search'
import { wordPath } from '@/composables/dict'
import { useWords } from '@/stores/words'
import { S } from '@/strings'

const words = useWords()
useHead({ title: 'History | අරුත.lk', meta: [{ name: 'robots', content: 'noindex' }] })
</script>
