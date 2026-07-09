import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppRouter from './router/AppRouter'
import LoginTransition from './components/ui/LoginTransition'
import DownloadAppBanner from './components/ui/DownloadAppBanner'
import { hideNativeSplash, isNativeApp } from './lib/nativeUi'

// Badge di versione VISIBILE nell'app nativa (temporaneo, per diagnosi): serve a
// confermare a colpo d'occhio quale build è installata sul device — evita di
// perdere giri con versioni vecchie non aggiornate dal Play Store. Bumpare a ogni build.
const APP_BUILD = '1.0.16'

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
        {isNativeApp() && (
          <div
            style={{
              position: 'fixed',
              top: 'calc(env(safe-area-inset-top, 0px) + 4px)',
              right: 8,
              zIndex: 2147483647,
              fontSize: 10,
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.45)',
              color: 'rgba(255,255,255,0.72)',
              pointerEvents: 'none',
            }}
          >
            v{APP_BUILD}
          </div>
        )}
      </AuthProvider>
    </ThemeProvider>
  )
}
