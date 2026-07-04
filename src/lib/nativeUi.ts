// Rifiniture native (solo dentro l'app Capacitor): nascondere lo splash quando la
// web app è pronta e sincronizzare la status bar col tema. Sul web ogni funzione
// è un no-op (Capacitor.isNativePlatform() === false), quindi si può chiamare
// sempre senza guardie ai punti di uso.
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNativeApp = () => Capacitor.isNativePlatform()
const isIOS = () => Capacitor.getPlatform() === 'ios'

let overlaySet = false

// Testo della status bar leggibile sul tema corrente:
// tema scuro (sfondo scuro) → testo chiaro (Style.Dark);
// tema chiaro → testo scuro (Style.Light).
export async function applyStatusBarTheme(theme: 'dark' | 'light') {
  if (!isNativeApp()) return
  try {
    // La web app disegna edge-to-edge e gestisce le safe-area via env():
    // la status bar deve sovrapporsi al webview (una volta sola).
    if (isIOS() && !overlaySet) {
      await StatusBar.setOverlaysWebView({ overlay: true })
      overlaySet = true
    }
    await StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark })
  } catch {
    /* status bar non disponibile su questa piattaforma */
  }
}

// Chiamata quando React ha montato la UI: dissolve lo splash nativo.
export async function hideNativeSplash() {
  if (!isNativeApp()) return
  try {
    await SplashScreen.hide({ fadeOutDuration: 250 })
  } catch {
    /* splash già nascosto o plugin non disponibile */
  }
}
