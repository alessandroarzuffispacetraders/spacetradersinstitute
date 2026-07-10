import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppRouter from './router/AppRouter'
import LoginTransition from './components/ui/LoginTransition'
import DownloadAppBanner from './components/ui/DownloadAppBanner'
import { hideNativeSplash, isNativeApp } from './lib/nativeUi'

// Badge di versione VISIBILE nell'app nativa: conferma a colpo d'occhio quale build
// è installata sul device — evita di perdere giri con versioni vecchie non aggiornate
// dal Play Store. Bumpare a ogni build. (Il readout diagnostico tastiera/inset è stato
// rimosso: la barra chat è a posto, misura confermata sul device.)
const APP_BUILD = '1.0.23'

export default function App() {
  // Nell'app nativa: la UI è montata → dissolvi lo splash (no-op sul web).
  useEffect(() => { hideNativeSplash() }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
        <LoginTransition />
        {/* Invito a scaricare l'app nativa: solo sul web (login incluso), mai
            dentro l'app. Si auto-nasconde se manca VITE_IOS_APP_URL. */}
        <DownloadAppBanner />
        {isNativeApp() && <VersionBadge />}
      </AuthProvider>
    </ThemeProvider>
  )
}

function VersionBadge() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 4px)',
        right: 8,
        zIndex: 2147483647,
        fontSize: 11,
        lineHeight: 1,
        fontWeight: 700,
        padding: '3px 6px',
        borderRadius: 6,
        background: 'rgba(0,0,0,0.5)',
        color: 'rgba(255,255,255,0.8)',
        pointerEvents: 'none',
      }}
    >
      v{APP_BUILD}
    </div>
  )
}
