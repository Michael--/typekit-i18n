import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const thisFilePath = fileURLToPath(import.meta.url)
const thisDirPath = dirname(thisFilePath)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@gen': resolve(thisDirPath, 'generated'),
    },
  },
  server: {
    port: 4173,
  },
})
