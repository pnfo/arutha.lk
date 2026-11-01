import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import { makeRouter } from './router'
import { runMigration } from './stores/migrate'
import './styles/main.css'
import './styles/fonts.css'

// small DOM polyfill for old WebViews (Android 7 ships WebView 53)
if (!Element.prototype.getAttributeNames) {
  Element.prototype.getAttributeNames = function (this: Element) { return Array.prototype.map.call(this.attributes, (a: Attr) => a.name) as string[] }
}

runMigration() // the v1 site's bookmarks and settings (same origin), before the stores read theirs
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
