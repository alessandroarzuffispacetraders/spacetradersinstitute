import { useEffect, useRef } from 'react'
import Player from '@vimeo/player'
import { parseVimeo } from '../../lib/vimeo'

// Native Vimeo player via SDK (@vimeo/player). L'SDK crea l'iframe DENTRO il
// container che React gestisce: così destroy() rimuove solo l'iframe iniettato
// (non gestito da React), evitando conflitti di unmount al cambio lezione.
//
// Se la pagina passa startAt / onProgress / onEnded, l'SDK:
//  - riprende dall'ultimo punto (startAt)
//  - salva la posizione durante la riproduzione (onProgress, throttle 10s + pause + uscita)
//  - segna la lezione completata a fine video (onEnded)
// Senza quei prop (es. video di benvenuto) fa solo da player.
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

  const containerRef = useRef<HTMLDivElement>(null)
  // Ref ai callback così l'effetto non si ri-aggancia a ogni render.
  const onProgressRef = useRef(onProgress)
  const onEndedRef = useRef(onEnded)
  onProgressRef.current = onProgress
  onEndedRef.current = onEnded

  useEffect(() => {
    const container = containerRef.current
    if (!container || !videoUrl) return

    let player: Player | null = new Player(container, {
      url: videoUrl, dnt: true, title: false, byline: false, portrait: false,
    })
    // L'iframe iniettato dall'SDK deve riempire il container 16:9.
    const ifr = container.querySelector('iframe')
    if (ifr) Object.assign(ifr.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', border: '0' })

    let cancelled = false
    let lastSaved = 0   // ultimo secondo salvato (throttle)
    let latest = 0      // ultimo secondo visto (per salvare all'uscita)
    const save = (s: number) => { latest = s; lastSaved = s; onProgressRef.current?.(s) }

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
      ref={containerRef}
      className="relative w-full rounded-2xl lg:rounded-3xl overflow-hidden"
      style={{
        aspectRatio: '16/9',
        background: '#000',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
      }}
    />
  )
}
