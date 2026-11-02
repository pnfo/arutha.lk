/** Dictionary helpers: the dictionary list, sanitised meanings, word urls. */
import DOMPurify from 'dompurify'
import { ref } from 'vue'
import reservedJson from '@shared/reserved.json'
import { useApi } from '@/data/api'
import type { DictInfo } from '@/data/types'

const TAGS = ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'small', 'sup', 'sub', 'ul', 'ol', 'li', 'a', 'abbr']
const ATTRS = ['class', 'data-dict', 'data-hom', 'data-a']

/** the meaning markup of build/dicts/text.ts and tipitaka.app (links carry no href: MeaningHtml handles the clicks) */
export const cleanMeaning = (html: string) => DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOW_DATA_ATTR: false })

/** the about texts of the dictionary pages (data/about: links, headings, tables, the preface in a <details>) */
export const cleanAbout = (html: string) => DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ['p', 'b', 'i', 'br', 'a', 'h3', 'ul', 'li', 'table', 'tr', 'td', 'details', 'summary', 'span'],
  ALLOWED_ATTR: ['href', 'class'],
})

export const reserved = new Set<string>(reservedJson.reserved)

/** the url of a headword's page (server/ssr.go wordPath) */
export function wordPath(w: string): string {
  return (reserved.has(w) || reserved.has(w.toLowerCase()) ? '/word/' : '/') + encodeURIComponent(w)
}

const dicts = ref<DictInfo[]>([])
let loading: Promise<DictInfo[]> | null = null

/** the dictionaries (loaded once) */
export function useDicts() {
  if (!loading) loading = useApi().dicts().then(d => (dicts.value = d)).catch(() => { loading = null; return [] })
  const byCode = (code: string) => dicts.value.find(d => d.code === code)
  return { dicts, ready: loading, byCode }
}

/** the sources of a headword (si, pi, en: comma separated) as a label */
export const srcLabel = (src: string) => src.split(',').map(s => ({ si: 'සිං', pi: 'පාලි', en: 'Eng' } as Record<string, string>)[s] || s).join(' · ')

/** a link as people read it: Sinhala letters instead of %E0%B6.. (spaces stay %20, so the link stays one piece in a text) */
export function readableUrl(url: string) {
  try { return decodeURI(url).replace(/ /g, '%20') } catch { return url }
}

export async function share(title: string, url: string) {
  try { if (window.AruthaNative?.share) { window.AruthaNative.share(`${title}\n${readableUrl(url)}`); return 'shared' } } catch { /* old app */ }
  if (navigator.share) {
    try { await navigator.share({ title, url }); return 'shared' } catch { return 'cancelled' }
  }
  return (await copyText(readableUrl(url))) ? 'copied' : 'failed'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // old WebViews: a textarea and execCommand
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { /* no clipboard */ }
    document.body.removeChild(ta)
    return ok
  }
}
