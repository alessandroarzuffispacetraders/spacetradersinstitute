import { ReactNode } from 'react'
import { Play, type LucideIcon } from 'lucide-react'
import MediaThumb from './MediaThumb'

export interface BillboardProps {
  imageUrl?: string | null
  imagePosition?: string        // inquadratura dell'immagine (es. locandina verticale)
  vimeoId?: string | null
  fallbackUrl?: string | null
  accent: string
  accentEnd?: string
  icon?: LucideIcon
  topLeft?: ReactNode           // titolo pagina o pulsante "indietro"
  topRight?: ReactNode
  eyebrow?: ReactNode
  title: string
  meta?: ReactNode
  description?: string
  progress?: number             // 0..1
  progressLabel?: string
  actions?: ReactNode
}

// Banner grande in testa alla pagina (stile "billboard"): immagine a tutta
// larghezza, velo scuro, titolo grande e pulsanti. È sempre scuro (anche col
// tema chiaro), come una sala cinema; i testi stanno sopra la parte velata.
export default function Billboard({
  imageUrl, imagePosition, vimeoId, fallbackUrl, accent, accentEnd, icon,
  topLeft, topRight, eyebrow, title, meta, description, progress = 0, progressLabel, actions,
}: BillboardProps) {
  return (
    <section data-inverted="true" className="media-hero relative isolate overflow-hidden">
      <div className="media-hero-bg absolute inset-0 -z-10" />

      {/* Immagine: sopra al testo su mobile, a tutto sfondo su desktop */}
      <div className="relative w-full aspect-video lg:absolute lg:inset-0 lg:aspect-auto">
        <MediaThumb
          imageUrl={imageUrl}
          objectPosition={imagePosition}
          vimeoId={vimeoId}
          fallbackUrl={fallbackUrl}
          accent={accent}
          accentEnd={accentEnd}
          icon={icon}
          iconSize="24%"
          thumbWidth={1280}
          rounded=""
          aspect="h-full"
          showPlay={false}
        />
        <div
          className="absolute inset-0 hidden lg:block"
          style={{ background: 'linear-gradient(90deg, rgba(5,7,13,0.94) 0%, rgba(5,7,13,0.74) 30%, rgba(5,7,13,0.2) 60%, rgba(5,7,13,0) 80%)' }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-3/4"
          style={{ background: 'linear-gradient(to top, #05070d 0%, rgba(5,7,13,0.55) 45%, rgba(5,7,13,0) 100%)' }}
        />
        <div
          className="absolute inset-x-0 top-0 h-24"
          style={{ background: 'linear-gradient(to bottom, rgba(5,7,13,0.6) 0%, rgba(5,7,13,0) 100%)' }}
        />
      </div>

      {(topLeft || topRight) && (
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between gap-3 cinema-px pt-3.5 lg:pt-6">
          <div className="min-w-0">{topLeft}</div>
          {topRight && <div className="flex-shrink-0">{topRight}</div>}
        </div>
      )}

      <div className="relative cinema-px -mt-14 sm:-mt-24 pb-14 lg:mt-0 lg:pb-[4.5rem] lg:pt-28 lg:min-h-[min(66vh,600px)] lg:flex lg:flex-col lg:justify-end">
        <div className="hero-copy max-w-xl">
          {eyebrow && <div className="mb-2.5 flex items-center gap-2 flex-wrap">{eyebrow}</div>}

          <h1
            className="text-[28px] sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.06] text-white"
            style={{ textShadow: '0 2px 24px rgba(0,0,0,0.45)', textWrap: 'balance' }}
          >
            {title}
          </h1>

          {meta && (
            <div className="mt-2.5 flex items-center gap-x-2 gap-y-1 flex-wrap text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.72)' }}>
              {meta}
            </div>
          )}

          {description && (
            <p className="mt-3 text-sm lg:text-[15px] leading-relaxed line-clamp-3" style={{ color: 'rgba(255,255,255,0.74)' }}>
              {description}
            </p>
          )}

          {progress > 0 && (
            <div className="mt-4 flex items-center gap-3 max-w-sm">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.22)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%`, background: 'var(--ist-media-accent)' }} />
              </div>
              {progressLabel && (
                <span className="text-xs font-medium flex-shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }}>{progressLabel}</span>
              )}
            </div>
          )}

          {actions && <div className="mt-5 flex items-center gap-2.5 flex-wrap">{actions}</div>}
        </div>
      </div>
    </section>
  )
}

// Pulsanti del banner: "primario" bianco pieno, "secondario" vetro chiaro.
export function HeroButton({
  variant = 'primary', icon: Icon, onClick, children,
}: {
  variant?: 'primary' | 'secondary'
  icon?: LucideIcon
  onClick?: () => void
  children: ReactNode
}) {
  const primary = variant === 'primary'
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 h-11 px-5 lg:px-6 rounded-xl text-sm lg:text-[15px] font-bold transition-all active:scale-[0.97] hover:opacity-90"
      style={primary
        ? { background: '#ffffff', color: '#0b0f18' }
        : { background: 'rgba(255,255,255,0.16)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.18)' }
      }
    >
      {Icon && (
        <Icon
          size={18}
          strokeWidth={2.5}
          fill={Icon === Play ? 'currentColor' : 'none'}
          style={{ marginLeft: -2 }}
        />
      )}
      {children}
    </button>
  )
}

// Etichetta piccola in alto ("Onboarding", "IN DIRETTA", …).
export function HeroTag({ children, tone = 'glass' }: { children: ReactNode; tone?: 'glass' | 'live' | 'accent' }) {
  const style = tone === 'live'
    ? { background: '#E5484D', color: '#fff' }
    : tone === 'accent'
      ? { background: 'var(--ist-media-accent)', color: '#05070d' }
      : { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md" style={style}>
      {children}
    </span>
  )
}
