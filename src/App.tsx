import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppRouter from './router/AppRouter'
import LoginTransition from './components/ui/LoginTransition'
import { hideNativeSplash } from './lib/nativeUi'

export default function App() {
  // Nell'app nativa: la UI è montata → dissolvi lo splash (no-op sul web).
  useEffect(() => { hideNativeSplash() }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
        <LoginTransition />
      </AuthProvider>
    </ThemeProvider>
  )
}
