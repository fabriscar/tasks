import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/caveat'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { startSync } from './core/syncController'

registerSW({ immediate: true })
startSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
