import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import { makeRouter } from './router'
import { runMigration } from './stores/migrate'
import { isNativeApp } from './data/api'
import './styles/main.css'
import './styles/fonts.css'

// small DOM polyfills for old WebViews (Android 7 ships WebView 53: no getAttributeNames, no getRootNode, used by Vue)
if (!Element.prototype.getAttributeNames) {
  Element.prototype.getAttributeNames = function (this: Element) { return Array.prototype.map.call(this.attributes, (a: Attr) => a.name) as string[] }
}
if (!Node.prototype.getRootNode) {
  Node.prototype.getRootNode = function (this: Node) {
    return this.parentNode ? this.parentNode.getRootNode() : this
  }
}

runMigration() // the v1 site's bookmarks and settings (same origin), before the stores read theirs
// in the Android / iOS apps: no store links or install hints (.native .web-only, main.css)
if (isNativeApp()) document.documentElement.classList.add('native')
const app = createApp(App)
app.use(createPinia())
app.use(makeRouter())
app.use(createHead())
app.mount('#app')
// the server rendered article (server/ssr.go) is replaced by the app
document.getElementById('ssr')?.remove()

// the service worker caches the app's files (public/sw.js); not in the apps
if (!__IS_APP__ && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { /* not supported */ }))
}
