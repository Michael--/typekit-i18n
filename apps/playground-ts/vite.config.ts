import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const thisFilePath = fileURLToPath(import.meta.url)
const thisDirPath = dirname(thisFilePath)

export default defineConfig({
  resolve: {
    alias: {
      '@gen': resolve(thisDirPath, 'generated'),
    },
  },
  server: {
    port: 4173,
  },
})
