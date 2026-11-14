import { ReactNode, useRef, useState } from 'react'
import Billboard, { BillboardProps } from './Billboard'

export type HeroSlide = Omit<BillboardProps, 'topLeft' | 'topRight'> & { key: string }

// Banner rotante stile Netflix: le slide (Billboard) sono impilate e si
// alternano in dissolvenza, con uno zoom lentissimo sulla copertina attiva e
// il testo che risale. Le barre in basso si riempiono: quando la barra attiva
// finisce passa alla slide dopo (così la pausa al passaggio del mouse / al
// tocco ferma anche il tempo). Su telefono si scorre col dito.
export default function HeroCarousel({ slides, topLeft, topRight, interval = 7 }: {
  slides: HeroSlide[]
  topLeft?: ReactNode
  topRight?: ReactNode
  interval?: number   // secondi per slide
}) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const n = slides.length
  const active = n ? idx % n : 0
  const go = (i: number) => setIdx(((i % n) + n) % n)

  if (!n) return null

  return (
    <div
      className={`hero-carousel relative ${paused ? 'is-paused' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; setPaused(true) }}
      onTouchEnd={e => {
        const x0 = touchX.current; touchX.current = null; setPaused(false)
        if (x0 === null) return
        const dx = e.changedTouches[0].clientX - x0
        if (Math.abs(dx) > 50) go(active + (dx < 0 ? 1 : -1))
      }}
    >
      <div className="grid">
        {slides.map((s, i) => {
          const { key, ...props } = s
          return (
            <div key={key} className={`hero-slide ${i === active ? 'is-active' : ''}`} style={{ gridArea: '1 / 1' }} aria-hidden={i !== active}>
              <Billboard {...props} />
            </div>
          )
        })}
      </div>

      {(topLeft || topRight) && (
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-3 cinema-px pt-3.5 lg:pt-6 pointer-events-none">
          <div className="min-w-0 pointer-events-auto">{topLeft}</div>
          {topRight && <div className="flex-shrink-0 pointer-events-auto">{topRight}</div>}
        </div>
      )}

      {n > 1 && (
        <div className="absolute z-20 bottom-5 lg:bottom-7 cinema-px flex items-center gap-1.5" style={{ left: 0 }}>
          {slides.map((s, i) => (
            <button key={s.key} onClick={() => go(i)} aria-label={`Slide ${i + 1}`} className="hero-bar relative h-[3px] rounded-full overflow-hidden" style={{ width: i === active ? 44 : 22 }}>
              <span className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.28)' }} />
              {i < active && <span className="absolute inset-0" style={{ background: '#fff' }} />}
              {i === active && (
                <span
                  key={`${s.key}-${idx}`}
                  className="hero-bar-fill absolute inset-y-0 left-0"
                  style={{ background: '#fff', animationDuration: `${interval}s` }}
                  onAnimationEnd={() => go(active + 1)}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
