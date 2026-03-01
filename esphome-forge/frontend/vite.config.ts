import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Relativer base-path → Assets funktionieren unter jedem Ingress-Prefix
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Im Dev-Modus: API-Requests zum Backend proxyen
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7052',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../frontend-dist',
    emptyOutDir: true,
  },
})
