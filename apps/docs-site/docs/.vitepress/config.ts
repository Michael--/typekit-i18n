import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const thisFilePath = fileURLToPath(import.meta.url)
const thisDirPath = dirname(thisFilePath)
const workspaceRoot = resolve(thisDirPath, '../../../..')
const playgroundGeneratedPath = resolve(thisDirPath, '../../../playground-ts/generated')

const envBase = process.env.DOCS_BASE_PATH ?? '/'
const normalizedBase = envBase.endsWith('/') ? envBase : `${envBase}/`

const PROD_HOSTNAME = 'https://michael--.github.io'
const PROD_URL = `${PROD_HOSTNAME}${normalizedBase}`

export default withMermaid(
  defineConfig({
    title: 'typekit-i18n',
    description: 'Type-safe i18n toolkit for TypeScript with runtime, ICU, and codegen',
    base: normalizedBase,
    vite: {
      ssr: { noExternal: ['mermaid'] },
      optimizeDeps: { include: ['mermaid'] },
      resolve: {
        alias: {
          '@playground-gen': playgroundGeneratedPath,
        },
      },
      server: {
        fs: {
          allow: [workspaceRoot],
        },
      },
    },
    markdown: {
      // @ts-expect-error VitePress supports this, but TS picks wrong types
      mermaid: true,
      math: false,
    },
    mermaid: {
      flowchart: { htmlLabels: true },
      themeVariables: {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '16px',
      },
    },
    cleanUrls: true,
    sitemap: {
      hostname: PROD_HOSTNAME,
    },
    head: [
      ['meta', { name: 'robots', content: 'index, follow' }],
      ['meta', { name: 'author', content: 'number10' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: 'typekit-i18n' }],
      ['meta', { property: 'og:title', content: 'typekit-i18n' }],
      [
        'meta',
        {
          property: 'og:description',
          content: 'Type-safe i18n toolkit for TypeScript with runtime, ICU, and codegen',
        },
      ],
      ['meta', { property: 'og:url', content: PROD_URL }],
      ['meta', { name: 'twitter:card', content: 'summary' }],
      ['meta', { name: 'twitter:title', content: 'typekit-i18n' }],
      [
        'meta',
        {
          name: 'twitter:description',
          content: 'Type-safe i18n toolkit for TypeScript with runtime, ICU, and codegen',
        },
      ],
    ],
    themeConfig: {
      nav: [
        { text: 'Guide', link: '/getting-started' },
        { text: 'VSCode Extension', link: '/vscode-extension' },
        { text: 'Runtime API', link: '/runtime-api' },
        { text: 'Runtime Playground', link: '/runtime-playground' },
        { text: 'Codegen + CLI', link: '/codegen-cli' },
        { text: 'Native Targets', link: '/native-targets' },
        { text: 'Resource Formats', link: '/resource-formats' },
        { text: 'GitHub Pages', link: '/github-pages' },
        { text: 'GitHub', link: 'https://github.com/Michael--/typekit-i18n' },
        { text: 'npm', link: 'https://www.npmjs.com/package/@number10/typekit-i18n' },
      ],
      sidebar: [
        {
          text: 'Guide',
          items: [
            { text: 'Overview', link: '/' },
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'VSCode Extension', link: '/vscode-extension' },
            { text: 'Runtime Playground', link: '/runtime-playground' },
            { text: 'Translation Strategy', link: '/translation-strategy' },
            { text: 'GitHub Pages', link: '/github-pages' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Runtime API', link: '/runtime-api' },
            { text: 'Codegen + CLI', link: '/codegen-cli' },
            { text: 'Native Targets', link: '/native-targets' },
            { text: 'Resource Formats', link: '/resource-formats' },
          ],
        },
      ],
    },
  })
)
