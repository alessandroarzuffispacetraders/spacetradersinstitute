import { useEffect, useRef, useState } from 'react'
import Player from '@vimeo/player'
import { parseVimeo } from '../../lib/vimeo'
import { useAuth } from '../../context/AuthContext'

// Native Vimeo player via SDK (@vimeo/player). L'SDK crea l'iframe DENTRO il
// container che React gestisce: così destroy() rimuove solo l'iframe iniettato
// (non gestito da React), evitando conflitti di unmount al cambio lezione.
//
// Se la pagina passa startAt / onProgress / onEnded, l'SDK:
//  - riprende dall'ultimo punto (startAt)
//  - salva la posizione durante la riproduzione (onProgress, throttle 10s + pause + uscita)
//  - segna la lezione completata a fine video (onEnded)
// Senza quei prop (es. video di benvenuto) fa solo da player.
//
// WATERMARK forense: un codice legato all'utente (email) viene sovrapposto al
// video, si sposta e riappare in punti diversi. Se qualcuno registra lo schermo
// e ripubblica, il leak è tracciabile fino all'account. NB: è un deterrente
// lato client (un utente tecnico può rimuoverlo da DevTools); la protezione
// definitiva contro la condivisione del LINK è la privacy per dominio su Vimeo.
export default function VimeoPlayer({
  vimeoId,
  accent,
  startAt = 0,
  onProgress,
  onEnded,
}: {
  vimeoId: string | null
  accent: string
  startAt?: number
  onProgress?: (seconds: number) => void
  onEnded?: () => void
}) {
  const ref = parseVimeo(vimeoId)
  // Tipizzato come template literal per combaciare con VimeoUrl dell'SDK.
  const videoUrl: `https://vimeo.com/${string}` | null = ref
    ? (ref.hash ? `https://vimeo.com/${ref.id}/${ref.hash}` : `https://vimeo.com/${ref.id}`)
    : null

  const { user } = useAuth()
  const watermark = user ? (user.email || user.id) : ''

  const containerRef = useRef<HTMLDivElement>(null)
  // Ref ai callback così l'effetto non si ri-aggancia a ogni render.
  const onProgressRef = useRef(onProgress)
  const onEndedRef = useRef(onEnded)
  onProgressRef.current = onProgress
  onEndedRef.current = onEnded

  // Rapporto d'aspetto reale del video (letto dall'SDK): la cornice ci si adatta
  // così il video la riempie senza bande nere (default 16:9 finché non si sa).
  const [aspect, setAspect] = useState('16 / 9')

  // Posizione + visibilità del watermark: cambia ciclicamente.
  const [wm, setWm] = useState<{ top: string; left: string; on: boolean }>({ top: '8%', left: '8%', on: true })
  useEffect(() => {
    if (!watermark || !videoUrl) return
    let hideT: number
    const cycle = () => {
      const top = 6 + Math.floor(Math.random() * 78)   // 6%..84%
      const left = 5 + Math.floor(Math.random() * 60)  // 5%..65% (lascia spazio al testo)
      setWm({ top: `${top}%`, left: `${left}%`, on: true })
      hideT = window.setTimeout(() => setWm(p => ({ ...p, on: false })), 4200)
    }
    cycle()
    const iv = window.setInterval(cycle, 6800)
    return () => { window.clearInterval(iv); window.clearTimeout(hideT) }
  }, [watermark, videoUrl])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !videoUrl) return

    let player: Player | null = new Player(container, {
      url: videoUrl, dnt: true, title: false, byline: false, portrait: false,
    })
    // L'iframe iniettato dall'SDK deve riempire il container 16:9.
    const ifr = container.querySelector('iframe')
    if (ifr) {
      Object.assign(ifr.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', border: '0' })
      // Abilita il pulsante schermo intero dei controlli Vimeo.
      ifr.setAttribute('allowfullscreen', '')
      ifr.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media')
    }

    let cancelled = false
    let lastSaved = 0   // ultimo secondo salvato (throttle)
    let latest = 0      // ultimo secondo visto (per salvare all'uscita)
    const save = (s: number) => { latest = s; lastSaved = s; onProgressRef.current?.(s) }

    // Adatta la cornice al rapporto reale del video (niente bande nere).
    Promise.all([player.getVideoWidth(), player.getVideoHeight()])
      .then(([w, h]) => { if (!cancelled && w > 0 && h > 0) setAspect(`${w} / ${h}`) })
      .catch(() => { /* ignore */ })

    // Riprendi dall'ultimo punto (se non è praticamente finito).
    if (startAt > 3) {
      player.getDuration().then(d => {
        if (!cancelled && startAt < d - 15) player?.setCurrentTime(startAt)
      }).catch(() => { /* ignore */ })
    }
    player.on('timeupdate', (data: { seconds: number }) => {
      latest = data.seconds
      if (onProgressRef.current && data.seconds - lastSaved >= 10) save(data.seconds)
    })
    player.on('pause', (data: { seconds: number }) => { if (onProgressRef.current) save(data.seconds) })
    player.on('ended', () => { onEndedRef.current?.() })

    return () => {
      cancelled = true
      // Salva la posizione raggiunta prima di smontare (cambio lezione / uscita).
      if (onProgressRef.current && latest > lastSaved) onProgressRef.current(latest)
      player?.destroy().catch(() => {})
      player = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, startAt])

  if (!videoUrl) {
    return (
      <div
        data-inverted="true"
        className="relative w-full rounded-2xl lg:rounded-3xl overflow-hidden flex items-center justify-center"
        style={{
          aspectRatio: '16/9',
          background: `radial-gradient(ellipse at 20% 30%, ${accent}28 0%, transparent 55%), #07090f`,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Video non ancora disponibile
        </p>
      </div>
    )
  }

  return (
    <div
      className="ist-vimeo-frame relative w-full rounded-2xl lg:rounded-3xl overflow-hidden"
      style={{
        aspectRatio: aspect,
        background: '#000',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
      }}
    >
      {/* Il container dell'SDK NON ha figli React: evita conflitti con l'iframe iniettato. */}
      <div ref={containerRef} className="absolute inset-0" />
      {/* Watermark forense: sibling sovrapposto, non intercetta i click del player. */}
      {watermark && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: wm.top,
            left: wm.left,
            zIndex: 20,
            pointerEvents: 'none',
            userSelect: 'none',
            font: '600 11px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace',
            color: 'rgba(255,255,255,0.30)',
            textShadow: '0 1px 3px rgba(0,0,0,0.7)',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            opacity: wm.on ? 1 : 0,
            transition: 'opacity 1.2s ease, top 1.2s ease, left 1.2s ease',
          }}
        >
          {watermark}
        </div>
      )}
    </div>
  )
}
