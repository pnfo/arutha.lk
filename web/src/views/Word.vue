<!-- The page of a headword (/<word>): every dictionary's entries, DPD, the book pages that list it, its neighbours. -->
<template>
  <div v-if="page" class="space-y-4" data-testid="word-page">
    <header class="flex flex-wrap items-start gap-2">
      <div class="min-w-0 flex-1">
        <h1 class="font-text break-words text-3xl font-bold leading-tight text-primary sm:text-4xl" data-testid="word-title">{{ page.word }}</h1>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span v-if="page.roman" class="font-[latn-serif] italic">{{ page.roman }}</span>
          <span>{{ srcLabel(page.src) }}</span>
        </div>
      </div>
      <div class="flex shrink-0 items-center">
        <button class="icon-btn" :class="{ active: starred }" :aria-pressed="starred" :title="S.bookmarks" data-testid="bookmark" @click="toggleStar">
          <IconStar class="h-5 w-5" :class="{ 'icon-filled': starred }" />
        </button>
        <button class="icon-btn" :title="S.share" @click="doShare"><IconShare class="h-5 w-5" /></button>
        <button class="icon-btn" :title="S.copy" @click="doCopy"><IconCopy class="h-5 w-5" /></button>
      </div>
    </header>

    <DpdAnalysis v-if="showAnalysis" :a="page.analysis!" />
    <p v-if="!page.entries.length && !page.dpd.length" class="card text-sm" data-testid="hidden-dicts">
      {{ S.onlyHidden }} <RouterLink to="/settings" class="link">{{ S.settings }}</RouterLink>
    </p>
    <EntryGroups :entries="page.entries" :headword="page.word" />

    <section v-if="page.dpd.length" class="card" data-dict="dpd" data-testid="dpd">
      <header class="mb-1 flex items-center gap-2">
        <DictBadge code="dpd" /><RouterLink to="/dict/dpd" class="text-sm font-medium text-muted hover:text-fg">Digital Pāḷi Dictionary</RouterLink>
      </header>
      <DpdHeadword v-for="(h, i) in page.dpd" :key="h.id" :h="h" :expanded="i === 0" />
    </section>

    <section v-if="page.also.length" class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-muted">{{ S.alsoSee }}:</span>
      <RouterLink v-for="a in page.also" :key="a.word" :to="wordPath(a.word)" class="chip">{{ a.word }}</RouterLink>
    </section>

    <section v-if="page.pages.length" class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-muted">{{ S.pages }}:</span>
      <RouterLink v-for="p in page.pages" :key="p.dict" :to="`/bookpage/${p.v1}/${p.page}`" class="chip"><DictBadge :code="p.dict" /> {{ p.page }}</RouterLink>
    </section>

    <nav class="flex justify-between gap-2 border-t border-line pt-3 text-sm">
      <RouterLink v-if="page.prev" :to="wordPath(page.prev.word)" class="link min-w-0 truncate" rel="prev">← {{ page.prev.word }}</RouterLink><span v-else />
      <RouterLink v-if="page.next" :to="wordPath(page.next.word)" class="link min-w-0 truncate text-right" rel="next">{{ page.next.word }} →</RouterLink>
    </nav>
  </div>
  <div v-else-if="error === 'not_found'" class="card space-y-3" data-testid="word-not-found">
    <p>“{{ w }}” – {{ S.noResults }}</p>
    <RouterLink :to="'/search/' + encodeURIComponent(w)" class="btn-primary">{{ S.search }}: {{ w }}</RouterLink>
  </div>
  <ErrorBox v-else-if="error" @retry="load" />
  <Skeleton v-else />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import IconStar from '~icons/lucide/star'
import IconShare from '~icons/lucide/share-2'
import IconCopy from '~icons/lucide/copy'
import { ApiError, useApi } from '@/data/api'
import type { WordPage } from '@/data/types'
import { copyText, share, srcLabel, wordPath } from '@/composables/dict'
import { toast } from '@/composables/ui'
import { useSettings } from '@/stores/settings'
import { useWords } from '@/stores/words'
import { S } from '@/strings'
import EntryGroups from '@/components/EntryGroups.vue'
import DictBadge from '@/components/DictBadge.vue'
import DpdHeadword from '@/components/DpdHeadword.vue'
import DpdAnalysis from '@/components/DpdAnalysis.vue'
import ErrorBox from '@/components/ErrorBox.vue'
import Skeleton from '@/components/Skeleton.vue'

const route = useRoute()
const router = useRouter()
const api = useApi()
const settings = useSettings()
const words = useWords()
const page = ref<WordPage | null>(null)
const error = ref('')
const w = computed(() => String(route.params.w || ''))

async function load() {
  const want = w.value
  error.value = ''
  page.value = null
  try {
    const p = await api.word(want, settings.dictParam)
    if (want !== w.value) return
    if (p.word !== want) { router.replace(wordPath(p.word)); return }
    page.value = p
    words.remember(p.word, true)
  } catch (e) {
    error.value = e instanceof ApiError ? e.code : 'internal'
  }
}
watch([w, () => settings.dictParam], load, { immediate: true })

const starred = computed(() => !!page.value && words.isBookmarked(page.value.word))
function toggleStar() {
  if (page.value) toast(words.toggleBookmark(page.value.word) ? S.bookmarkAdded : S.bookmarkRemoved)
}
const url = () => 'https://arutha.lk' + wordPath(page.value?.word || '')
async function doShare() {
  if ((await share(page.value?.word || '', url())) === 'copied') toast(S.linkCopied)
}
async function doCopy() {
  const p = page.value
  if (!p) return
  const text = [p.word, ...p.entries.map(e => e.meaning.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')), ...p.dpd.map(h => `${h.lemma}: ${h.meaning}`), url()].join('\n\n')
  if (await copyText(text)) toast(S.copied)
}
// DPD's analysis when DPD has no headword of the word itself: the word is an inflected form or a compound
const showAnalysis = computed(() => {
  const p = page.value
  return !!p?.analysis && !p.dpd.length && (!!p.analysis.grammar?.length || !!p.analysis.deconstructor?.length)
})

useHead(() => {
  const p = page.value
  if (!p) return {}
  const title = p.src.includes('en') ? `${p.word} meaning in Sinhala – ${p.word} සිංහල තේරුම`
    : p.src === 'pi' ? `${p.word} (${p.roman}) – පාලි අර්ථය, Pali meaning` : `${p.word} – තේරුම, අර්ථය`
  return { title: `${title} | අරුත.lk` }
})
</script>
