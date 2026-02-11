import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const envBase = process.env.DOCS_BASE_PATH ?? '/'
const normalizedBase = envBase.endsWith('/') ? envBase : `${envBase}/`

export default withMermaid(
  defineConfig({
    title: 'typekit-i18n',
    description: 'Type-safe i18n toolkit for TypeScript with runtime, ICU, and codegen',
    base: normalizedBase,
    vite: {
      ssr: { noExternal: ['mermaid'] },
      optimizeDeps: { include: ['mermaid'] },
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
    themeConfig: {
      nav: [
        { text: 'Guide', link: '/getting-started' },
        { text: 'Runtime API', link: '/runtime-api' },
        { text: 'Codegen + CLI', link: '/codegen-cli' },
        { text: 'Resource Formats', link: '/resource-formats' },
        { text: 'GitHub Pages', link: '/github-pages' },
      ],
      sidebar: [
        {
          text: 'Guide',
          items: [
            { text: 'Overview', link: '/' },
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'Translation Strategy', link: '/translation-strategy' },
            { text: 'GitHub Pages', link: '/github-pages' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Runtime API', link: '/runtime-api' },
            { text: 'Codegen + CLI', link: '/codegen-cli' },
            { text: 'Resource Formats', link: '/resource-formats' },
          ],
        },
      ],
    },
  })
)
