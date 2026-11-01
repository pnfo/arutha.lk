<template>
  <div class="space-y-3" data-testid="bookmarks-page">
    <h1 class="text-xl font-bold">{{ S.bookmarks }}</h1>
    <p v-if="!words.bookmarks.length" class="card text-muted">{{ S.noBookmarks }}</p>
    <ul v-else class="card divide-y divide-line py-1">
      <li v-for="b in words.bookmarks" :key="b.word" class="flex items-center gap-2 py-1.5">
        <RouterLink :to="wordPath(b.word)" class="font-text min-w-0 flex-1 truncate text-lg text-primary">{{ b.word }}</RouterLink>
        <span class="text-xs text-muted">{{ new Date(b.time).toLocaleDateString() }}</span>
        <button class="icon-btn h-8 w-8 text-muted" :aria-label="S.bookmarkRemoved" @click="words.toggleBookmark(b.word)"><IconX class="h-4 w-4" /></button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
import IconX from '~icons/lucide/x'
import { wordPath } from '@/composables/dict'
import { useWords } from '@/stores/words'
import { S } from '@/strings'

const words = useWords()
useHead({ title: 'තරු යෙදූ - Bookmarks | අරුත.lk', meta: [{ name: 'robots', content: 'noindex' }] })
</script>
