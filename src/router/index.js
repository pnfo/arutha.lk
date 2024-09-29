import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SearchView from '../views/SearchView.vue'
import BookpageView from '@/views/BookpageView.vue'
import BookmarksView from '@/views/BookmarksView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SankethaView from '@/views/SankethaView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue')
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
      path: '/sanketha/:dictId',
      name: 'sanketha', 
      component: SankethaView,
    }
  ]
})

export default router
