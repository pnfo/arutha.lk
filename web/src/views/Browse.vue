<!-- A page of a dictionary as the v1 site showed it (/bookpage/<dict>/<page>, 24 headwords a page). -->
<template>
  <div class="space-y-4" data-testid="browse-page">
    <template v-if="bp">
      <header class="flex flex-wrap items-center gap-2">
        <DictBadge :code="bp.dict" />
        <h1 class="text-xl font-bold"><RouterLink :to="`/dict/${bp.dict}`" class="hover:underline">{{ bp.name }}</RouterLink> – {{ S.page }} {{ bp.page }}</h1>
      </header>
      <article v-for="w in bp.words" :key="w.word" class="card">
        <RouterLink :to="wordPath(w.word)" class="font-text text-lg font-bold text-primary hover:underline">{{ w.word }}</RouterLink>
        <div class="text mt-1 space-y-1">
          <div v-for="(e, i) in w.entries" :key="i">
            <span v-if="e.word !== w.word && !isPali" class="font-semibold">{{ e.word }} </span>
            <MeaningHtml :html="e.meaning" :dict="e.dict" />
          </div>
        </div>
      </article>
      <nav class="flex items-center justify-between gap-2">
        <RouterLink v-if="bp.page > 1" :to="`/bookpage/${bp.v1}/${bp.page - 1}`" class="btn" rel="prev">← {{ bp.page - 1 }}</RouterLink><span v-else />
        <form class="flex items-center gap-1 text-sm" @submit.prevent="jump"><input v-model.number="to" type="number" min="1" :max="bp.pages" class="input w-20 py-1"> / {{ bp.pages }}</form>
        <RouterLink v-if="bp.page < bp.pages" :to="`/bookpage/${bp.v1}/${bp.page + 1}`" class="btn" rel="next">{{ bp.page + 1 }} →</RouterLink><span v-else />
      </nav>
    </template>
    <ErrorBox v-else-if="error" @retry="load" />
    <Skeleton v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useApi } from '@/data/api'
import type { BookPage } from '@/data/types'
import { useDicts, wordPath } from '@/composables/dict'
import { S } from '@/strings'
import DictBadge from '@/components/DictBadge.vue'
import MeaningHtml from '@/components/MeaningHtml.vue'
import ErrorBox from '@/components/ErrorBox.vue'
import Skeleton from '@/components/Skeleton.vue'

const route = useRoute(), router = useRouter()
const api = useApi()
const { byCode } = useDicts()
const bp = ref<BookPage | null>(null)
const error = ref(false)
const to = ref(1)
const isPali = computed(() => byCode(bp.value?.dict || '')?.src === 'pi')

async function load() {
  bp.value = null
  error.value = false
  try {
    const r = await api.browse(String(route.params.dict), Number(route.params.page))
    if (r.v1 !== route.params.dict) { router.replace(`/bookpage/${r.v1}/${r.page}`); return }
    bp.value = r
    to.value = r.page
  } catch {
    error.value = true
  }
}
watch(() => route.fullPath, load, { immediate: true })
const jump = () => { if (bp.value && to.value >= 1 && to.value <= bp.value.pages) router.push(`/bookpage/${bp.value.v1}/${to.value}`) }
useHead(() => ({ title: bp.value ? `${bp.value.name} පොතේ ${bp.value.page} පිටුවේ වචන | අරුත.lk` : 'අරුත.lk' }))
</script>
