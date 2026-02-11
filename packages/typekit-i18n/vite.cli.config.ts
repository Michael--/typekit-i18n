import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'node20',
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: 'src/codegen/cli.ts',
      formats: ['es'],
      fileName: 'cli',
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        /^node:/,
        /^fast-csv$/,
        /^glob$/,
        /^picocolors$/,
        /^tsx(\/.*)?$/,
        /^yaml$/,
      ],
    },
  },
})
