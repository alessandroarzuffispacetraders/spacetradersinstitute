import { createContext, useContext, useState, type ReactNode } from 'react'
import type { NavMode } from '../router/navConfig'

const NAV_MODE_KEY = 'ist-nav-mode'

interface UICtx {
  hideBottomNav: boolean
  setHideBottomNav: (v: boolean) => void
  profileOpen: boolean
  setProfileOpen: (v: boolean) => void
  navMode: NavMode
  setNavMode: (v: NavMode) => void
}

const UIContext = createContext<UICtx>({
  hideBottomNav: false,
  setHideBottomNav: () => {},
  profileOpen: false,
  setProfileOpen: () => {},
  navMode: 'use',
  setNavMode: () => {},
})

export function UIProvider({ children }: { children: ReactNode }) {
  const [hideBottomNav, setHideBottomNav] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [navMode, setNavModeState] = useState<NavMode>(() => {
    try {
      return localStorage.getItem(NAV_MODE_KEY) === 'manage' ? 'manage' : 'use'
    } catch {
      return 'use'
    }
  })

  const setNavMode = (v: NavMode) => {
    setNavModeState(v)
    try { localStorage.setItem(NAV_MODE_KEY, v) } catch { /* ignore */ }
  }

  return (
    <UIContext.Provider value={{ hideBottomNav, setHideBottomNav, profileOpen, setProfileOpen, navMode, setNavMode }}>
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)

// True se l'utente ha già scelto manualmente una modalità (per impostare il default staff una volta sola)
export function hasStoredNavMode(): boolean {
  try { return localStorage.getItem(NAV_MODE_KEY) != null } catch { return false }
}
