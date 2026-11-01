/**
 * The data API (server/engine Call ops). Two sources with the same JSON contract:
 *  - HttpSource: GET /api/<op>?params on the Go server (website)
 *  - NativeSource: the engine compiled into the Android / iOS app, reached through the native bridge
 * The front door (Api) adds a small LRU cache, request de-duplication and the SSR prefill. (From tipitaka.app.)
 */
import type { BookPage, DictInfo, DictLanding, Meta, SearchResult, WordPage, WordRef } from './types'

export type Params = Record<string, string | number | boolean | undefined>

export class ApiError extends Error {
  constructor(message: string, public code: 'bad_request' | 'not_found' | 'timeout' | 'no_dict' | 'internal' | 'busy' | 'network') { super(message) }
}

export interface DataSource {
  call<T>(op: string, params: Params): Promise<T>
}

/** string params with sorted keys (must equal server/ssr.go cacheKey) */
export function normParams(params: Params): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of Object.keys(params).sort()) {
    const v = params[k]
    if (v === undefined || v === '' || v === false) continue
    out[k] = v === true ? '1' : String(v)
  }
  return out
}
export const cacheKey = (op: string, params: Params) => `${op}|${JSON.stringify(normParams(params))}`

export class HttpSource implements DataSource {
  constructor(private base = import.meta.env.BASE_URL, private version = () => contentVersion(), private fetchImpl: typeof fetch = (...a) => fetch(...a)) {}
  async call<T>(op: string, params: Params): Promise<T> {
    const qs = new URLSearchParams(normParams(params))
    const v = this.version()
    if (v) qs.set('v', v)
    let res: Response
    try {
      res = await this.fetchImpl(`${this.base}api/${op}?${qs}`)
    } catch (e) {
      throw new ApiError((e as Error).message, 'network')
    }
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(body?.message ?? `HTTP ${res.status}`, body?.error ?? 'internal')
    return body as T
  }
}

/** the apps' bridge: requests are answered asynchronously by window.__aruthaResolve(id, response) */
export class NativeSource implements DataSource {
  private pending = new Map<string, (r: string) => void>()
  private seq = 0
  constructor(private send: (id: string, request: string) => void) {
    window.__aruthaResolve = (id, response) => {
      const fn = this.pending.get(id)
      this.pending.delete(id)
      fn?.(response)
    }
  }
  call<T>(op: string, params: Params): Promise<T> {
    const id = `q${++this.seq}`
    const request = JSON.stringify({ op, ...normParams(params) })
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, raw => {
        let r: { ok?: T; error?: string; message?: string }
        try { r = JSON.parse(raw) } catch { return reject(new ApiError('invalid response', 'internal')) }
        if (r.error) reject(new ApiError(r.message ?? r.error, r.error as ApiError['code']))
        else resolve(r.ok as T)
      })
      try { this.send(id, request) } catch (e) { this.pending.delete(id); reject(new ApiError(String(e), 'internal')) }
    })
  }
}

export function nativeSender(): ((id: string, request: string) => void) | null {
  if (typeof window === 'undefined') return null
  if (window.AruthaNative) return (id, request) => window.AruthaNative!.query(id, request)
  const ios = window.webkit?.messageHandlers?.arutha
  if (ios) return (id, request) => ios.postMessage({ id, request })
  return null
}

export const isNativeApp = () => __IS_APP__ || nativeSender() !== null

/** content hash of the data: from the server page (SSR) or the app build */
export function contentVersion(): string {
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="arutha-content"]')?.getAttribute('content')
    if (m) return m
  }
  return __BUILD_INFO__.content_hash || ''
}

class Lru<V> {
  private map = new Map<string, V>()
  constructor(private max: number) {}
  get(k: string) {
    const v = this.map.get(k)
    if (v !== undefined) { this.map.delete(k); this.map.set(k, v) }
    return v
  }
  set(k: string, v: V) {
    this.map.delete(k)
    this.map.set(k, v)
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string)
  }
}

/** API responses embedded by the server in <script id="ssr-data"> (server/ssr.go) */
export function readSsrData(): Record<string, unknown> {
  if (typeof document === 'undefined') return {}
  const el = document.getElementById('ssr-data')
  if (!el?.textContent) return {}
  try { return JSON.parse(el.textContent) } catch { return {} }
}

const NO_CACHE = new Set(['meta'])
const list = (a?: string[]) => (a && a.length ? a.join(',') : undefined)

export class Api {
  private cache = new Lru<unknown>(300)
  private inflight = new Map<string, Promise<unknown>>()
  constructor(public source: DataSource, prefill: Record<string, unknown> = {}) {
    for (const [k, v] of Object.entries(prefill)) this.cache.set(k, v)
  }
  call<T>(op: string, params: Params = {}): Promise<T> {
    const key = cacheKey(op, params)
    const hit = this.cache.get(key)
    if (hit !== undefined) return Promise.resolve(hit as T)
    let p = this.inflight.get(key)
    if (!p) {
      p = this.source.call<T>(op, params).then(r => { if (!NO_CACHE.has(op)) this.cache.set(key, r); return r })
        .finally(() => this.inflight.delete(key))
      this.inflight.set(key, p)
    }
    return p as Promise<T>
  }
  meta = () => this.call<Meta>('meta')
  dicts = () => this.call<DictInfo[]>('dicts')
  suggest = (q: string, dicts?: string[], limit?: number) => this.call<WordRef[]>('suggest', { q, dicts: list(dicts), limit })
  search = (q: string, dicts?: string[], page?: number) => this.call<SearchResult>('search', { q, dicts: list(dicts), page: page || undefined })
  word = (w: string, dicts?: string[]) => this.call<WordPage>('word', { w, dicts: list(dicts) })
  browse = (dict: string, page: number) => this.call<BookPage>('browse', { dict, page: String(page) })
  dictpage = (dict: string) => this.call<DictLanding>('dictpage', { dict })
}

let api: Api | null = null
export function useApi(): Api {
  if (!api) {
    const send = nativeSender()
    api = new Api(send ? new NativeSource(send) : new HttpSource(), readSsrData())
  }
  return api
}
export const setApi = (a: Api) => { api = a } // tests
