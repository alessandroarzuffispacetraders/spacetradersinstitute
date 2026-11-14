import { ReactNode, useEffect, useRef, useState } from 'react'

// Entrata a cascata delle sezioni della Home: la sezione compare (dissolvenza +
// leggera risalita) la prima volta che entra nello schermo. Con "Riduci
// movimento" attivo resta ferma (vedi .reveal in index.css).
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setShown(true); io.disconnect() }
    }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${shown ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

// Numero che sale da 0 al valore (percentuale del percorso, giorno del programma).
export function useCountUp(target: number, duration = 1200): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || target <= 0) { setV(target); return }
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration); const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(target * e)); if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

// Ora corrente aggiornata ogni `ms` (conto alla rovescia della prossima live).
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const iv = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(iv) }, [ms])
  return now
}

// "tra 2g 14h", "tra 5h 32m", "tra 12m 05s"; null se già iniziata.
export function countdownLabel(iso: string | null, now: number): string | null {
  if (!iso) return null
  let s = Math.floor((new Date(iso).getTime() - now) / 1000)
  if (s <= 0) return null
  const d = Math.floor(s / 86400); s -= d * 86400
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60); s -= m * 60
  if (d > 0) return `tra ${d}g ${h}h ${String(m).padStart(2, '0')}m`
  if (h > 0) return `tra ${h}h ${String(m).padStart(2, '0')}m`
  return `tra ${m}m ${String(s).padStart(2, '0')}s`
}
