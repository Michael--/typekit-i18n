import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'node20',
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
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
        /^esbuild$/,
        /^picocolors$/,
        /^tsx(\/.*)?$/,
        /^yaml$/,
      ],
    },
  },
})
