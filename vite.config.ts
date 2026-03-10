import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@ui': path.resolve(__dirname, './ui'),
      '@erp': path.resolve(__dirname, './apps/erp'),
      '@pdv': path.resolve(__dirname, './apps/pdv'),
      '@pop': path.resolve(__dirname, './apps/pop'),
      '@ptc': path.resolve(__dirname, './apps/ptc'),
      '@pas': path.resolve(__dirname, './apps/pas'),
      '@rastreio': path.resolve(__dirname, './apps/rastreio'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        pdv: fileURLToPath(new URL('pdv/index.html', import.meta.url)),
        rastreio: fileURLToPath(new URL('rastreio/index.html', import.meta.url)),
        pop: fileURLToPath(new URL('pop/index.html', import.meta.url)),
        ptc: fileURLToPath(new URL('ptc/index.html', import.meta.url)),
        pas: fileURLToPath(new URL('pas/index.html', import.meta.url)),
      },
    },
  },
})
