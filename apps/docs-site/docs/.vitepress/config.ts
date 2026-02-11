import { defineConfig } from 'vitepress'

const envBase = process.env.DOCS_BASE_PATH ?? '/'
const normalizedBase = envBase.endsWith('/') ? envBase : `${envBase}/`

export default defineConfig({
  title: 'typekit-i18n',
  description: 'Type-safe i18n toolkit for TypeScript',
  base: normalizedBase,
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Runtime API', link: '/runtime-api' },
      { text: 'Codegen + CLI', link: '/codegen-cli' },
      { text: 'Resource Formats', link: '/resource-formats' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
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
