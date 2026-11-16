import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react'
          }
          if (id.includes('node_modules/react-router')) {
            return 'router'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons'
          }
          return undefined
        },
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/server/**'],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
