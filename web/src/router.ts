/**
 * The routes (server/ssr.go renders the same urls). A word's page is /<word>; words that are also the first segment
 * of another route (shared/reserved.json) are at /word/<word>. History mode on the web, hash mode in the apps.
 */
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import Word from './views/Word.vue'

export function makeRouter() {
  return createRouter({
    history: __IS_APP__ ? createWebHashHistory() : createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: Home },
      { path: '/search/:q', name: 'search', component: () => import('./views/Search.vue') },
      { path: '/word/:w', name: 'word-reserved', component: Word },
      { path: '/bookpage/:dict/:page', name: 'browse', component: () => import('./views/Browse.vue') },
      { path: '/abbreviations/:dict', name: 'abbreviations', component: () => import('./views/Abbreviations.vue') },
      { path: '/dict/:code', name: 'dict', component: () => import('./views/DictLanding.vue') },
      { path: '/bookmarks', name: 'bookmarks', component: () => import('./views/Bookmarks.vue') },
      { path: '/history', name: 'history', component: () => import('./views/History.vue') },
      { path: '/settings', name: 'settings', component: () => import('./views/Settings.vue') },
      { path: '/about', name: 'about', component: () => import('./views/About.vue') },
      { path: '/:w', name: 'word', component: Word },
      { path: '/:pathMatch(.*)*', name: 'notfound', component: () => import('./views/NotFound.vue') },
    ],
    scrollBehavior(to, _from, saved) {
      if (saved) return saved
      if (to.hash) return { el: to.hash }
      return { top: 0 }
    },
  })
}
