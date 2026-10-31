import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: the UI runs on :5173 and forwards /api to the FastAPI backend on :8000.
// Build: `npm run build` writes frontend/dist, which FastAPI serves at http://localhost:8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  build: {
    target: 'es2021',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
