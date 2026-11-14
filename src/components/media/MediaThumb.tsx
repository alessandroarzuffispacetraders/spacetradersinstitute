import { ReactNode, useState } from 'react'
import { Check, Play, type LucideIcon } from 'lucide-react'
import { useVimeoThumb } from '../../lib/useVimeoThumb'

// Le copertine di ripiego restano sui blu delle sezioni cinema: qualunque
// colore della categoria che non sia già un blu diventa blu (grigi invariati).
const COVER_BLUE = '#2F7DFF'
const COVER_TEAL = '#5A9AB1'
export function coverTone(hex: string): string {
  const m = /^#?([0-9a-f]{6})/i.exec(hex)
  if (!m) return COVER_BLUE
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d < 0.08) return `#${m[1]}`
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  if (h >= 185 && h <= 245) return `#${m[1]}`
  return h > 245 || h < 60 ? COVER_BLUE : COVER_TEAL
}

// Copertina GENERATA dal colore (nessun upload): glow radiali su base scura.
export function proceduralCover(accentIn: string, accentEndIn = accentIn): string {
  const accent = coverTone(accentIn)
  const accentEnd = coverTone(accentEndIn)
  return [
    `radial-gradient(110% 140% at 10% 0%, ${accent}D9 0%, ${accent}66 36%, ${accent}1F 66%, transparent 100%)`,
    `radial-gradient(90% 130% at 100% 100%, ${accentEnd}66 0%, transparent 62%)`,
    `linear-gradient(120deg, ${accent}33 0%, ${accentEnd}0D 100%)`,
  ].join(', ')
}

// Parola chiave delle copertine AI: una riga (o due, se sono due parole lunghe),
// dimensionata in unità del contenitore (cqw) così non esce mai dalla card.
function keywordLayout(keyword: string): { lines: string[]; size: number } {
  const kw = keyword.trim().replace(/\s+/g, ' ')
  const words = kw.split(' ')
  const twoLines = words.length > 1 && kw.length > 9
  const half = Math.ceil(words.length / 2)
  const lines = twoLines ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [kw]
  const longest = Math.max(...lines.map(l => l.length))
  // ~66% della larghezza disponibile; un maiuscolo Inter 800 è largo ~0.7em.
  const size = Math.max(7, Math.min(twoLines ? 12.5 : 16, 66 / (longest * 0.7)))
  return { lines, size }
}

export interface MediaThumbProps {
  imageUrl?: string | null      // immagine preferita (copertina AI o caricata dall'admin)
  vimeoId?: string | null       // altrimenti la miniatura del video
  fallbackUrl?: string | null   // altrimenti un'immagine di ripiego (copertina categoria)
  accent: string
  accentEnd?: string
  icon?: LucideIcon             // filigrana sulla copertina generata
  iconSize?: string             // larghezza della filigrana (default 46%)
  label?: string                // numero grande ("03") se non c'è una miniatura propria
  keyword?: string | null       // parola chiave scritta sopra la copertina AI (imageUrl)
  kicker?: string               // etichetta piccola sopra la parola chiave ("Lezione 03")
  progress?: number             // 0..1 → barra "già visto"
  done?: boolean
  duration?: string
  topLeft?: ReactNode
  thumbWidth?: number           // risoluzione richiesta a Vimeo
  rounded?: string
  aspect?: string               // 'aspect-video' (card) oppure 'h-full' (sfondo banner)
  objectPosition?: string       // inquadratura dell'immagine (es. '72% 50%' per arte a destra)
  // 'light': imageUrl è la versione CHIARA della copertina (tema chiaro):
  // veli bianchi e testi blu notte. Vale solo mentre si vede proprio quella
  // immagine; ripieghi e copertina generata restano scuri.
  tone?: 'dark' | 'light'
  showPlay?: boolean
  className?: string
  children?: ReactNode
}

// Miniatura 16:9 di un video. Ordine: immagine propria → miniatura Vimeo →
// immagine di ripiego → copertina generata. Sempre "scura" (data-inverted),
// così testi e badge restano bianchi anche col tema chiaro.
export default function MediaThumb({
  imageUrl, vimeoId, fallbackUrl, accent, accentEnd, icon: Icon, iconSize = '46%', label, keyword, kicker, progress = 0,
  done, duration, topLeft, thumbWidth = 640, rounded = 'rounded-xl', aspect = 'aspect-video', objectPosition, tone = 'dark', showPlay = true,
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
  // Copertina AI caricata: l'app ci scrive sopra la parola chiave.
  const kw = imgReady && !!imageUrl && src === imageUrl && keyword?.trim() ? keywordLayout(keyword) : null
  // Tono chiaro solo se l'immagine mostrata è proprio quella chiara richiesta.
  const light = tone === 'light' && !!src && src === imageUrl

  if (light) {
    return (
      <div
        className={`media-thumb relative w-full ${aspect} overflow-hidden ${rounded} ${className}`}
        style={{ backgroundColor: '#e5eaf1', containerType: 'inline-size' }}
      >
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
          style={{ opacity: imgReady ? 1 : 0, objectPosition }}
        />

        {(showLabel || progress > 0 || duration) && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(232,237,244,0.82) 0%, rgba(232,237,244,0.28) 42%, transparent 64%)' }}
          />
        )}

        {kw && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(90deg, rgba(232,237,244,0.86) 0%, rgba(232,237,244,0.32) 48%, transparent 68%), linear-gradient(to top, rgba(232,237,244,0.86) 0%, rgba(232,237,244,0.2) 34%, transparent 56%)' }}
            />
            <div
              className="absolute left-[6%] max-w-[78%] pointer-events-none"
              style={{ bottom: progress > 0 ? '11%' : '8%' }}
            >
              {kicker && (
                <span
                  className="flex items-center font-bold uppercase leading-none"
                  style={{ fontSize: 'max(8px, 3.1cqw)', letterSpacing: '0.18em', color: 'rgba(11,21,48,0.72)', gap: '1.6cqw', marginBottom: '1.8cqw' }}
                >
                  <span style={{ width: '4.2cqw', height: 'max(2px, 0.55cqw)', borderRadius: 2, background: '#1f5fd8', flexShrink: 0 }} />
                  {kicker}
                </span>
              )}
              <span
                className="block font-extrabold uppercase"
                style={{ fontSize: `${kw.size}cqw`, lineHeight: 0.94, letterSpacing: '-0.02em', color: '#0b1530', textShadow: '0 1px 14px rgba(232,237,244,0.6)' }}
              >
                {kw.lines.map((line, i) => <span key={i} className="block whitespace-nowrap">{line}</span>)}
              </span>
            </div>
          </>
        )}

        {showLabel && (
          <span
            className="absolute left-[6%] bottom-[5%] font-black leading-none tracking-tight pointer-events-none"
            style={{ fontSize: '22cqw', opacity: 0.9, color: '#0b1530' }}
          >
            {label}
          </span>
        )}

        {children}

        {topLeft && <div className="absolute top-2 left-2 flex items-center gap-1.5">{topLeft}</div>}

        {done && (
          <span
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: '#46D39A', boxShadow: '0 2px 10px rgba(10,20,40,0.25)' }}
            title="Completata"
          >
            <Check size={14} strokeWidth={3} color="#ffffff" />
          </span>
        )}

        {duration && (
          <span
            className="absolute right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ background: 'rgba(11,21,48,0.78)', color: '#ffffff', bottom: progress > 0 ? 12 : 8 }}
          >
            {duration}
          </span>
        )}

        {showPlay && (
          <div className="media-thumb-play absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(11,21,48,0.88)', boxShadow: '0 6px 24px rgba(10,20,40,0.3)' }}
            >
              <Play size={18} strokeWidth={2.5} fill="#ffffff" color="#ffffff" style={{ marginLeft: 2 }} />
            </span>
          </div>
        )}

        {progress > 0 && (
          <div className="absolute left-0 right-0 bottom-0 h-1" style={{ background: 'rgba(10,20,40,0.15)' }}>
            <div className="h-full" style={{ width: `${progress * 100}%`, background: '#1f5fd8' }} />
          </div>
        )}
      </div>
    )
  }

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
          style={{ opacity: imgReady ? 1 : 0, objectPosition }}
        />
      )}

      {/* Velo in basso: leggibilità di numero, durata e barra */}
      {(showLabel || progress > 0 || duration) && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.12) 42%, transparent 64%)' }}
        />
      )}

      {kw && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, rgba(5,7,13,0.55) 0%, rgba(5,7,13,0.12) 46%, transparent 66%), linear-gradient(to top, rgba(5,7,13,0.6) 0%, transparent 52%)' }}
          />
          <div
            className="absolute left-[6%] max-w-[78%] pointer-events-none"
            style={{ bottom: progress > 0 ? '11%' : '8%' }}
          >
            {kicker && (
              <span
                className="flex items-center font-bold uppercase leading-none"
                style={{ fontSize: 'max(8px, 3.1cqw)', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.8)', gap: '1.6cqw', marginBottom: '1.8cqw' }}
              >
                <span style={{ width: '4.2cqw', height: 'max(2px, 0.55cqw)', borderRadius: 2, background: 'var(--ist-media-accent)', flexShrink: 0 }} />
                {kicker}
              </span>
            )}
            <span
              className="block font-extrabold uppercase text-white"
              style={{ fontSize: `${kw.size}cqw`, lineHeight: 0.94, letterSpacing: '-0.02em', textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
            >
              {kw.lines.map((line, i) => <span key={i} className="block whitespace-nowrap">{line}</span>)}
            </span>
          </div>
        </>
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
