import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'typekit-i18n',
  description: 'Type-safe i18n toolkit',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [{ text: 'Getting Started', link: '/getting-started' }],
      },
    ],
  },
})
