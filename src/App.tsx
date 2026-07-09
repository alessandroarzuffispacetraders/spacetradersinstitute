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
const APP_BUILD = '1.0.21'

// DIAGNOSTICA TEMPORANEA (solo per capire il comportamento tastiera/inset sul device
// reale, che l'emulatore non riproduce): stampa nel badge i numeri chiave.
//   iH = window.innerHeight  → se CALA aprendo la tastiera, il WebView si RIDIMENSIONA
//        (allora `fixed inset-0` è corretto). Se resta uguale, NON si ridimensiona.
//   vv = visualViewport.height → cosa "vede" VisualViewport (usato dal ramo iOS/PWA).
//   kb = altezza tastiera riportata dal plugin nativo (0 = il plugin NON la riporta).
//   f  = c'è un campo di testo FOCALIZZATO (1) o no (0). È il proxy di vp.kbOpen, che
//        guida keyboardOpen (=vp.kbOpen||nativeKb). Se a TASTIERA CHIUSA risulta f=1 o
//        kb>0, keyboardOpen è "incastrato" true → il composer usa il ramo 8px (aperto)
//        e finisce sotto la nav bar: quello è il bug, NON i pixel troppo pochi.
//   sat/sab = valore REALE (px) di env(safe-area-inset-top/bottom), misurato con una
//        sonda. sab>0 → il WebView consegna l'inset della nav bar alla CSS → il fix
//        adattivo con env() funziona. sab=0 → env è morto sotto (limite Capacitor
//        Android) → serve un fisso o l'inset nativo. sat>0 con sab=0 = consegna solo
//        il top → conferma che è specificamente il bottom a non arrivare.
// Con UNO screenshot sappiamo con certezza cosa fare invece di indovinare. Da rimuovere
// una volta chiuso il tuning della barra chat.
function readSafeArea(side: 'top' | 'bottom'): number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;left:0;width:0;height:env(safe-area-inset-${side},0px);visibility:hidden;pointer-events:none`
  document.body.appendChild(probe)
  const h = Math.round(probe.getBoundingClientRect().height)
  document.body.removeChild(probe)
  return h
}
function useViewportDiag() {
  const [d, setD] = useState({ iH: 0, vv: 0, kb: 0, f: 0, sat: 0, sab: 0 })
  useEffect(() => {
    const focused = () => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return 0
      return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable ? 1 : 0
    }
    const upd = (kb?: number) => setD(prev => ({
      iH: Math.round(window.innerHeight),
      vv: Math.round(window.visualViewport?.height ?? 0),
      kb: kb ?? prev.kb,
      f: focused(),
      sat: readSafeArea('top'),
      sab: readSafeArea('bottom'),
    }))
    upd(0)
    const onResize = () => upd()
    // focusout aggiorna activeElement in modo asincrono → rileggo al prossimo tick.
    const onFocus = () => setTimeout(() => upd(), 0)
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onFocus)
    const subs: Array<{ remove: () => void }> = []
    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener('keyboardWillShow', (i) => upd(Math.round(i.keyboardHeight))).then(s => subs.push(s))
      Keyboard.addListener('keyboardDidShow', (i) => upd(Math.round(i.keyboardHeight))).then(s => subs.push(s))
      Keyboard.addListener('keyboardWillHide', () => upd(0)).then(s => subs.push(s))
      Keyboard.addListener('keyboardDidHide', () => upd(0)).then(s => subs.push(s))
    }
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onFocus)
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
      <div style={{ fontSize: 10, opacity: 0.85 }}>iH{d.iH} vv{d.vv} kb{d.kb} f{d.f}</div>
      <div style={{ fontSize: 10, opacity: 0.85 }}>safe t{d.sat} b{d.sab}</div>
    </div>
  )
}
