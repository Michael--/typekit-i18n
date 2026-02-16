import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import RuntimePlaygroundDemo from './components/RuntimePlaygroundDemo.vue'
import './custom.css'

/**
 * VitePress theme extension that registers custom documentation components.
 */
const theme: Theme = {
  ...DefaultTheme,
  enhanceApp(context) {
    DefaultTheme.enhanceApp?.(context)
    context.app.component('RuntimePlaygroundDemo', RuntimePlaygroundDemo)
  },
}

export default theme
