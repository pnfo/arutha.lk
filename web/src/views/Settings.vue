<template>
  <div class="space-y-5" data-testid="settings-page">
    <h1 class="text-xl font-bold">{{ S.settings }}</h1>
    <section class="card space-y-2">
      <div class="section-title">{{ S.theme }}</div>
      <div class="flex gap-2">
        <button v-for="t in THEMES" :key="t" class="theme-choice" :class="[`theme-choice-${t}`, { on: settings.s.theme === t }]" :aria-pressed="settings.s.theme === t"
          :data-testid="`theme-${t}`" @click="settings.s.theme = t">{{ S.themes[t] }}</button>
      </div>
    </section>
    <section class="card space-y-2">
      <div class="section-title">{{ S.textSize }} ({{ settings.s.textSize }}px)</div>
      <input v-model.number="settings.s.textSize" type="range" :min="TEXT_SIZES[0]" :max="TEXT_SIZES[TEXT_SIZES.length - 1]" step="1" class="w-full" data-testid="text-size">
      <p class="text" :style="{ fontSize: settings.s.textSize + 'px' }">ධර්මය – ලොව්තුරා දහම; dhamma.</p>
    </section>
    <section class="card space-y-2">
      <div class="flex items-center justify-between">
        <div class="section-title mb-0">{{ S.dictsShown }}</div>
        <button class="btn" @click="reset">{{ S.resetDicts }}</button>
      </div>
      <ul class="divide-y divide-line">
        <li v-for="(c, i) in order" :key="c" class="flex items-center gap-2 py-1.5" data-testid="dict-setting">
          <input :id="'d-' + c" type="checkbox" :checked="!hidden.includes(c)" @change="toggle(c)">
          <DictBadge :code="c" />
          <label :for="'d-' + c" class="min-w-0 flex-1 truncate text-sm">{{ byCode(c)?.name }}</label>
          <button class="icon-btn h-8 w-8" :disabled="i === 0" aria-label="up" @click="move(i, -1)"><IconUp class="h-4 w-4" /></button>
          <button class="icon-btn h-8 w-8" :disabled="i === order.length - 1" aria-label="down" @click="move(i, 1)"><IconDown class="h-4 w-4" /></button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useHead } from '@unhead/vue'
import IconUp from '~icons/lucide/chevron-up'
import IconDown from '~icons/lucide/chevron-down'
import { useDicts } from '@/composables/dict'
import { TEXT_SIZES, THEMES, useSettings } from '@/stores/settings'
import { S } from '@/strings'
import DictBadge from '@/components/DictBadge.vue'

const settings = useSettings()
const { dicts, byCode } = useDicts()
const defaults = computed(() => dicts.value.map(d => d.code))
// the saved order, with dictionaries added since at the end
const order = computed(() => {
  const saved = settings.s.dicts.filter(c => defaults.value.includes(c))
  return [...saved, ...defaults.value.filter(c => !saved.includes(c))]
})
const hidden = computed(() => settings.s.hidden)
function toggle(c: string) {
  const h = hidden.value.includes(c) ? hidden.value.filter(x => x !== c) : [...hidden.value, c]
  if (h.length < order.value.length) settings.setDicts(order.value, h, defaults.value)
}
function move(i: number, d: number) {
  const o = [...order.value]
  ;[o[i], o[i + d]] = [o[i + d], o[i]]
  settings.setDicts(o, hidden.value, defaults.value)
}
const reset = () => settings.setDicts(defaults.value, [], defaults.value)
useHead({ title: 'Settings | අරුත.lk', meta: [{ name: 'robots', content: 'noindex' }] })
</script>
