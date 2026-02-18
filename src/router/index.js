import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SearchView from '../views/SearchView.vue'
import BookpageView from '@/views/BookpageView.vue'
import BookmarksView from '@/views/BookmarksView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SankethaView from '@/views/SankethaView.vue'
import AboutView from '../views/AboutView.vue'

const router = createRouter({
  // If Native Android -> Use Hash Mode (#/home) - Essential for file:// loading
  // If Web Browser   -> Use Web Mode (/home)   - Prettier URLs
  history: !!window.AndroidBackend ? createWebHashHistory() : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView,
    },
    {
      path: '/search/:term', // The colon indicates a dynamic parameter named 'term'
      name: 'search',
      component: SearchView,
    },
    {
      path: '/bookpage/:dictId/:page',
      name: 'bookpage',
      component: BookpageView,
    },
    {
      path: '/bookmarks',
      name: 'bookmarks',
      component: BookmarksView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/abbreviations/:dictId',
      name: 'abbreviations',
      component: SankethaView,
    }
  ]
})

export default router
