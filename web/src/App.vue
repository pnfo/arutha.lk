<template>
  <div class="flex min-h-screen flex-col">
    <header class="pt-safe sticky top-0 z-40 border-b border-line bg-surface">
      <div class="mx-auto flex h-14 max-w-4xl items-center gap-2 px-3 sm:px-4">
        <RouterLink to="/" class="flex shrink-0 items-center" :aria-label="S.home">
          <!-- the icon's අ begins the name: [අ]රුත.lk (design/tools/brand.py); phones show only the icon beside the search box -->
          <img :src="base + 'images/logo-light.svg'" alt="අරුත.lk" class="logo-light h-9 w-auto" :class="{ 'logo-narrow': !isHome }">
          <img :src="base + 'images/logo-dark.svg'" alt="අරුත.lk" class="logo-dark h-9 w-auto" :class="{ 'logo-narrow': !isHome }">
        </RouterLink>
        <div class="min-w-0 flex-1">
          <SearchBox v-if="!isHome" :model-value="routeQuery" />
        </div>
        <RouterLink to="/bookmarks" class="icon-btn hidden sm:inline-flex" :title="S.bookmarks"><IconStar class="h-5 w-5" /></RouterLink>
        <button class="icon-btn" :aria-label="'menu'" data-testid="menu-button" @click="menu = true"><IconMenu class="h-5 w-5" /></button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-4xl flex-1 px-3 py-4 sm:px-4">
      <RouterView />
    </main>

    <footer class="pb-safe border-t border-line py-4 text-center text-sm text-muted">
      <RouterLink to="/about" class="link">{{ S.about }}</RouterLink> ·
      <a :href="privacyUrl" class="link">Privacy</a>
      <span class="web-only">· <a :href="ANDROID_URL" class="link" rel="noopener">Android app</a> ·
        <a v-if="IOS_URL" :href="IOS_URL" class="link" rel="noopener">iPhone / iPad app</a><RouterLink v-else to="/about#apps" class="link">{{ IOS_SOON }}</RouterLink></span>
      <div class="mt-1 text-xs">{{ S.site }} – {{ S.tagline }} · Sinhala · English · Pali</div>
    </footer>

    <!-- menu -->
    <div v-if="menu" class="fixed inset-0 z-50 bg-black/40" style="background: rgba(0,0,0,.4)" @click="menu = false" />
    <nav v-if="menu" class="pt-safe fixed bottom-0 right-0 top-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-surface p-3 shadow-2xl" data-testid="menu" @click="menu = false">
      <div class="mb-2 px-3 py-2"><img :src="base + 'images/logo-light.svg'" alt="අරුත.lk" class="logo-light h-9"><img :src="base + 'images/logo-dark.svg'" alt="අරුත.lk" class="logo-dark h-9"></div>
      <RouterLink to="/" class="menu-item"><IconHome class="h-5 w-5 text-muted" />{{ S.home }}</RouterLink>
      <RouterLink to="/bookmarks" class="menu-item"><IconStar class="h-5 w-5 text-muted" />{{ S.bookmarks }}</RouterLink>
      <RouterLink to="/history" class="menu-item"><IconHistory class="h-5 w-5 text-muted" />{{ S.history }}</RouterLink>
      <RouterLink to="/settings" class="menu-item"><IconSettings class="h-5 w-5 text-muted" />{{ S.settings }}</RouterLink>
      <RouterLink to="/about" class="menu-item"><IconInfo class="h-5 w-5 text-muted" />{{ S.about }}</RouterLink>
      <div class="section-title mt-3 px-3">{{ S.dictionaries }}</div>
      <RouterLink v-for="d in dicts" :key="d.code" :to="`/dict/${d.code}`" class="menu-item text-sm"><DictBadge :code="d.code" />{{ d.name }}</RouterLink>
      <RouterLink to="/dict/pali" class="menu-item text-sm"><span class="badge src-pi">පා</span>පාලි සිංහල ශබ්දකෝෂය</RouterLink>
    </nav>

    <!-- abbreviation popover, toast -->
    <div v-if="popover.text" class="fixed z-50 max-w-[16rem] -translate-x-1/2 rounded-lg bg-fg px-3 py-1.5 text-sm text-bg shadow-lg" data-testid="abbr-popover"
      :style="{ left: popover.x + 'px', top: popover.y + 'px', transform: popover.below ? 'translateX(-50%)' : 'translate(-50%, -100%)' }">
      <b>{{ popover.abbr }}</b> {{ popover.text }}
    </div>
    <div v-if="toastMsg" class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-fg px-4 py-2 text-sm text-bg shadow-lg" style="transform: translateX(-50%)" role="status">{{ toastMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import IconMenu from '~icons/lucide/menu'
import IconStar from '~icons/lucide/star'
import IconHome from '~icons/lucide/home'
import IconHistory from '~icons/lucide/history'
import IconSettings from '~icons/lucide/settings'
import IconInfo from '~icons/lucide/info'
import SearchBox from './components/SearchBox.vue'
import DictBadge from './components/DictBadge.vue'
import { useDicts } from './composables/dict'
import { hidePopover, popover, useToast } from './composables/ui'
import { startStats } from './composables/stats'
import { applyTheme, useSettings } from './stores/settings'
import { isNativeApp } from './data/api'
import { S } from './strings'
import { ANDROID_URL, IOS_SOON, IOS_URL } from './apps'

const base = import.meta.env.BASE_URL
// the apps open the privacy policy of the site in the browser (a file of the app would replace the app's page)
const privacyUrl = isNativeApp() ? 'https://arutha.lk/privacy-policy.html' : base + 'privacy-policy.html'
const route = useRoute()
const router = useRouter()
const settings = useSettings()
const { dicts } = useDicts()
const toastMsg = useToast()
const menu = ref(false)
const isHome = computed(() => route.name === 'home')
const routeQuery = computed(() => (route.name === 'search' ? String(route.params.q || '') : route.name?.toString().startsWith('word') ? String(route.params.w || '') : ''))

useHead({ titleTemplate: t => t || 'අරුත.lk සිංහල ශබ්දකෝෂය', htmlAttrs: { lang: 'si' } })

watch(() => settings.s.theme, applyTheme, { immediate: true })
watch(() => settings.s.textSize, s => document.documentElement.style.setProperty('--text-size', s + 'px'), { immediate: true })
router.afterEach(() => hidePopover())
onMounted(() => {
  document.addEventListener('click', hidePopover)
  window.addEventListener('scroll', hidePopover, { passive: true })
  if (!isNativeApp()) {
    let isNew = true
    try { isNew = !localStorage.getItem('arutha-last-visit') } catch { /* blocked */ }
    startStats(router, isNew)
  }
})
</script>
