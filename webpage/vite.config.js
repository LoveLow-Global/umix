import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // During npm run dev, /api goes to the Julia server on your laptop (make serve).
  // Only the "Julia API" engine in the facilitator panel uses it.
  server: { proxy: { '/api': 'http://localhost:8080' } },
})
