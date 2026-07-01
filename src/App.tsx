import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppRouter from './router/AppRouter'
import LoginTransition from './components/ui/LoginTransition'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
        <LoginTransition />
      </AuthProvider>
    </ThemeProvider>
  )
}
