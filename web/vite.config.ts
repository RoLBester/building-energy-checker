import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/building-energy-checker/',
  plugins: [react()],
  build: { license: { fileName: 'licenses.md' } },
  worker: { format: 'es' },
})
