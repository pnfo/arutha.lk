<script setup>
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import { ref, onMounted } from 'vue'
import { MenuIcon, XIcon, HomeIcon, MoonIcon, SunIcon, SettingsIcon, UsersIcon} from 'lucide-vue-next'
import StarIcon from './components/icons/StarIcon.vue'

const isSidebarOpen = ref(false)
const toggleSidebar = () => isSidebarOpen.value = !isSidebarOpen.value
const closeSidebar = () => isSidebarOpen.value = false

const darkMode = ref(false)
function toggleDarkMode() {
  darkMode.value = !darkMode.value;
  if (darkMode.value) {
    document.documentElement.classList.add('dark')
    localStorage.theme = 'dark'
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.theme = 'light'
  }
}

const searchTerm = ref('')
// prevent multiple searches that makes the UI sluggish when typing fast in the search box
let timeoutId
const router = useRouter(), route = useRoute()
function doSearch() {
    const term = searchTerm.value.trim().toLowerCase().replace(/[^a-z\u0D80-\u0DFF \.%\-\u200d]/g, '')
    if (!term.length) return
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => router.push('/search/' + term), 400)
}
function checkSearch(focused) {
    if (focused && searchTerm.value.length && route && !route.path.includes('search')) doSearch()
}
import { useSinhalaStore, dictionaryInfos } from '@/stores/sinhala'
for (const info of dictionaryInfos) {
    //useSinhalaStore(info.id).loadData()
}

import { useSavedStore, useSettingsStore } from '@/stores/savedStore'
const settingsStore = useSettingsStore(), initStoreIds = ['bookmarks']

onMounted(() => {
  settingsStore.loadSettings()
  initStoreIds.forEach(id => useSavedStore(id).loadState())

  darkMode.value = document.documentElement.classList.contains('dark');
  isSidebarOpen.value = window.innerWidth > 1024; // Adjust 768 to your desired breakpoint
});
</script>

<template>

  <div class="flex flex-col h-screen bg-[var(--bg-color)] text-[var(--text-color)]">
    <div class="px-4 py-1 flex justify-between items-center bg-green-600 dark:bg-green-900"> 
      <button @click="toggleSidebar" >
        <MenuIcon></MenuIcon>  
      </button>

      <div class="relative w-full max-w-[400px] mx-3">
        <!-- Input field -->
        <input type="text"
          class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-green-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-300 dark:focus:ring-blue-400"
          placeholder="සෙවුම් පද මෙතැන යොදන්න"
          v-model="searchTerm"
          @input="doSearch"
          @focus="checkSearch"
        />
        
        <!-- Clear button (X) -->
        <button @click="clearSearch"
          class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white focus:outline-none">
          <XIcon size="15"/>
        </button>
      </div>

      <button @click="toggleDarkMode" >
        <SunIcon v-if="darkMode"></SunIcon>
        <MoonIcon v-else></MoonIcon>
      </button>
    </div> 

    <div class="flex-1 flex flex-col lg:flex-row relative">
      <div :class="isSidebarOpen ? 'w-64' : 'w-0'" 
        class="transition-all duration-300 overflow-hidden drop-shadow absolute lg:static top-0 left-0 h-screen lg:h-auto z-10 bg-[var(--bg-color)]">
        <div class="flex flex-col lg:h-full">
          <RouterLink to="/" class="px-4 py-2 hover:bg-[var(--hover-color)] flex items-center"><HomeIcon class="mr-2" size="20"/>මුල් පිටුව / Home</RouterLink>
          <RouterLink to="/" class="px-4 py-2 hover:bg-[var(--hover-color)] flex items-center"><StarIcon class="mr-2" size="20"/>තරුයෙදූ / Bookmarks</RouterLink>
          <RouterLink to="/about" class="px-4 py-2 hover:bg-[var(--hover-color)] flex items-center"><UsersIcon class="mr-2" size="20"/>අප ගැන</RouterLink>
          <div class="flex-grow"></div>
          <RouterLink to="/about" class="px-4 py-2 hover:bg-[var(--hover-color)] flex items-center"><SettingsIcon class="mr-2" size="20"/>සැකසුම් / Settings</RouterLink>
        </div>
        <XIcon @click="closeSidebar" class="absolute top-3 right-3 text-gray-500 cursor-pointer lg:hidden" size="18"></XIcon>
      </div>

      <div class="p-4 flex-grow">
        <RouterView /> 
      </div>
    </div>

  </div>

</template>