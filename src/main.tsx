import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyLangOnBoot } from './lib/langSwitch'
import { registerSW } from 'virtual:pwa-register'
import './index.css'

// Service worker (vite-plugin-pwa): mở app khi mất sóng; bản mới tự thay ở lần tải sau.
registerSW({ immediate: true })

if (!applyLangOnBoot()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
