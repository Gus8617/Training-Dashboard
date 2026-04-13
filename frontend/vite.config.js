import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dès que le front appelle quelque chose qui commence par /api
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Dès que le front appelle quelque chose qui commence par /auth
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})