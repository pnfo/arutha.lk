<!--
  The search box: suggestions while typing (Sinhala, Singlish, English or Roman Pali; from the first letter), the
  recent searches when empty. Enter opens the chosen suggestion, or the search results of the typed text.
-->
<template>
  <form class="relative" role="search" @submit.prevent="submit" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.esc="close">
    <div class="flex items-center rounded-full border border-line bg-surface shadow-sm focus-within:border-primary"
      :class="large ? 'h-14 px-2 text-lg' : 'h-11 px-1'">
      <IconSearch class="ml-2 h-5 w-5 shrink-0 text-muted" />
      <input ref="input" v-model="q" type="search" class="h-full w-full min-w-0 bg-transparent px-2 outline-none" :placeholder="S.searchPlaceholder"
        :aria-label="S.search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search"
        role="combobox" :aria-expanded="showMenu" aria-controls="search-menu" data-testid="search-input"
        @focus="focused = true" @blur="onBlur" @input="active = -1">
      <button v-if="q" type="button" class="icon-btn h-8 w-8 text-muted" aria-label="clear" @mousedown.prevent="clear"><IconX class="h-4 w-4" /></button>
    </div>
    <div v-if="showMenu" id="search-menu" class="absolute inset-x-0 z-50 mt-1 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-xl"
      role="listbox" data-testid="search-menu">
      <div v-if="!q.trim()" class="px-4 pb-1 pt-2 text-xs text-muted">{{ S.recent }}</div>
      <button v-for="(it, i) in items" :key="it.key" type="button" role="option" :aria-selected="i === active"
        class="flex w-full items-center gap-3 px-4 py-2 text-left" :class="{ 'bg-surface2': i === active }"
        @mousedown.prevent="choose(i)" @mouseenter="active = i">
        <component :is="it.icon" class="h-4 w-4 shrink-0 text-muted" />
        <span class="min-w-0 flex-1 truncate text-[1.05rem]">{{ it.label }}</span>
        <span v-if="it.src" class="text-xs text-muted">{{ srcLabel(it.src) }}</span>
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import IconSearch from '~icons/lucide/search'
import IconX from '~icons/lucide/x'
import IconHistory from '~icons/lucide/history'
import IconBook from '~icons/lucide/book-open'
import { useApi } from '@/data/api'
import type { WordRef } from '@/data/types'
import { srcLabel, wordPath } from '@/composables/dict'
import { useSettings } from '@/stores/settings'
import { useWords } from '@/stores/words'
import { S } from '@/strings'

const props = defineProps<{ modelValue?: string; large?: boolean; autofocus?: boolean }>()
interface Item { key: string; label: string; src?: string; icon: Component; go: () => void }

const router = useRouter()
const api = useApi()
const settings = useSettings()
const words = useWords()
const q = ref(props.modelValue || '')
const focused = ref(false)
const active = ref(-1)
const suggestions = ref<WordRef[]>([])
const input = ref<HTMLInputElement>()

watch(() => props.modelValue, v => { if (v !== undefined && !focused.value) q.value = v })
if (props.autofocus) setTimeout(() => input.value?.focus(), 0)

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(q, v => {
  clearTimeout(timer)
  const text = v.trim()
  if (!text) { suggestions.value = []; return }
  timer = setTimeout(async () => {
    const my = ++seq
    try {
      const r = await api.suggest(text, settings.dictParam, 8)
      if (my === seq) suggestions.value = r
    } catch { /* offline: no suggestions */ }
  }, 120)
})
onBeforeUnmount(() => clearTimeout(timer))

const items = computed<Item[]>(() => {
  if (!q.value.trim()) {
    return words.history.slice(0, 8).map(h => ({ key: 'h' + h.q + h.word, label: h.q, icon: IconHistory,
      go: () => router.push(h.word ? wordPath(h.q) : '/search/' + encodeURIComponent(h.q)) }))
  }
  return suggestions.value.map(s => ({ key: 's' + s.word, label: s.word, src: s.src, icon: IconBook, go: () => router.push(wordPath(s.word)) }))
})
const showMenu = computed(() => focused.value && items.value.length > 0)

function move(d: number) {
  if (!items.value.length) return
  active.value = (active.value + d + items.value.length + 1) % (items.value.length + 1) - 1
}
function choose(i: number) {
  const it = items.value[i]
  if (!it) return
  it.go()
  close()
}
function submit() {
  if (active.value >= 0) return choose(active.value)
  const text = q.value.trim()
  if (!text) return
  close()
  router.push('/search/' + encodeURIComponent(text))
}
function close() {
  focused.value = false
  active.value = -1
  input.value?.blur()
}
function clear() {
  q.value = ''
  suggestions.value = []
  input.value?.focus()
}
function onBlur() { setTimeout(() => { focused.value = false }, 120) }
defineExpose({ focus: () => input.value?.focus() })
</script>
