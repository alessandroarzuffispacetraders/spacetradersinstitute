import { ReactNode, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import Player from '@vimeo/player'
import {
  ChevronLeft, Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize,
  SkipForward, Gauge, Loader2,
} from 'lucide-react'
import { parseVimeo } from '../../lib/vimeo'
import { useAuth } from '../../context/AuthContext'

// Player "da cinema" (stile streaming) costruito sopra l'SDK Vimeo con i
// controlli di Vimeo NASCOSTI (controls: false) e controlli nostri:
// barra di avanzamento, ±10s, volume, velocità, schermo intero, "Prossima".
//  - i controlli spariscono dopo 3s mentre il video va (ricompaiono muovendo
//    il mouse o toccando lo schermo)
//  - tastiera: spazio/K play-pausa, ←/→ ±10s, F schermo intero, M muto
//  - touch: tocco = mostra/nasconde i controlli, doppio tocco ai lati = ±10s
//  - schermo intero sul NOSTRO contenitore → il watermark resta visibile
//    (sull'iPhone, che non lo supporta, si ripiega sul fullscreen di Vimeo)
//
// NB: "controls: false" richiede un piano Vimeo a pagamento (Plus o superiore).
// Senza, Vimeo ignora il parametro e mostra anche i suoi controlli.

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const HIDE_AFTER_MS = 3000
const SAVE_EVERY_S = 10
const SEEK_STEP_S = 10

function fmt(total: number): string {
  const s = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

interface TimeData { seconds: number; duration: number; percent: number }

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void }
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void }

export interface CinemaPlayerProps {
  vimeoId: string | null
  title: string
  subtitle?: string
  backLabel?: string
  onBack?: () => void
  startAt?: number
  onProgress?: (seconds: number) => void
  onEnded?: () => void
  nextLabel?: string
  onNext?: () => void
  // Contenuto sovrapposto a fine video (es. conto alla rovescia "Prossima lezione").
  renderEnd?: (api: { replay: () => void }) => ReactNode
  // Altezza massima del riquadro fuori dallo schermo intero.
  maxHeight?: string
}

export default function CinemaPlayer({
  vimeoId, title, subtitle, backLabel, onBack, startAt = 0, onProgress, onEnded,
  nextLabel = 'Prossima', onNext, renderEnd, maxHeight = '78vh',
}: CinemaPlayerProps) {
  const ref = parseVimeo(vimeoId)
  const videoUrl: `https://vimeo.com/${string}` | null = ref
    ? (ref.hash ? `https://vimeo.com/${ref.id}/${ref.hash}` : `https://vimeo.com/${ref.id}`)
    : null

  const { user } = useAuth()
  const watermark = user ? (user.email || user.id) : ''

  const wrapRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const onProgressRef = useRef(onProgress)
  const onEndedRef = useRef(onEnded)
  onProgressRef.current = onProgress
  onEndedRef.current = onEnded

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [speedOk, setSpeedOk] = useState(true)
  const [speedOpen, setSpeedOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsOn, setControlsOn] = useState(true)
  const [aspect, setAspect] = useState(16 / 9)
  const [scrub, setScrub] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [flash, setFlash] = useState<{ dir: -1 | 1; key: number } | null>(null)
  const [needsUnmute, setNeedsUnmute] = useState(false)

  const hideTimer = useRef<number>()
  const lastTap = useRef<number>(0)
  const timeRef = useRef(0)
  timeRef.current = time

  const visible = controlsOn || !playing || speedOpen || scrub !== null

  // Mostra i controlli e programma la loro scomparsa.
  const poke = useCallback(() => {
    setControlsOn(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsOn(false), HIDE_AFTER_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  // ── Creazione del player ────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container || !videoUrl) return

    setReady(false); setPlaying(false); setEnded(false); setTime(0); setDuration(0); setBuffered(0)

    const player = new Player(container, {
      url: videoUrl, controls: false, keyboard: false, dnt: true,
      title: false, byline: false, portrait: false, pip: false, playsinline: true,
    })
    playerRef.current = player

    const ifr = container.querySelector('iframe')
    if (ifr) {
      Object.assign(ifr.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', border: '0' })
      ifr.setAttribute('allowfullscreen', '')
      ifr.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media')
    }

    let cancelled = false
    let lastSaved = 0   // ultimo secondo salvato (throttle)
    let latest = 0      // ultimo secondo visto (per salvare all'uscita)
    const save = (s: number) => { latest = s; lastSaved = s; onProgressRef.current?.(s) }

    player.ready().then(async () => {
      if (cancelled) return
      const [w, h, d] = await Promise.all([
        player.getVideoWidth(), player.getVideoHeight(), player.getDuration(),
      ]).catch(() => [0, 0, 0] as number[])
      if (cancelled) return
      if (w > 0 && h > 0) setAspect(w / h)
      if (d > 0) setDuration(d)
      // Riprendi dall'ultimo punto (se non è praticamente finito).
      if (startAt > 3 && (!d || startAt < d - 15)) {
        await player.setCurrentTime(startAt).catch(() => {})
        if (!cancelled) setTime(startAt)
      }
      setReady(true)
      // Parte da solo; se il browser blocca l'autoplay resta il grande ▶.
      player.play().catch(() => {})
    }).catch(() => {})

    player.on('play', () => { setPlaying(true); setEnded(false) })
    player.on('playing', () => setBuffering(false))
    player.on('pause', (d: TimeData) => { setPlaying(false); if (onProgressRef.current) save(d.seconds) })
    player.on('ended', () => { setPlaying(false); setEnded(true); onEndedRef.current?.() })
    player.on('timeupdate', (d: TimeData) => {
      latest = d.seconds
      setTime(d.seconds)
      if (d.duration > 0) setDuration(d.duration)
      if (onProgressRef.current && d.seconds - lastSaved >= SAVE_EVERY_S) save(d.seconds)
    })
    player.on('progress', (d: TimeData) => setBuffered(d.percent))
    player.on('bufferstart', () => setBuffering(true))
    player.on('bufferend', () => setBuffering(false))
    player.on('volumechange', (d: { volume: number }) => setVolume(d.volume))
    player.on('playbackratechange', (d: { playbackRate: number }) => setRate(d.playbackRate))

    return () => {
      cancelled = true
      if (onProgressRef.current && latest > lastSaved) onProgressRef.current(latest)
      player.destroy().catch(() => {})
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, startAt])

  // ── Azioni ──────────────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    const p = playerRef.current
    if (!p) return
    try {
      await p.play()
    } catch (err) {
      // Alcuni browser (iOS) consentono la riproduzione solo senza audio:
      // parte muto e mostriamo "Attiva l'audio".
      if ((err as { name?: string })?.name === 'NotAllowedError') {
        await p.setMuted(true).catch(() => {})
        setMuted(true)
        setNeedsUnmute(true)
        p.play().catch(() => {})
      }
    }
  }, [])

  const togglePlay = useCallback(() => {
    const p = playerRef.current
    if (!p || !ready) return
    if (ended) { p.setCurrentTime(0).then(() => play()).catch(() => {}); return }
    if (playing) p.pause().catch(() => {})
    else play()
  }, [ready, ended, playing, play])

  const seekTo = useCallback((seconds: number) => {
    const p = playerRef.current
    if (!p || !duration) return
    const t = Math.max(0, Math.min(duration - 0.5, seconds))
    setTime(t)
    p.setCurrentTime(t).catch(() => {})
  }, [duration])

  const seekBy = useCallback((delta: number) => {
    seekTo(timeRef.current + delta)
    setFlash({ dir: delta < 0 ? -1 : 1, key: Date.now() })
  }, [seekTo])

  const applyMuted = useCallback((m: boolean) => {
    const p = playerRef.current
    if (!p) return
    setMuted(m)
    p.setMuted(m).catch(() => {})
    if (!m) {
      setNeedsUnmute(false)
      if (volume === 0) { setVolume(1); p.setVolume(1).catch(() => {}) }
    }
  }, [volume])

  const changeVolume = (v: number) => {
    const p = playerRef.current
    if (!p) return
    setVolume(v)
    p.setVolume(v).catch(() => {})
    if (v > 0 && muted) applyMuted(false)
  }

  const changeSpeed = (r: number) => {
    const p = playerRef.current
    setSpeedOpen(false)
    if (!p) return
    p.setPlaybackRate(r).then(() => setRate(r)).catch(() => setSpeedOk(false))
  }

  const toggleFullscreen = useCallback(() => {
    const doc = document as FsDocument
    const el = wrapRef.current as FsElement | null
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {})
      else doc.webkitExitFullscreen?.()
      return
    }
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => { playerRef.current?.requestFullscreen().catch(() => {}) })
    else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen()
    else playerRef.current?.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    const onChange = () => {
      const doc = document as FsDocument
      const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
      setFullscreen(!!fsEl && fsEl === wrapRef.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // Tastiera (ignorata mentre si scrive in un campo di testo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === ' ' || k === 'k') { e.preventDefault(); togglePlay() }
      else if (k === 'arrowleft' || k === 'j') { e.preventDefault(); seekBy(-SEEK_STEP_S) }
      else if (k === 'arrowright' || k === 'l') { e.preventDefault(); seekBy(SEEK_STEP_S) }
      else if (k === 'f') toggleFullscreen()
      else if (k === 'm') applyMuted(!muted)
      else return
      poke()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, seekBy, toggleFullscreen, applyMuted, muted, poke])

  // Click / tocco sulla superficie del video.
  const onSurfaceUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return
      setSpeedOpen(false)
      togglePlay()
      poke()
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const now = Date.now()
    if (now - lastTap.current < 300 && (x < 0.35 || x > 0.65)) {
      lastTap.current = 0
      seekBy(x < 0.35 ? -SEEK_STEP_S : SEEK_STEP_S)
      poke()
      return
    }
    lastTap.current = now
    if (visible && playing) { setControlsOn(false); setSpeedOpen(false) }
    else poke()
  }

  // Barra di avanzamento: click, trascinamento, anteprima del tempo.
  const fracAt = (clientX: number) => {
    const r = barRef.current?.getBoundingClientRect()
    if (!r || r.width === 0) return 0
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }

  if (!videoUrl) {
    return (
      <div
        data-inverted="true"
        className="relative mx-auto w-full flex items-center justify-center bg-black"
        style={{ aspectRatio: '16 / 9', maxWidth: `calc(${maxHeight} * 16 / 9)` }}
      >
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Video non ancora disponibile</p>
      </div>
    )
  }

  const shown = scrub ?? (duration ? time / duration : 0)
  const iconBtn = 'pointer-events-auto w-10 h-10 lg:w-11 lg:h-11 flex items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 active:scale-95'

  return (
    <div
      ref={wrapRef}
      data-inverted="true"
      className={`cinema relative mx-auto w-full overflow-hidden bg-black select-none ${visible ? '' : 'cursor-none'}`}
      style={{ aspectRatio: String(aspect), maxWidth: `calc(${maxHeight} * ${aspect})` }}
      onPointerMove={e => { if (e.pointerType === 'mouse') poke() }}
      onMouseLeave={() => { if (playing) setControlsOn(false) }}
    >
      {/* Iframe Vimeo (nessun figlio React: lo gestisce l'SDK) */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Superficie cliccabile sopra il video */}
      <div
        className="absolute inset-0 z-10"
        onPointerUp={onSurfaceUp}
        onDoubleClick={toggleFullscreen}
      />

      {/* Watermark forense: si sposta e riappare, resta anche a schermo intero */}
      {watermark && <Watermark text={watermark} />}

      {/* Caricamento / buffering */}
      {(!ready || (buffering && playing)) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <Loader2 size={44} strokeWidth={2} className="animate-spin text-white" style={{ opacity: 0.85 }} />
        </div>
      )}

      {/* Grande ▶ quando è in pausa */}
      {ready && !playing && !ended && scrub === null && (
        <button
          aria-label="Riproduci"
          onClick={togglePlay}
          className="absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[72px] h-[72px] lg:w-[88px] lg:h-[88px] rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
        >
          <Play size={34} strokeWidth={2} fill="#05070d" color="#05070d" style={{ marginLeft: 4 }} />
        </button>
      )}

      {/* ±10s (doppio tocco / frecce) */}
      {flash && (
        <div
          key={flash.key}
          className={`cinema-flash absolute z-20 top-1/2 -translate-y-1/2 ${flash.dir < 0 ? 'left-[12%]' : 'right-[12%]'} pointer-events-none`}
          onAnimationEnd={() => setFlash(null)}
        >
          <div className="w-16 h-16 rounded-full flex flex-col items-center justify-center text-white" style={{ background: 'rgba(0,0,0,0.5)' }}>
            {flash.dir < 0 ? <RotateCcw size={22} strokeWidth={2.4} /> : <RotateCw size={22} strokeWidth={2.4} />}
            <span className="text-[11px] font-bold mt-0.5">{flash.dir < 0 ? '−10' : '+10'}</span>
          </div>
        </div>
      )}

      {/* "Attiva l'audio" (riproduzione partita muta) */}
      {needsUnmute && (
        <button
          onClick={() => applyMuted(false)}
          className="absolute z-30 left-3 top-14 lg:left-6 lg:top-20 inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-sm font-semibold text-white"
          style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          <VolumeX size={16} strokeWidth={2.4} /> Attiva l'audio
        </button>
      )}

      {/* Velocità: pannello sopra il video (sul telefono il player è basso) */}
      {speedOpen && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 px-4"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onPointerUp={e => { if (e.target === e.currentTarget) setSpeedOpen(false) }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Velocità di riproduzione
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => changeSpeed(s)}
                className="h-10 min-w-[64px] px-3 rounded-full text-sm font-bold transition-colors"
                style={rate === s
                  ? { background: '#ffffff', color: '#05070d' }
                  : { background: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                {s === 1 ? 'Normale' : `${s}×`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Barra superiore ── */}
      <div
        className="absolute inset-x-0 top-0 z-20 px-2 lg:px-5 pt-2 lg:pt-4 pb-10 flex items-start gap-2 pointer-events-none transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)' }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="pointer-events-auto inline-flex items-center gap-1 h-10 pl-1.5 pr-3 rounded-full text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <ChevronLeft size={24} strokeWidth={2.4} />
            <span className="hidden sm:inline">{backLabel ?? 'Indietro'}</span>
          </button>
        )}
      </div>

      {/* Contenuto di fine video (es. prossima lezione) */}
      {ended && renderEnd && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          {renderEnd({ replay: () => { playerRef.current?.setCurrentTime(0).then(() => play()).catch(() => {}) } })}
        </div>
      )}

      {/* ── Barra inferiore ── */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 px-2 lg:px-5 pb-1.5 lg:pb-3 pt-14 pointer-events-none transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0) 100%)' }}
      >
        {/* Avanzamento */}
        <div className="flex items-center gap-3 px-1.5 lg:px-2">
          <div
            ref={barRef}
            className="cinema-bar pointer-events-auto relative flex-1 h-6 flex items-center cursor-pointer touch-none"
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId)
              setScrub(fracAt(e.clientX))
              poke()
            }}
            onPointerMove={e => {
              const f = fracAt(e.clientX)
              if (scrub !== null) setScrub(f)
              if (e.pointerType === 'mouse') setHover(f)
            }}
            onPointerUp={e => {
              if (scrub === null) return
              seekTo(fracAt(e.clientX) * duration)
              setScrub(null)
            }}
            onPointerCancel={() => setScrub(null)}
            onPointerLeave={() => setHover(null)}
          >
            <div className="cinema-track relative w-full rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }}>
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${buffered * 100}%`, background: 'rgba(255,255,255,0.35)' }} />
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${shown * 100}%`, background: 'var(--ist-media-accent)' }} />
              <div
                className={`cinema-knob absolute top-1/2 w-3.5 h-3.5 -ml-[7px] rounded-full ${scrub !== null ? 'is-active' : ''}`}
                style={{ left: `${shown * 100}%`, background: 'var(--ist-media-accent)', boxShadow: '0 0 0 3px rgba(0,0,0,0.25)' }}
              />
            </div>
            {hover !== null && duration > 0 && (
              <span
                className="absolute bottom-6 -translate-x-1/2 text-[11px] font-semibold text-white px-1.5 py-0.5 rounded tabular-nums pointer-events-none"
                style={{ left: `${hover * 100}%`, background: 'rgba(0,0,0,0.8)' }}
              >
                {fmt(hover * duration)}
              </span>
            )}
          </div>
          <span className="text-xs lg:text-[13px] font-semibold text-white tabular-nums flex-shrink-0" style={{ opacity: 0.9 }}>
            -{fmt(Math.max(0, duration - (scrub !== null ? scrub * duration : time)))}
          </span>
        </div>

        {/* Comandi */}
        <div className="flex items-center gap-0.5 lg:gap-1.5">
          <button aria-label={playing ? 'Pausa' : 'Riproduci'} className={iconBtn} onClick={togglePlay}>
            {playing
              ? <Pause size={26} strokeWidth={2} fill="currentColor" />
              : <Play size={26} strokeWidth={2} fill="currentColor" />}
          </button>
          <button aria-label="Indietro 10 secondi" className={iconBtn} onClick={() => seekBy(-SEEK_STEP_S)}>
            <SeekIcon dir={-1} />
          </button>
          <button aria-label="Avanti 10 secondi" className={iconBtn} onClick={() => seekBy(SEEK_STEP_S)}>
            <SeekIcon dir={1} />
          </button>

          <div className="cinema-volume pointer-events-auto flex items-center">
            <button aria-label={muted ? 'Attiva audio' : 'Disattiva audio'} className={iconBtn} onClick={() => applyMuted(!muted)}>
              {muted || volume === 0 ? <VolumeX size={24} strokeWidth={2} /> : <Volume2 size={24} strokeWidth={2} />}
            </button>
            <input
              aria-label="Volume"
              type="range" min={0} max={1} step={0.05}
              value={muted ? 0 : volume}
              onChange={e => changeVolume(Number(e.target.value))}
              className="cinema-volume-range hidden lg:block"
            />
          </div>

          <span className="hidden sm:inline text-xs lg:text-[13px] font-medium text-white tabular-nums ml-1" style={{ opacity: 0.85 }}>
            {fmt(scrub !== null ? scrub * duration : time)} / {fmt(duration)}
          </span>

          {/* Titolo al centro (desktop) */}
          <div className="flex-1 min-w-0 px-3 text-center hidden md:block">
            <p className="text-sm lg:text-[15px] font-bold text-white truncate">
              {title}
              {subtitle && <span className="font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}> · {subtitle}</span>}
            </p>
          </div>
          <div className="flex-1 md:hidden" />

          {onNext && (
            <button
              className="pointer-events-auto inline-flex items-center gap-1.5 h-10 lg:h-11 px-2.5 rounded-full text-white text-sm font-semibold transition-colors hover:bg-white/10"
              onClick={onNext}
              aria-label={nextLabel}
            >
              <SkipForward size={22} strokeWidth={2} fill="currentColor" />
              <span className="hidden lg:inline">{nextLabel}</span>
            </button>
          )}

          {speedOk && (
            <button aria-label="Velocità" className={iconBtn} onClick={() => { setSpeedOpen(o => !o); poke() }}>
              <Gauge size={22} strokeWidth={2} />
            </button>
          )}

          <button aria-label={fullscreen ? 'Esci da schermo intero' : 'Schermo intero'} className={iconBtn} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize size={22} strokeWidth={2} /> : <Maximize size={22} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function SeekIcon({ dir }: { dir: -1 | 1 }) {
  const Icon = dir < 0 ? RotateCcw : RotateCw
  return (
    <span className="relative inline-flex items-center justify-center">
      <Icon size={26} strokeWidth={1.9} />
      <span className="absolute text-[8px] font-extrabold" style={{ marginTop: 1 }}>10</span>
    </span>
  )
}

// Codice legato all'utente sovrapposto al video: se qualcuno registra lo schermo
// e ripubblica, il leak è tracciabile. Deterrente lato client (vedi VimeoPlayer).
function Watermark({ text }: { text: string }) {
  const [wm, setWm] = useState<{ top: string; left: string; on: boolean }>({ top: '8%', left: '8%', on: true })
  useEffect(() => {
    let hideT: number
    const cycle = () => {
      const top = 6 + Math.floor(Math.random() * 70)
      const left = 5 + Math.floor(Math.random() * 60)
      setWm({ top: `${top}%`, left: `${left}%`, on: true })
      hideT = window.setTimeout(() => setWm(p => ({ ...p, on: false })), 4200)
    }
    cycle()
    const iv = window.setInterval(cycle, 6800)
    return () => { window.clearInterval(iv); window.clearTimeout(hideT) }
  }, [])
  return (
    <div
      aria-hidden="true"
      className="absolute z-[15] pointer-events-none whitespace-nowrap"
      style={{
        top: wm.top,
        left: wm.left,
        font: '600 11px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'rgba(255,255,255,0.30)',
        textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        letterSpacing: '0.02em',
        opacity: wm.on ? 1 : 0,
        transition: 'opacity 1.2s ease, top 1.2s ease, left 1.2s ease',
      }}
    >
      {text}
    </div>
  )
}
