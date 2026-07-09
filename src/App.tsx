import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppRouter from './router/AppRouter'
import LoginTransition from './components/ui/LoginTransition'
import DownloadAppBanner from './components/ui/DownloadAppBanner'
import { hideNativeSplash, isNativeApp } from './lib/nativeUi'

// Badge di versione VISIBILE nell'app nativa (temporaneo, per diagnosi): serve a
// confermare a colpo d'occhio quale build è installata sul device — evita di
// perdere giri con versioni vecchie non aggiornate dal Play Store. Bumpare a ogni build.
const APP_BUILD = '1.0.19'

// DIAGNOSTICA TEMPORANEA (solo per capire il comportamento tastiera/inset sul device
// reale, che l'emulatore non riproduce): stampa nel badge i numeri chiave.
//   iH = window.innerHeight  → se CALA aprendo la tastiera, il WebView si RIDIMENSIONA
//        (allora `fixed inset-0` è corretto). Se resta uguale, NON si ridimensiona.
//   vv = visualViewport.height → cosa "vede" VisualViewport (usato dal ramo iOS/PWA).
//   kb = altezza tastiera riportata dal plugin nativo (0 = il plugin NON la riporta).
// Con UNO screenshot (tastiera aperta) sappiamo con certezza quale ramo serve, invece
// di indovinare. Da rimuovere una volta chiuso il tuning della barra chat.
function useViewportDiag() {
  const [d, setD] = useState({ iH: 0, vv: 0, kb: 0 })
  useEffect(() => {
    const upd = (kb?: number) => setD(prev => ({
      iH: Math.round(window.innerHeight),
      vv: Math.round(window.visualViewport?.height ?? 0),
      kb: kb ?? prev.kb,
    }))
    upd(0)
    const onResize = () => upd()
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    const subs: Array<{ remove: () => void }> = []
    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener('keyboardWillShow', (i) => upd(Math.round(i.keyboardHeight))).then(s => subs.push(s))
      Keyboard.addListener('keyboardDidShow', (i) => upd(Math.round(i.keyboardHeight))).then(s => subs.push(s))
      Keyboard.addListener('keyboardWillHide', () => upd(0)).then(s => subs.push(s))
    }
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      subs.forEach(s => s?.remove?.())
    }
  }, [])
  return d
}

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
  const d = useViewportDiag()
  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 4px)',
        right: 8,
        zIndex: 2147483647,
        fontSize: 11,
        lineHeight: 1.25,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        padding: '3px 6px',
        borderRadius: 6,
        background: 'rgba(0,0,0,0.62)',
        color: 'rgba(255,255,255,0.92)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700 }}>v{APP_BUILD}</div>
      <div style={{ fontSize: 10, opacity: 0.85 }}>iH{d.iH} vv{d.vv} kb{d.kb}</div>
    </div>
  )
}
