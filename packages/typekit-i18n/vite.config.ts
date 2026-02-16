import { builtinModules } from 'node:module'
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
    sourcemap: false,
    target: 'es2022',
    lib: {
      entry: {
        index: resolve(thisDirPath, 'src/index.ts'),
        runtime: resolve(thisDirPath, 'src/runtime/index.ts'),
        'runtime-basic': resolve(thisDirPath, 'src/runtime/basic.ts'),
        'runtime-icu': resolve(thisDirPath, 'src/runtime/icu.ts'),
        'runtime-icu-formatjs': resolve(thisDirPath, 'src/runtime/icuFormatjs.ts'),
        codegen: resolve(thisDirPath, 'src/codegen/index.ts'),
      },
      formats: ['es'],
      fileName: (_, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        /^node:/,
        /^fast-csv$/,
        /^glob$/,
        /^esbuild$/,
        /^picocolors$/,
        /^intl-messageformat$/,
        /^tsx(\/.*)?$/,
        /^yaml$/,
      ],
      output: {
        chunkFileNames: '[name].js',
      },
    },
  },
})
