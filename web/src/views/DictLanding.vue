<!-- A dictionary's page (/dict/<code>, /dict/pali): what it is, an A-Z index into its book pages, common words. -->
<template>
  <div class="space-y-5" data-testid="dict-page">
    <template v-if="dl">
      <header class="space-y-1">
        <h1 class="text-2xl font-bold text-primary">{{ title }}</h1>
        <p v-if="code === 'pali'" class="text-muted">පාලි වචනවල සිංහල අර්ථ සහ ව්‍යාකරණ. Pali words can be typed in Sinhala, Roman or Singlish, in any inflected form.</p>
      </header>
      <section v-if="dl.about" class="card prose" data-testid="dict-about" @click="onAbout" v-html="cleanAbout(dl.about)" />
      <section v-for="d in dl.dicts" :key="d.code" class="card flex items-start gap-3">
        <DictBadge :code="d.code" />
        <div class="min-w-0 text-sm">
          <RouterLink :to="`/dict/${d.code}`" class="font-semibold">{{ d.name }}</RouterLink>
          <div>{{ d.desc }}</div>
          <div class="text-muted">{{ d.entries.toLocaleString() }} · {{ d.origin }}</div>
          <RouterLink v-if="d.abbrevs && Object.keys(d.abbrevs).length" :to="`/abbreviations/${d.v1 || d.code}`" class="link">{{ S.abbreviations }}</RouterLink>
        </div>
      </section>
      <section v-if="dl.letters.length">
        <div class="section-title">{{ S.letters }}</div>
        <div class="flex flex-wrap gap-1.5">
          <RouterLink v-for="l in dl.letters" :key="l.letter" :to="`/bookpage/${l.v1}/${l.page}`" class="chip min-w-[2.5rem] justify-center">{{ l.letter }}</RouterLink>
        </div>
      </section>
      <section v-if="dl.words.length">
        <div class="section-title">{{ S.commonWords }}</div>
        <div class="flex flex-wrap gap-1.5">
          <RouterLink v-for="w in dl.words" :key="w.word" :to="wordPath(w.word)" class="chip">{{ w.word }}</RouterLink>
        </div>
      </section>
      <p v-if="code === 'dpd' || code === 'pali'" class="text-xs text-muted">Digital Pāḷi Dictionary: Bodhirasa Bhikkhu, dpdict.net, CC BY-NC-SA 4.0.</p>
    </template>
    <ErrorBox v-else-if="error" @retry="load" />
    <Skeleton v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { isNativeApp, useApi } from '@/data/api'
import type { DictLanding } from '@/data/types'
import { cleanAbout, wordPath } from '@/composables/dict'
import { S } from '@/strings'
import DictBadge from '@/components/DictBadge.vue'
import ErrorBox from '@/components/ErrorBox.vue'
import Skeleton from '@/components/Skeleton.vue'

const route = useRoute()
const router = useRouter()
/** links of the about text to pages of the site: by the router (no reload; the apps use hash routing) */
function onAbout(e: MouseEvent) {
  const a = (e.target as Element | null)?.closest?.('a[href^="/"]')
  const href = a?.getAttribute('href') || ''
  if (!a) return
  if (/\.(pdf|html)$/.test(href)) {
    // a file: the apps open the site's copy in the browser (the app's WebView shows no pdf)
    if (isNativeApp()) { e.preventDefault(); location.href = 'https://arutha.lk' + href }
    return
  }
  e.preventDefault()
  router.push(decodeURIComponent(href))
}
const api = useApi()
const code = computed(() => String(route.params.code))
const dl = ref<DictLanding | null>(null)
const error = ref(false)
const title = computed(() => code.value === 'pali' ? 'පාලි සිංහල ශබ්දකෝෂය – Pali Sinhala Dictionary' : dl.value?.dicts[0]?.name || '')

async function load() {
  dl.value = null
  error.value = false
  try { dl.value = await api.dictpage(code.value) } catch { error.value = true }
}
watch(code, load, { immediate: true })
useHead(() => ({ title: `${title.value} | අරුත.lk` }))
</script>
