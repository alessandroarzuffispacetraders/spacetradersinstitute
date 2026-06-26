import { createContext, useContext, useState, type ReactNode } from 'react'

interface UICtx {
  hideBottomNav: boolean
  setHideBottomNav: (v: boolean) => void
  profileOpen: boolean
  setProfileOpen: (v: boolean) => void
}

const UIContext = createContext<UICtx>({
  hideBottomNav: false,
  setHideBottomNav: () => {},
  profileOpen: false,
  setProfileOpen: () => {},
})

export function UIProvider({ children }: { children: ReactNode }) {
  const [hideBottomNav, setHideBottomNav] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  return (
    <UIContext.Provider value={{ hideBottomNav, setHideBottomNav, profileOpen, setProfileOpen }}>
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)
