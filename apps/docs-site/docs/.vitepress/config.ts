import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type HeadConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const thisFilePath = fileURLToPath(import.meta.url)
const thisDirPath = dirname(thisFilePath)
const workspaceRoot = resolve(thisDirPath, '../../../..')
const playgroundGeneratedPath = resolve(thisDirPath, '../../../playground-ts/generated')

const pkgPath = resolve(thisDirPath, '../../package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }

const envBase = process.env.DOCS_BASE_PATH ?? '/'
const normalizedBase = envBase.endsWith('/') ? envBase : `${envBase}/`

const PROD_HOSTNAME = 'https://typekit-i18n.number10.de'
const PROD_URL = `${PROD_HOSTNAME}${normalizedBase}`
const OG_IMAGE_URL = `${PROD_URL}og-image.svg`

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
      hostname: PROD_URL,
    },
    head: [
      ['meta', { name: 'robots', content: 'index, follow' }],
      [
        'meta',
        {
          name: 'google-site-verification',
          content: 'TZwaz1pFYKmSmNj3FBsCZC-9JdSHvmp83ZBR1qthnrk',
        },
      ],
      ['meta', { name: 'author', content: 'number10' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: 'typekit-i18n' }],
      ['meta', { property: 'og:image', content: OG_IMAGE_URL }],
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
    transformHead(context): HeadConfig[] {
      const { pageData } = context
      const is404 = pageData.frontmatter.layout === '404' || pageData.relativePath === '404.md'

      if (is404) {
        return [['meta', { name: 'robots', content: 'noindex' }]]
      }

      const relPath = pageData.relativePath.replace(/\.md$/, '')
      const isHome = relPath === 'index'
      const pagePath = isHome || relPath === '404' ? '' : relPath
      const pageUrl = pagePath ? `${PROD_HOSTNAME}${normalizedBase}${pagePath}` : PROD_URL

      const head: HeadConfig[] = []

      // canonical
      head.push(['link', { rel: 'canonical', href: pageUrl }])

      // og:title — match <title> tag; home page has no site suffix
      const ogTitle = isHome ? pageData.title : `${pageData.title} | typekit-i18n`
      head.push(['meta', { property: 'og:title', content: ogTitle }])

      // og:description — match <meta name="description">
      const pageDesc = pageData.description
      if (pageDesc) {
        head.push(['meta', { property: 'og:description', content: pageDesc }])
      }

      // og:url
      head.push(['meta', { property: 'og:url', content: pageUrl }])

      return head
    },
    themeConfig: {
      siteTitle: `typekit-i18n (v${pkg.version})`,
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
