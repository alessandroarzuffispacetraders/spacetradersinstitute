import { useEffect, useState } from 'react'

// Valore STABILE di safe-area-inset-bottom (px). Su WKWebView iOS `env(safe-area-
// inset-bottom)` ogni tanto sfarfalla a 0 durante i relayout (chiusura tastiera,
// ritorno in foreground): usato direttamente nel CSS farebbe "ricadere" la barra
// di scrittura in fondo. Lo misuriamo con una sonda e teniamo il MASSIMO osservato,
// così non torna mai a 0. Web/desktop senza safe-area → resta 0 (nessun effetto).
export function useStableSafeAreaBottom(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)'
    document.body.appendChild(probe)
    let maxSeen = 0
    const measure = () => {
      const v = parseFloat(getComputedStyle(probe).paddingBottom) || 0
      if (v > maxSeen + 0.5) { maxSeen = v; setInset(v) }
    }
    measure()
    // Ri-misura per qualche secondo all'avvio + sugli eventi di relayout: cattura
    // il valore "vero" anche se al primo frame non è ancora applicato.
    const iv = setInterval(measure, 400)
    const stop = setTimeout(() => clearInterval(iv), 4000)
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      clearInterval(iv); clearTimeout(stop)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      probe.remove()
    }
  }, [])
  return inset
}
