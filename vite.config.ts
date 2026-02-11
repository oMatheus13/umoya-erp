import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        pdv: fileURLToPath(new URL('pdv/index.html', import.meta.url)),
        rastreio: fileURLToPath(new URL('rastreio/index.html', import.meta.url)),
      },
    },
  },
})
