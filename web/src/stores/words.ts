/** Bookmarks (arutha-bookmarks-1) and history (arutha-history-1) of the word pages and searches. */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readJson, writeJson } from './storage'
import type { Bookmark } from './migrate'

export interface HistoryItem { q: string; word: boolean; time: number }
const MAX_HISTORY = 200

export const useWords = defineStore('words', () => {
  const bookmarks = ref<Bookmark[]>(readJson('arutha-bookmarks-1', []))
  const history = ref<HistoryItem[]>(readJson('arutha-history-1', []))
  watch(bookmarks, v => writeJson('arutha-bookmarks-1', v), { deep: true })
  watch(history, v => writeJson('arutha-history-1', v), { deep: true })

  const isBookmarked = (w: string) => bookmarks.value.some(b => b.word === w)
  function toggleBookmark(w: string) {
    const i = bookmarks.value.findIndex(b => b.word === w)
    if (i >= 0) bookmarks.value.splice(i, 1)
    else bookmarks.value.unshift({ word: w, time: Date.now() })
    return i < 0
  }
  /** a word page opened or a search made (the newest first, once) */
  function remember(q: string, word: boolean) {
    q = q.trim()
    if (!q) return
    const i = history.value.findIndex(h => h.q === q && h.word === word)
    if (i >= 0) history.value.splice(i, 1)
    history.value.unshift({ q, word, time: Date.now() })
    if (history.value.length > MAX_HISTORY) history.value.length = MAX_HISTORY
  }
  const clearHistory = () => { history.value = [] }
  return { bookmarks, history, isBookmarked, toggleBookmark, remember, clearHistory }
})
