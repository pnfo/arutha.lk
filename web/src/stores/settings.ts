/** Settings (localStorage arutha-settings-1): theme (light, sepia, dark), text size and the dictionaries shown, in their order. */
import { defineStore } from 'pinia'
import { computed, reactive, watch } from 'vue'
import { readJson, writeJson } from './storage'
import type { SavedSettings, Theme } from './migrate'

const KEY = 'arutha-settings-1'
export const TEXT_SIZES = [14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28]
export const THEMES: Theme[] = ['light', 'sepia', 'dark']
const BAR = { light: '#7a1824', sepia: '#6e1c22', dark: '#211e1a' }

export const useSettings = defineStore('settings', () => {
  const s = reactive<Required<SavedSettings>>({ theme: 'light', textSize: 18, dicts: [], hidden: [], ...readJson<SavedSettings>(KEY, {}) })
  if (!THEMES.includes(s.theme)) s.theme = 'light'
  watch(s, v => writeJson(KEY, v), { deep: true })

  /** the dicts parameter of the api: none while all dictionaries are shown in the default order (shares the SSR data) */
  const dictParam = computed(() => {
    if (!s.dicts.length && !s.hidden.length) return undefined
    return s.dicts.filter(d => !s.hidden.includes(d))
  })
  function setDicts(order: string[], hidden: string[], defaults: string[]) {
    const same = order.join() === defaults.join()
    s.dicts = same && !hidden.length ? [] : order
    s.hidden = hidden
  }
  return { s, dictParam, setDicts }
})

/** the theme on <html> (index.html sets it before the first paint) */
export function applyTheme(theme: Theme) {
  const cl = document.documentElement.classList
  cl.toggle('dark', theme === 'dark')
  cl.toggle('theme-sepia', theme === 'sepia')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme] || BAR.light)
  try { window.AruthaNative?.setStatusBarColor?.(BAR[theme] || BAR.light) } catch { /* old app */ }
}
