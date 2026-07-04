import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppRouter from './router/AppRouter'
import LoginTransition from './components/ui/LoginTransition'
import DownloadAppBanner from './components/ui/DownloadAppBanner'
import { hideNativeSplash } from './lib/nativeUi'

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
      </AuthProvider>
    </ThemeProvider>
  )
}
