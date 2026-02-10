import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { App } from './App'
import '@mantine/core/styles.css'

const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('Missing #app container')
}

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>
)
