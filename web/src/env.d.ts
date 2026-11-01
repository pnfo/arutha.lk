/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />

declare const __IS_APP__: boolean
declare const __BUILD_INFO__: { content_hash: string }

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

/**
 * Native bridge of the Android / iOS apps (dev-docs/native-bridge.md):
 *  Android: window.AruthaNative.query(id, request)   (@JavascriptInterface)
 *  iOS:     window.webkit.messageHandlers.arutha.postMessage({ id, request })
 * The app answers with window.__aruthaResolve(id, response) on the UI thread.
 */
interface AruthaNativeBridge {
  query(id: string, request: string): void
  setStatusBarColor?(hex: string): void
  share?(text: string): void
}
interface Window {
  AruthaNative?: AruthaNativeBridge
  webkit?: { messageHandlers?: { arutha?: { postMessage(m: { id: string; request: string }): void } } }
  __aruthaResolve?: (id: string, response: string) => void
}
