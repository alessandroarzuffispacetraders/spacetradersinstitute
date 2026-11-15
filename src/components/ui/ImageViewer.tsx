import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react'

// Visore immagini a tutto schermo dentro l'app (chat, bacheca): niente più
// apertura nel browser. Zoom con due dita o doppio tocco/doppio clic,
// trascinamento quando è ingrandita, scorrimento tra le immagini (frecce,
// tastiera, swipe), Esc / tasto indietro per chiudere, salva o condividi.

type Open = (images: string[], index?: number) => void
const Ctx = createContext<Open>(() => {})
export const useImageViewer = () => useContext(Ctx)

export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ images: string[]; index: number } | null>(null)
  const open = useCallback<Open>((images, index = 0) => {
    const list = images.filter(Boolean)
    if (list.length) setState({ images: list, index: Math.max(0, Math.min(index, list.length - 1)) })
  }, [])
  return (
    <Ctx.Provider value={open}>
      {children}
      {state && <Viewer images={state.images} start={state.index} onClose={() => setState(null)} />}
    </Ctx.Provider>
  )
}

// Immagine che si apre nel visore al primo tocco "pulito" (senza trascinare):
// si apre subito, prima che il fumetto mostri la barra delle azioni e si sposti.
export function TapToOpen({ onOpen, className, style, children }: { onOpen: () => void; className?: string; style?: React.CSSProperties; children: ReactNode }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      role="button"
      tabIndex={0}
      className={className}
      style={{ cursor: 'zoom-in', ...style }}
      onPointerDown={e => { start.current = { x: e.clientX, y: e.clientY } }}
      onPointerUp={e => {
        const s = start.current; start.current = null
        if (!s || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) return
        e.stopPropagation(); onOpen()
      }}
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      onTouchEnd={e => { if (e.cancelable) e.preventDefault() }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      {children}
    </div>
  )
}

function Viewer({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragX, setDragX] = useState(0)
  const [busy, setBusy] = useState(false)
  const n = images.length
  const go = useCallback((d: number) => { setI(v => (v + d + n) % n); setScale(1); setPos({ x: 0, y: 0 }) }, [n])

  // Tasto indietro (Android / browser) chiude il visore invece di lasciare la chat.
  const closedByPop = useRef(false)
  // Da telefono il "clic" generato dopo il tocco che apre il visore cadrebbe
  // sullo sfondo appena comparso e lo richiuderebbe: per un attimo lo ignoriamo.
  const openedAt = useRef(Date.now())
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!(window.history.state as { istViewer?: boolean } | null)?.istViewer) window.history.pushState({ istViewer: true }, '')
    const onPop = () => { closedByPop.current = true; onCloseRef.current() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const close = useCallback(() => {
    if (!closedByPop.current && (window.history.state as { istViewer?: boolean } | null)?.istViewer) window.history.back()
    else onCloseRef.current()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' && n > 1) go(1)
      else if (e.key === 'ArrowLeft' && n > 1) go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [close, go, n])

  // Gesti: un dito = sposta (se ingrandita) o scorre tra le immagini; due dita = zoom.
  const g = useRef<{ x: number; y: number; px: number; py: number; d0?: number; s0?: number; t: number; moved: boolean } | null>(null)
  const lastTap = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches
    if (t.length === 2) {
      g.current = { x: 0, y: 0, px: pos.x, py: pos.y, d0: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), s0: scale, t: Date.now(), moved: true }
    } else {
      g.current = { x: t[0].clientX, y: t[0].clientY, px: pos.x, py: pos.y, t: Date.now(), moved: false }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const s = g.current; if (!s) return
    const t = e.touches
    if (t.length === 2 && s.d0) {
      const d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
      setScale(Math.max(1, Math.min(4, (s.s0 ?? 1) * d / s.d0)))
      return
    }
    const dx = t[0].clientX - s.x, dy = t[0].clientY - s.y
    if (Math.hypot(dx, dy) > 6) s.moved = true
    if (scale > 1) setPos({ x: s.px + dx, y: s.py + dy })
    else if (n > 1) setDragX(dx)
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = g.current; g.current = null
    if (!s) return
    if (scale <= 1.02) { setScale(1); setPos({ x: 0, y: 0 }) }
    if (dragX && n > 1) { if (Math.abs(dragX) > 60) go(dragX < 0 ? 1 : -1); setDragX(0); return }
    if (!s.moved && e.changedTouches.length === 1) {
      // Il doppio tocco lo gestiamo qui: niente clic/doppio clic "finti" dopo,
      // che rifarebbero lo zoom al contrario.
      if (e.cancelable) e.preventDefault()
      const now = Date.now()
      if (now - lastTap.current < 280) { toggleZoom(); lastTap.current = 0 } else lastTap.current = now
    }
  }
  const toggleZoom = () => { if (scale > 1) { setScale(1); setPos({ x: 0, y: 0 }) } else setScale(2.2) }

  // Trascinamento col mouse quando è ingrandita (desktop).
  const m = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const url = images[i]
  const save = async (share: boolean) => {
    setBusy(true)
    try {
      const blob = await (await fetch(url)).blob()
      const name = `ist-immagine-${i + 1}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`
      const file = new File([blob], name, { type: blob.type || 'image/jpeg' })
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
      if (share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file] }).catch(() => {}); return }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
      document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch {
      window.open(url, '_blank', 'noopener')
    } finally { setBusy(false) }
  }
  const canShare = typeof navigator !== 'undefined' && 'canShare' in navigator

  const btn = 'w-11 h-11 rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/20 disabled:opacity-50'
  const btnStyle = { background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)' }

  return createPortal(
    <div className="image-viewer fixed inset-0 z-[300] flex flex-col select-none" style={{ background: 'rgba(3,5,10,0.94)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }} role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-2 px-3 flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)', paddingBottom: 10 }}>
        <span className="text-sm font-semibold tabular-nums text-white/80 pl-2">{n > 1 ? `${i + 1} / ${n}` : ''}</span>
        <div className="flex items-center gap-2">
          {canShare && <button onClick={() => save(true)} disabled={busy} className={btn} style={btnStyle} aria-label="Condividi"><Share2 size={18} /></button>}
          <button onClick={() => save(false)} disabled={busy} className={btn} style={btnStyle} aria-label="Salva"><Download size={18} /></button>
          <button onClick={close} className={btn} style={btnStyle} aria-label="Chiudi"><X size={20} /></button>
        </div>
      </div>

      <div
        className="relative flex-1 overflow-hidden flex items-center justify-center"
        onClick={e => { if (e.target === e.currentTarget && scale === 1 && Date.now() - openedAt.current > 450) close() }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          onDoubleClick={toggleZoom}
          onMouseDown={e => { if (scale > 1) m.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y } }}
          onMouseMove={e => { const s = m.current; if (s) setPos({ x: s.px + e.clientX - s.x, y: s.py + e.clientY - s.y }) }}
          onMouseUp={() => { m.current = null }}
          onMouseLeave={() => { m.current = null }}
          className="image-viewer-img max-w-full max-h-full object-contain"
          style={{
            transform: `translate(${pos.x + dragX}px, ${pos.y}px) scale(${scale})`,
            transition: g.current || m.current || dragX ? 'none' : 'transform 220ms cubic-bezier(.2,.7,.2,1)',
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
        />
        {n > 1 && (
          <>
            <button onClick={() => go(-1)} className={`${btn} absolute left-3 top-1/2 -translate-y-1/2 hidden sm:flex`} style={btnStyle} aria-label="Precedente"><ChevronLeft size={22} /></button>
            <button onClick={() => go(1)} className={`${btn} absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex`} style={btnStyle} aria-label="Successiva"><ChevronRight size={22} /></button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="flex justify-center gap-1.5 flex-shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', paddingTop: 10 }}>
          {images.map((_, k) => (
            <button key={k} onClick={() => { setI(k); setScale(1); setPos({ x: 0, y: 0 }) }} className="h-1.5 rounded-full transition-all" style={{ width: k === i ? 22 : 8, background: k === i ? '#fff' : 'rgba(255,255,255,0.35)' }} aria-label={`Immagine ${k + 1}`} />
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
