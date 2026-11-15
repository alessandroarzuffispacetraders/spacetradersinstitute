import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { applyStatusBarTheme } from '../lib/nativeUi'

type Theme = 'dark' | 'light'
interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  // Modalità "cinema": finché almeno una pagina la richiede, l'app è scura
  // anche se l'utente ha scelto il tema chiaro (Videocorsi, Live & Replay).
  enterCinema: () => () => void
}
const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggleTheme: () => {}, enterCinema: () => () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ist-theme') as Theme) ?? 'dark')
  const [cinema, setCinema] = useState(0)
  const effective: Theme = cinema > 0 ? 'dark' : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', effective === 'light')
    root.classList.toggle('dark', effective === 'dark')
    // Pagine "cinema": anche lo sfondo dell'app è nero (niente bande sfumate in fondo).
    root.classList.toggle('cinema-mode', cinema > 0)
    localStorage.setItem('ist-theme', theme)
    // App nativa: mantieni la status bar leggibile sul tema attivo (no-op sul web).
    applyStatusBarTheme(effective)
  }, [theme, effective, cinema])

  const enterCinema = useCallback(() => {
    setCinema(c => c + 1)
    return () => setCinema(c => Math.max(0, c - 1))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === 'dark' ? 'light' : 'dark'), enterCinema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

// Da chiamare nelle pagine "cinema": sempre scure, qualunque sia il tema scelto.
export function useCinemaMode() {
  const { enterCinema } = useTheme()
  useEffect(() => enterCinema(), [enterCinema])
}

// Tono delle IMMAGINI di copertina: segue il tema scelto dall'utente anche nelle
// pagine "cinema" (che restano scure). Col tema chiaro le card usano la versione
// chiara delle copertine, se esiste.
export function useCoverTone(): Theme {
  return useTheme().theme
}
