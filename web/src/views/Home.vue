<template>
  <div class="space-y-8 py-4 sm:py-10" data-testid="home">
    <section class="mx-auto max-w-2xl text-center">
      <img :src="base + 'images/favicon.svg'" alt="" class="mx-auto mb-3 h-16 w-16">
      <h1 class="brand-title text-primary">{{ S.site }} <span class="text-fg">{{ S.tagline }}</span></h1>
      <p class="mt-2 text-muted">සිංහල, ඉංග්‍රීසි සහ පාලි වචනවල තේරුම් එකම තැනකින් · {{ S.subtitle }}</p>
      <div class="mt-6 text-left"><SearchBox large :autofocus="wide" /></div>
      <p class="mt-3 text-sm text-muted">
        උදා: <RouterLink v-for="e in examples" :key="e[0]" :to="e[1]" class="link mx-1">{{ e[0] }}</RouterLink>
      </p>
    </section>

    <section v-if="words.history.length" class="mx-auto max-w-2xl">
      <div class="section-title">{{ S.recent }}</div>
      <div class="flex flex-wrap gap-2">
        <RouterLink v-for="h in words.history.slice(0, 12)" :key="h.q + h.word" :to="h.word ? wordPath(h.q) : '/search/' + encodeURIComponent(h.q)" class="chip">{{ h.q }}</RouterLink>
      </div>
    </section>

    <section class="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
      <RouterLink v-for="d in dicts" :key="d.code" :to="`/dict/${d.code}`" class="card flex items-center gap-3 hover:border-primary">
        <DictBadge :code="d.code" />
        <span class="min-w-0"><span class="block font-medium">{{ d.name }}</span><span class="block text-xs text-muted">{{ d.entries.toLocaleString() }} · {{ d.desc }}</span></span>
      </RouterLink>
    </section>

    <section class="card prose mx-auto max-w-2xl">
      <h2>සොයන ආකාරය</h2>
      <p>සිංහලෙන්, ඉංග්‍රීසි අකුරෙන් (Singlish: <i>akuru</i> → අකුරු), ඉංග්‍රීසියෙන් (<i>love</i>) හෝ පාලි වචනයක් (<i>buddhassa</i>, ධම්මස්ස) ලියන්න. විභක්ති රූප සහ වචනවල තේරුම් තුළින්ද සොයයි.</p>
      <p><RouterLink to="/about" class="link">වැඩි විස්තර / Help →</RouterLink></p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
import SearchBox from '@/components/SearchBox.vue'
import DictBadge from '@/components/DictBadge.vue'
import { useDicts, wordPath } from '@/composables/dict'
import { useWords } from '@/stores/words'
import { S } from '@/strings'

const base = import.meta.env.BASE_URL
const { dicts } = useDicts()
const words = useWords()
const wide = typeof window !== 'undefined' && window.innerWidth >= 900 // no keyboard popping up on phones
const examples: [string, string][] = [['ධර්මය', wordPath('ධර්මය')], ['akuru', '/search/akuru'], ['love', wordPath('love')], ['buddhassa', '/search/buddhassa']]
useHead({ title: 'අරුත.lk සිංහල ශබ්දකෝෂය' })
</script>
