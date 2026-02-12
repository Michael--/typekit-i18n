import { builtinModules } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const thisFilePath = fileURLToPath(import.meta.url)
const thisDirPath = dirname(thisFilePath)

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'node20',
    lib: {
      entry: resolve(thisDirPath, 'src/extension.ts'),
      formats: ['cjs'],
      fileName: () => 'extension.cjs',
    },
    rollupOptions: {
      external: ['vscode', ...builtinModules, /^node:/],
      output: {
        exports: 'named',
      },
    },
  },
})
