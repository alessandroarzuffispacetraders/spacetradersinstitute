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
  children: ReactNode
}

// Riga orizzontale scorrevole stile catalogo: snap sugli elementi, frecce su
// desktop al passaggio del mouse, bordo a filo schermo.
export default function MediaRow({
  title, eyebrow, actionLabel, onAction,
  itemClassName = 'w-[70vw] sm:w-[42vw] md:w-[30vw] lg:w-[280px] xl:w-[300px]',
  initialIndex,
  children,
}: MediaRowProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

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
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0
    el.scrollLeft = Math.max(0, item.offsetLeft - pad)
    update()
  }, [initialIndex, update])

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
      <div className="flex items-end justify-between gap-3 px-4 lg:px-10 mb-3 lg:mb-4">
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
          onScroll={update}
          className="media-scroller flex gap-2.5 lg:gap-4 overflow-x-auto px-4 lg:px-10 py-1"
        >
          {Children.map(children, child => child && (
            <div className={`snap-start flex-shrink-0 ${itemClassName}`}>{child}</div>
          ))}
        </div>

        {/* Frecce (solo desktop, al passaggio sulla riga) */}
        {canLeft && (
          <button
            aria-label="Indietro"
            onClick={() => page(-1)}
            className="media-row-arrow hidden lg:flex absolute left-1 top-[calc(50%-2.25rem)] w-10 h-10 rounded-full items-center justify-center"
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
