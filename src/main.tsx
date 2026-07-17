import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'

// Android WebView: backdrop-filter (blur) genera artefatti di compositing
// (bande/fantasmi) su modali e sheet. Marchiamo la piattaforma → il CSS
// disabilita il blur solo qui (iOS/web restano col vetro smerigliato).
if (Capacitor.getPlatform() === 'android') {
  document.documentElement.classList.add('is-android')
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {/* sw non disponibile */})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
