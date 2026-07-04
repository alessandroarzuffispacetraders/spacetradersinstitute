import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { applyStatusBarTheme } from '../lib/nativeUi'

type Theme = 'dark' | 'light'
interface ThemeContextValue { theme: Theme; toggleTheme: () => void }
const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ist-theme') as Theme) ?? 'dark')

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', theme === 'light')
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('ist-theme', theme)
    // App nativa: mantieni la status bar leggibile sul tema attivo (no-op sul web).
    applyStatusBarTheme(theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
