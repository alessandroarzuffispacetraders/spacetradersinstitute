import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// Fa combaciare il contenitore della chat con l'AREA REALMENTE VISIBILE quando
// la tastiera è aperta, così la barra di scrittura resta appena sopra la tastiera.
// `kbOpen` è rilevato dal FOCUS su un campo di testo: nella PWA standalone iOS il
// webview si ridimensiona insieme alla tastiera (innerHeight cala con lei), quindi
// confrontare le altezze non basta — un input a fuoco = tastiera su. Le misure
// top/height arrivano da VisualViewport (aggiornate mentre la tastiera anima).
export function useVisibleViewport() {
  const [vp, setVp] = useState<{ top: number; height: number; kbOpen: boolean } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    let focused = false
    const isEditable = (el: EventTarget | null): boolean => {
      const n = el as HTMLElement | null
      return !!n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable)
    }
    const measure = () => setVp({
      top: vv ? Math.round(vv.offsetTop) : 0,
      height: vv ? Math.round(vv.height) : window.innerHeight,
      kbOpen: focused,
    })
    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target)) return
      focused = true
      measure()
      // ri-misura mentre la tastiera anima (VisualViewport aggiorna con ritardo)
      setTimeout(measure, 120)
      setTimeout(measure, 320)
    }
    const onFocusOut = () => { focused = false; measure() }
    measure()
    vv?.addEventListener('resize', measure)
    vv?.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      vv?.removeEventListener('resize', measure)
      vv?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])
  return vp
}

// Altezza della tastiera NATIVA (app Capacitor). Con Keyboard resize:'none' il
// webview non si ridimensiona e VisualViewport non "vede" la tastiera → l'altezza
// va presa dagli eventi del plugin. Sul web resta 0 (lì si usa VisualViewport).
export function useNativeKeyboardHeight() {
  const [h, setH] = useState(0)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handles: { remove: () => void }[] = []
    Keyboard.addListener('keyboardWillShow', (info) => setH(info.keyboardHeight)).then((l) => handles.push(l))
    Keyboard.addListener('keyboardWillHide', () => setH(0)).then((l) => handles.push(l))
    return () => { handles.forEach((l) => l.remove()) }
  }, [])
  return h
}

// Su Android il resize del WebView è già gestito diversamente: sommare
// keyboardInset lì sopra il gap fisso raddoppierebbe la compensazione (l'input
// schizzerebbe su di ~2× l'altezza tastiera). Su iOS nativo invece il webview
// NON si ridimensiona da solo, va sollevato manualmente di questo valore.
export function nativeKeyboardInset(nativeKbHeight: number): number {
  return Capacitor.getPlatform() === 'android' ? 0 : nativeKbHeight
}
