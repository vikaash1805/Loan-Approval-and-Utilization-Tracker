import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Base path must match Flask serving route /loan/app/
  base: '/loan/app/',

  build: {
    // Build directly into the Flask static folder
    outDir: '../ai_engine/static/loan_app',
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    // Proxy API calls to Flask during development
    proxy: {
      '/loan':        'http://localhost:5000',
      '/verify':      'http://localhost:5000',
      '/check-image': 'http://localhost:5000',
      '/db-status':   'http://localhost:5000',
      '/mongodb-images': 'http://localhost:5000',
    },
  },
})

