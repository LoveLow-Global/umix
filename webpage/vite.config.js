import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Two pages: the site (index.html) and the phone prototype on the real model (proto/index.html, at /proto/).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), proto: resolve(import.meta.dirname, 'proto/index.html') },
    },
  },
})
