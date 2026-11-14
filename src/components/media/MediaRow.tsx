import { Children, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MediaRowProps {
  title: string
  eyebrow?: string
  actionLabel?: string
  onAction?: () => void
  // Larghezza di ogni elemento: su mobile si vede uno spicchio del successivo
  // (invita a scorrere), su desktop una larghezza fissa.
  itemClassName?: string
  // Elemento da mostrare per primo all'apertura (es. l'episodio in riproduzione).
  initialIndex?: number
  // 'carousel': su telefono un elemento alla volta al centro, con il precedente
  // e il successivo in penombra ai lati (un tocco su un vicino lo porta al centro).
  // Su desktop resta una riga normale.
  variant?: 'row' | 'carousel'
  children: ReactNode
}

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

// Riga orizzontale scorrevole stile catalogo: snap sugli elementi, frecce su
// desktop al passaggio del mouse, bordo a filo schermo.
export default function MediaRow({
  title, eyebrow, actionLabel, onAction,
  itemClassName = 'w-[70vw] sm:w-[42vw] md:w-[30vw] lg:w-[280px] xl:w-[300px]',
  initialIndex,
  variant = 'row',
  children,
}: MediaRowProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const carousel = variant === 'carousel'
  const [active, setActive] = useState(initialIndex ?? 0)
  const raf = useRef(0)

  // Elemento più vicino al centro = quello "acceso" del carosello.
  const computeActive = useCallback(() => {
    const el = scroller.current
    if (!el || !carousel) return
    const center = el.scrollLeft + el.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    Array.from(el.children).forEach((c, i) => {
      const item = c as HTMLElement
      const d = Math.abs(item.offsetLeft + item.offsetWidth / 2 - center)
      if (d < bestDist) { bestDist = d; best = i }
    })
    setActive(best)
  }, [carousel])

  const centerItem = (i: number, smooth: boolean) => {
    const el = scroller.current
    const item = el?.children[i] as HTMLElement | undefined
    if (!el || !item) return
    const left = item.offsetLeft + item.offsetWidth / 2 - el.clientWidth / 2
    el.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' })
  }

  const update = useCallback(() => {
    const el = scroller.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  const count = Children.count(children)

  // Porta in vista l'elemento iniziale (senza animazione, solo all'apertura).
  useEffect(() => {
    const el = scroller.current
    if (!el || !initialIndex || initialIndex <= 0) return
    const item = el.children[initialIndex] as HTMLElement | undefined
    if (!item) return
    if (carousel && !isDesktop()) {
      centerItem(initialIndex, false)
    } else {
      const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0
      el.scrollLeft = Math.max(0, item.offsetLeft - pad)
    }
    update()
    computeActive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIndex, update, computeActive])

  useEffect(() => {
    update()
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update, count])

  const page = (dir: 1 | -1) => {
    const el = scroller.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section className="media-row relative mb-7 lg:mb-10">
      <div className="flex items-end justify-between gap-3 cinema-px mb-3 lg:mb-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.14em] mb-1 truncate" style={{ color: 'var(--ist-accent-text)' }}>
              {eyebrow}
            </p>
          )}
          <h2 className="text-[22px] lg:text-[28px] font-extrabold tracking-tight leading-tight truncate" style={{ color: 'var(--ist-text)' }}>
            {title}
          </h2>
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-0.5 text-xs lg:text-sm font-semibold flex-shrink-0 mb-0.5 lg:mb-1 transition-opacity hover:opacity-70"
            style={{ color: 'var(--ist-text-muted)' }}
          >
            {actionLabel}
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="relative">
        <div
          ref={scroller}
          onScroll={() => {
            update()
            if (carousel) { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(computeActive) }
          }}
          className={`media-scroller flex gap-2.5 lg:gap-4 overflow-x-auto cinema-px py-1 ${carousel ? 'media-carousel' : ''}`}
        >
          {Children.map(children, (child, i) => child && (
            <div
              className={`snap-start flex-shrink-0 ${itemClassName}`}
              data-active={carousel ? String(i === active) : undefined}
              onClickCapture={carousel ? e => {
                // Telefono: toccare un vicino in penombra lo porta al centro.
                if (isDesktop() || i === active) return
                e.preventDefault()
                e.stopPropagation()
                centerItem(i, true)
              } : undefined}
            >
              {child}
            </div>
          ))}
        </div>

        {/* Frecce (solo desktop, al passaggio sulla riga) */}
        {canLeft && (
          <button
            aria-label="Indietro"
            onClick={() => page(-1)}
            className="media-row-arrow hidden lg:flex absolute top-[calc(50%-2.25rem)] w-10 h-10 rounded-full items-center justify-center"
            style={{ left: 'max(4px, calc(var(--g-l) - 3.25rem))' }}
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
        )}
        {canRight && (
          <button
            aria-label="Avanti"
            onClick={() => page(1)}
            className="media-row-arrow hidden lg:flex absolute right-1 top-[calc(50%-2.25rem)] w-10 h-10 rounded-full items-center justify-center"
          >
            <ChevronRight size={20} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </section>
  )
}
