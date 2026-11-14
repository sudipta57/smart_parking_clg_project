import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The dev server forwards every /api request to FastAPI, so the browser
// only ever talks to one origin (no CORS needed during development).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // 127.0.0.1 instead of "localhost": newer Node versions may resolve
      // localhost to IPv6 (::1), while uvicorn listens on IPv4 by default.
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
