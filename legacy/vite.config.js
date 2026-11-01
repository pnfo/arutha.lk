import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    legacy({
      // Ensure compatibility down to Android 7 (API 24)
      targets: ['defaults', 'not IE 11', 'chrome 51', 'android >= 7']
    }),
  ],
  server: {
    proxy: {
      '/sql-query': "http://192.168.1.20:3000",
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // This ensures assets are loaded like "./assets/file.js" 
  // instead of "/assets/file.js" needed for android app
  base: './',
})
