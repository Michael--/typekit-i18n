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
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(thisDirPath, 'src/index.ts'),
      name: 'TypekitI18n',
      formats: ['es'],
      fileName: 'index',
    },
  },
})
