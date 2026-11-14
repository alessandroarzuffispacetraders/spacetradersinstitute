import { ReactNode, useState } from 'react'
import { Check, Play, type LucideIcon } from 'lucide-react'
import { useVimeoThumb } from '../../lib/useVimeoThumb'

// Copertina GENERATA dal colore (nessun upload): glow radiali su base scura.
export function proceduralCover(accent: string, accentEnd = accent): string {
  return [
    `radial-gradient(110% 140% at 10% 0%, ${accent}D9 0%, ${accent}66 36%, ${accent}1F 66%, transparent 100%)`,
    `radial-gradient(90% 130% at 100% 100%, ${accentEnd}66 0%, transparent 62%)`,
    `linear-gradient(120deg, ${accent}33 0%, ${accentEnd}0D 100%)`,
  ].join(', ')
}

interface MediaThumbProps {
  imageUrl?: string | null      // immagine preferita (copertina caricata dall'admin)
  vimeoId?: string | null       // altrimenti la miniatura del video
  fallbackUrl?: string | null   // altrimenti un'immagine di ripiego (copertina categoria)
  accent: string
  accentEnd?: string
  icon?: LucideIcon             // filigrana sulla copertina generata
  iconSize?: string             // larghezza della filigrana (default 46%)
  label?: string                // numero grande ("03") se non c'è una miniatura propria
  progress?: number             // 0..1 → barra "già visto"
  done?: boolean
  duration?: string
  topLeft?: ReactNode
  thumbWidth?: number           // risoluzione richiesta a Vimeo
  rounded?: string
  aspect?: string               // 'aspect-video' (card) oppure 'h-full' (sfondo banner)
  showPlay?: boolean
  className?: string
  children?: ReactNode
}

// Miniatura 16:9 di un video. Ordine: immagine propria → miniatura Vimeo →
// immagine di ripiego → copertina generata. Sempre "scura" (data-inverted),
// così testi e badge restano bianchi anche col tema chiaro.
export default function MediaThumb({
  imageUrl, vimeoId, fallbackUrl, accent, accentEnd, icon: Icon, iconSize = '46%', label, progress = 0,
  done, duration, topLeft, thumbWidth = 640, rounded = 'rounded-xl', aspect = 'aspect-video', showPlay = true,
  className = '', children,
}: MediaThumbProps) {
  const vimeoThumb = useVimeoThumb(imageUrl ? null : vimeoId, thumbWidth)
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  const candidates = [imageUrl, vimeoThumb, fallbackUrl].filter((u): u is string => !!u && !failed.has(u))
  const src = candidates[0] ?? null
  // Finché l'immagine non è caricata resta visibile la copertina generata
  // (icona + numero), così le card non appaiono mai "vuote".
  const imgReady = !!src && loadedSrc === src
  const ownImage = imgReady && (src === imageUrl || src === vimeoThumb)
  const showLabel = !!label && !ownImage

  return (
    <div
      data-inverted="true"
      className={`media-thumb relative w-full ${aspect} overflow-hidden ${rounded} ${className}`}
      style={{ backgroundColor: '#0b0f18', backgroundImage: proceduralCover(accent, accentEnd), containerType: 'inline-size' }}
    >
      {!imgReady && Icon && (
        <Icon
          strokeWidth={1.2}
          className="absolute pointer-events-none"
          style={{ color: '#fff', opacity: 0.13, width: iconSize, height: 'auto', right: '-6%', bottom: '-14%' }}
        />
      )}

      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailed(prev => new Set(prev).add(src))}
          className="media-thumb-img absolute inset-0 w-full h-full object-cover"
          style={{ opacity: imgReady ? 1 : 0 }}
        />
      )}

      {/* Velo in basso: leggibilità di numero, durata e barra */}
      {(showLabel || progress > 0 || duration) && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.12) 42%, transparent 64%)' }}
        />
      )}

      {showLabel && (
        <span
          className="absolute left-[6%] bottom-[5%] font-black text-white leading-none tracking-tight pointer-events-none"
          style={{ fontSize: '22cqw', opacity: 0.92, textShadow: '0 4px 24px rgba(0,0,0,0.35)' }}
        >
          {label}
        </span>
      )}

      {/* Sovrapposizioni della pagina (es. titolo sulla copertina), sotto badge e barra */}
      {children}

      {topLeft && <div className="absolute top-2 left-2 flex items-center gap-1.5">{topLeft}</div>}

      {done && (
        <span
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: '#46D39A', boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }}
          title="Completata"
        >
          <Check size={14} strokeWidth={3} className="text-white" />
        </span>
      )}

      {duration && (
        <span
          className="absolute right-2 text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-md tabular-nums"
          style={{ background: 'rgba(0,0,0,0.72)', bottom: progress > 0 ? 12 : 8 }}
        >
          {duration}
        </span>
      )}

      {showPlay && (
        <div className="media-thumb-play absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 6px 24px rgba(0,0,0,0.45)' }}
          >
            <Play size={18} strokeWidth={2.5} fill="#0b0f18" color="#0b0f18" style={{ marginLeft: 2 }} />
          </span>
        </div>
      )}

      {progress > 0 && (
        <div className="absolute left-0 right-0 bottom-0 h-1" style={{ background: 'rgba(255,255,255,0.28)' }}>
          <div className="h-full" style={{ width: `${progress * 100}%`, background: 'var(--ist-media-accent)' }} />
        </div>
      )}

    </div>
  )
}
