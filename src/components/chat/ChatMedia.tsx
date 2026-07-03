import { useMemo, useRef, useState } from 'react'
import { Play, Pause, Download, FileText } from 'lucide-react'
import { formatDuration } from '../../lib/audioRecorder'

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Barre "waveform" deterministiche a partire dall'id del messaggio: stesse barre
// a ogni render (non è la forma d'onda reale — decodificarla non è affidabile
// cross-browser, es. Safari con webm/opus). Look coerente stile WhatsApp.
function seededBars(seed: string, n = 34): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const bars: number[] = []
  for (let i = 0; i < n; i++) {
    h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff
    bars.push(0.28 + (h % 1000) / 1000 * 0.72) // 0.28 .. 1.0
  }
  return bars
}

// ─── Vocale (stile WhatsApp) ───────────────────────────────────────────────────

export function VoiceMessage({
  id,
  url,
  duration,
  own,
}: {
  id: string
  url: string
  duration: number
  own: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [metaDur, setMetaDur] = useState(0)
  const bars = useMemo(() => seededBars(id), [id])

  // Durata affidabile: quella salvata (dal recorder); fallback ai metadati.
  const total = duration > 0 ? duration : metaDur
  const progress = total > 0 ? Math.min(1, current / total) : 0

  // Colori derivati dai token bolla (solidi e adattivi chiaro/scuro): `fg`
  // contrasta sempre lo sfondo bolla, `bubbleBg` è lo sfondo → il tasto play
  // è pieno e nitido in entrambi i temi, le barre sono sempre leggibili.
  const fg = own ? 'var(--ist-bubble-own-text)' : 'var(--ist-text)'
  const bubbleBg = own ? 'var(--ist-bubble-own-bg)' : 'var(--ist-bubble-other-bg)'

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) a.pause()
    else void a.play()
  }

  const seekToFraction = (frac: number) => {
    const a = audioRef.current
    if (!a || total <= 0) return
    a.currentTime = Math.max(0, Math.min(total, frac * total))
    setCurrent(a.currentTime)
  }

  return (
    <div className="flex items-center gap-2.5 py-0.5" style={{ minWidth: 210, maxWidth: 280 }}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0) }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration
          if (d && isFinite(d)) setMetaDur(d)
        }}
      />

      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95"
        style={{ background: fg, color: bubbleBg }}
        title={playing ? 'Pausa' : 'Riproduci'}
      >
        {playing ? <Pause size={16} strokeWidth={2.5} /> : <Play size={16} strokeWidth={2.5} className="translate-x-[1px]" />}
      </button>

      {/* Waveform cliccabile per il seek */}
      <div
        className="flex items-center gap-[2px] flex-1 h-8 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          seekToFraction((e.clientX - rect.left) / rect.width)
        }}
      >
        {bars.map((b, i) => {
          const filled = i / bars.length <= progress
          return (
            <div
              key={i}
              className="flex-1 rounded-full"
              style={{
                height: `${Math.round(b * 100)}%`,
                minWidth: 2,
                background: fg,
                opacity: filled ? 1 : 0.32,
                transition: 'opacity 0.08s linear',
              }}
            />
          )
        })}
      </div>

      <span
        className="text-[10px] font-medium tabular-nums flex-shrink-0 w-8 text-right"
        style={{ color: fg, opacity: 0.72 }}
      >
        {formatDuration(playing || current > 0 ? current : total, true)}
      </span>
    </div>
  )
}

// ─── Allegato file (documento) ─────────────────────────────────────────────────

const EXT_COLOR: Record<string, string> = {
  pdf: '#E5484D',
  doc: '#4C7FE5', docx: '#4C7FE5',
  xls: '#2E9E5B', xlsx: '#2E9E5B', csv: '#2E9E5B',
  ppt: '#E5732E', pptx: '#E5732E',
  zip: '#8B7BE5',
  txt: '#6B7280',
}

export function FileAttachment({
  url,
  name,
  size,
  own,
}: {
  url: string
  name: string
  size: number
  own: boolean
}) {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  // fg = testo che contrasta la bolla (adattivo). Le tinte w* si adattano al
  // tema → la tile resta leggibile su bolla propria (teal/azzurra) e altrui.
  const fg = own ? 'var(--ist-bubble-own-text)' : 'var(--ist-text)'
  const color = EXT_COLOR[ext] ?? fg

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={name}
      className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors"
      style={{ background: 'var(--ist-w12)', minWidth: 200, maxWidth: 260 }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 relative"
        style={{ background: 'var(--ist-w16)' }}
      >
        <FileText size={18} strokeWidth={2} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: fg }}>
          {name}
        </p>
        <p className="text-[10px]" style={{ color: fg, opacity: 0.72 }}>
          {[ext.toUpperCase(), formatBytes(size)].filter(Boolean).join(' · ')}
        </p>
      </div>
      <Download size={15} strokeWidth={2} className="flex-shrink-0" style={{ color: fg, opacity: 0.72 }} />
    </a>
  )
}
