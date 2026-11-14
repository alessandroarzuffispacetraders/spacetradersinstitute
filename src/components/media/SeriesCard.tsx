import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Play, RotateCcw, ChevronDown, X, Check } from 'lucide-react'
import MediaThumb from './MediaThumb'
import { phaseIcon } from './phase'
import { getCategoryStats, type Category } from '../../lib/content'
import { flattenLessons, pickResume, RESUME_CTA, type LessonEntry, type ResumeMode } from '../../lib/catalogView'

// Una categoria del catalogo presentata come una "serie": i corsi sono i
// capitoli e le lezioni le puntate (i nomi nell'app restano quelli di sempre).
//  - nella riga: copertina con titolo, stato e avanzamento
//  - desktop: passando col mouse si apre un'anteprima più grande SOPRA la riga
//    (in un portal, così non viene tagliata dalla riga che scorre)
//  - telefono: il tocco apre una scheda dal basso con copertina e dettagli

const HOVER_DELAY_MS = 450

export interface SeriesInfo {
  stats: { total: number; done: number; pct: number }
  resume: { entry: LessonEntry; mode: ResumeMode } | null
  duration: string | null
  status: string | null
  coverUrl: string | null
}

function durationLabel(seconds: number): string | null {
  const min = Math.round(seconds / 60)
  if (min <= 0) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export function seriesInfo(cat: Category, isCurrent: boolean): SeriesInfo {
  const entries = flattenLessons([cat])
  const stats = getCategoryStats(cat)
  const done = stats.pct === 100
  return {
    stats,
    resume: pickResume(entries),
    duration: durationLabel(entries.reduce((s, e) => s + Math.max(0, e.lesson.durationSeconds), 0)),
    status: done ? 'Completato' : isCurrent ? 'Sei qui' : stats.pct > 0 ? 'In corso' : null,
    // Copertina della serie: quella caricata dall'admin, altrimenti l'illustrazione
    // della prima puntata che ne ha una (le copertine AI non hanno testo).
    coverUrl: cat.coverUrl ?? entries.find(e => e.lesson.coverUrl)?.lesson.coverUrl ?? null,
  }
}

function StatusTag({ status, done, isCurrent }: { status: string; done: boolean; isCurrent: boolean }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-md"
      style={done
        ? { background: '#46D39A', color: '#05170f' }
        : isCurrent
          ? { background: 'var(--ist-media-accent)', color: '#05070d' }
          : { background: 'rgba(0,0,0,0.55)', color: '#fff' }
      }
    >
      {status}
    </span>
  )
}

function PhaseTag({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-md"
      style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
    >
      {children}
    </span>
  )
}

// Copertina della serie con il titolo sovrapposto (usata in card, anteprima e scheda).
function SeriesCover({
  cat, info, isCurrent, big = false,
}: {
  cat: Category
  info: SeriesInfo
  isCurrent: boolean
  big?: boolean
}) {
  const done = info.stats.pct === 100
  return (
    <MediaThumb
      imageUrl={info.coverUrl}
      accent={cat.accent}
      icon={phaseIcon(cat.phase)}
      progress={info.stats.pct > 0 && !done ? info.stats.pct / 100 : 0}
      showPlay={false}
      rounded={big ? '' : 'rounded-xl'}
      className={!big && isCurrent ? 'media-thumb-current' : ''}
      thumbWidth={big ? 1280 : 640}
      topLeft={<>
        <PhaseTag>{cat.phase}</PhaseTag>
        {info.status && <StatusTag status={info.status} done={done} isCurrent={isCurrent} />}
      </>}
    >
      <div
        className={`absolute inset-x-0 bottom-0 ${big ? 'px-5 pb-5 pt-16' : 'px-3.5 pb-3.5 pt-10 lg:px-4 lg:pb-4'}`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 60%, transparent 100%)' }}
      >
        <h3
          className={`font-extrabold leading-[1.05] tracking-tight text-white line-clamp-2 ${big ? 'text-[26px]' : 'text-lg lg:text-xl'}`}
          style={{ textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
        >
          {cat.title}
        </h3>
      </div>
    </MediaThumb>
  )
}

// Dettagli comuni ad anteprima (desktop) e scheda (telefono).
function SeriesDetails({ cat, info, compact }: { cat: Category; info: SeriesInfo; compact?: boolean }) {
  const { stats } = info
  return (
    <div className="text-white">
      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
        {stats.pct === 100 && <span className="inline-flex items-center gap-1 font-bold" style={{ color: '#46D39A' }}><Check size={14} strokeWidth={3} /> Completata</span>}
        <span>{cat.courses.length} {cat.courses.length === 1 ? 'corso' : 'corsi'}</span>
        <span aria-hidden>·</span>
        <span>{stats.total} lezioni</span>
        {info.duration && <><span aria-hidden>·</span><span>{info.duration}</span></>}
      </div>

      {stats.total > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }}>
            <div className="h-full rounded-full" style={{ width: `${stats.pct}%`, background: 'var(--ist-media-accent)' }} />
          </div>
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.7)' }}>{stats.done}/{stats.total}</span>
        </div>
      )}

      {cat.description && (
        <p className={`mt-3 text-sm leading-relaxed ${compact ? 'line-clamp-3' : ''}`} style={{ color: 'rgba(255,255,255,0.75)' }}>
          {cat.description}
        </p>
      )}

      {cat.courses.length > 0 && (
        <div className="mt-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Contenuti
          </p>
          <ol className="space-y-1">
            {(compact ? cat.courses.slice(0, 4) : cat.courses).map((c, i) => {
              const total = c.lessons.length
              const done = c.lessons.filter(l => l.done).length
              return (
                <li key={c.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className="w-5 text-right font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.45)' }}>{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate font-medium">{c.title}</span>
                  <span className="text-[11px] tabular-nums" style={{ color: done === total && total > 0 ? '#46D39A' : 'rgba(255,255,255,0.5)' }}>
                    {done}/{total}
                  </span>
                </li>
              )
            })}
            {compact && cat.courses.length > 4 && (
              <li className="text-[12px] pl-7" style={{ color: 'rgba(255,255,255,0.5)' }}>+ altri {cat.courses.length - 4}</li>
            )}
          </ol>
        </div>
      )}
    </div>
  )
}

interface SeriesCardProps {
  category: Category
  isCurrent: boolean
  onOpen: () => void                    // apre la pagina della serie
  onPlay: (lessonId: string) => void    // avvia/riprende la puntata
}

export default function SeriesCard({ category: cat, isCurrent, onOpen, onPlay }: SeriesCardProps) {
  const info = useMemo(() => seriesInfo(cat, isCurrent), [cat, isCurrent])
  const cardRef = useRef<HTMLButtonElement>(null)
  const hoverTimer = useRef<number>()
  const lastPointer = useRef<string>('mouse')
  const [preview, setPreview] = useState<DOMRect | null>(null)
  const [sheet, setSheet] = useState(false)

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  const play = () => { if (info.resume) onPlay(info.resume.entry.lesson.id) }

  return (
    <>
      <button
        ref={cardRef}
        className="media-card group w-full text-left"
        onPointerDown={e => { lastPointer.current = e.pointerType }}
        onPointerEnter={e => {
          if (e.pointerType !== 'mouse') return
          window.clearTimeout(hoverTimer.current)
          hoverTimer.current = window.setTimeout(() => {
            const r = cardRef.current?.getBoundingClientRect()
            if (r) setPreview(r)
          }, HOVER_DELAY_MS)
        }}
        onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
        onClick={() => {
          window.clearTimeout(hoverTimer.current)
          if (lastPointer.current === 'mouse') onOpen()
          else setSheet(true)
        }}
      >
        <SeriesCover cat={cat} info={info} isCurrent={isCurrent} />
        <div className="mt-2 px-0.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate" style={{ color: 'var(--ist-text-dim)' }}>
            {cat.courses.length} {cat.courses.length === 1 ? 'corso' : 'corsi'} · {info.stats.total} lezioni
          </span>
          <span className="font-semibold flex-shrink-0" style={{ color: info.stats.pct === 100 ? '#46D39A' : 'var(--ist-text-muted)' }}>
            {info.stats.done}/{info.stats.total}
          </span>
        </div>
      </button>

      {preview && (
        <SeriesPreview
          anchor={preview}
          cat={cat}
          info={info}
          isCurrent={isCurrent}
          onClose={() => setPreview(null)}
          onOpen={() => { setPreview(null); onOpen() }}
          onPlay={() => { setPreview(null); play() }}
        />
      )}

      {sheet && (
        <SeriesSheet
          cat={cat}
          info={info}
          isCurrent={isCurrent}
          onClose={() => setSheet(false)}
          onOpen={() => { setSheet(false); onOpen() }}
          onPlay={() => { setSheet(false); play() }}
        />
      )}
    </>
  )
}

// ─── Anteprima al passaggio del mouse (desktop) ───────────────────────────────

const PREVIEW_SCALE = 1.45
const EDGE = 16

function SeriesPreview({
  anchor, cat, info, isCurrent, onClose, onOpen, onPlay,
}: {
  anchor: DOMRect
  cat: Category
  info: SeriesInfo
  isCurrent: boolean
  onClose: () => void
  onOpen: () => void
  onPlay: () => void
}) {
  const [shown, setShown] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const [shiftUp, setShiftUp] = useState(0)

  // Se l'anteprima uscirebbe dal fondo dello schermo, la facciamo risalire.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const overflow = el.getBoundingClientRect().top + el.offsetHeight - (window.innerHeight - EDGE)
    if (overflow > 0) setShiftUp(overflow)
  }, [])

  // Chiudi se la pagina scorre o cambia dimensione (la posizione non sarebbe più valida).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true))
    const close = () => onClose()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [onClose])

  // Mai sopra la barra laterale: il bordo sinistro utile è l'inizio del contenuto.
  const main = document.querySelector('main')
  const minLeft = main
    ? main.getBoundingClientRect().left + (parseFloat(getComputedStyle(main).paddingLeft) || 0) + EDGE
    : EDGE
  const width = Math.min(anchor.width * PREVIEW_SCALE, window.innerWidth - minLeft - EDGE)
  const centerLeft = anchor.left + anchor.width / 2 - width / 2
  const left = Math.max(minLeft, Math.min(centerLeft, window.innerWidth - width - EDGE))
  const coverH = (width * 9) / 16
  // Allineata verticalmente al centro della card; mai fuori dallo schermo in alto.
  const top = Math.max(EDGE, anchor.top + anchor.height / 2 - coverH / 2 - 8 - shiftUp)
  const originX = ((anchor.left + anchor.width / 2 - left) / width) * 100

  const mode = info.resume?.mode
  const PlayIcon = mode === 'rewatch' ? RotateCcw : Play

  return createPortal(
    <div
      ref={boxRef}
      data-inverted="true"
      role="dialog"
      aria-label={cat.title}
      className="fixed z-[80] rounded-xl overflow-hidden"
      style={{
        top, left, width,
        background: '#11141c',
        boxShadow: '0 24px 70px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08)',
        transformOrigin: `${originX}% 20%`,
        transform: shown ? 'scale(1)' : `scale(${1 / PREVIEW_SCALE})`,
        opacity: shown ? 1 : 0,
        transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 160ms ease',
      }}
      onMouseLeave={onClose}
    >
      <button className="block w-full text-left" onClick={onOpen} aria-label={`Apri ${cat.title}`}>
        <SeriesCover cat={cat} info={info} isCurrent={isCurrent} big />
      </button>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3.5">
          {info.resume && (
            <button
              onClick={onPlay}
              className="inline-flex items-center gap-2 h-10 pl-4 pr-5 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: '#ffffff', color: '#05070d' }}
            >
              <PlayIcon size={16} strokeWidth={2.5} fill={mode === 'rewatch' ? 'none' : 'currentColor'} />
              {mode ? RESUME_CTA[mode] : 'Guarda'}
              {mode === 'resume' || mode === 'next' ? <span className="font-semibold opacity-60">· Lez. {info.resume.entry.number}</span> : null}
            </button>
          )}
          <button
            onClick={onOpen}
            aria-label="Apri la serie"
            title="Apri"
            className="ml-auto w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/10"
            style={{ border: '1.5px solid rgba(255,255,255,0.45)' }}
          >
            <ChevronDown size={20} strokeWidth={2.4} />
          </button>
        </div>
        <SeriesDetails cat={cat} info={info} compact />
      </div>
    </div>,
    document.body,
  )
}

// ─── Scheda dal basso (telefono) ──────────────────────────────────────────────

function SeriesSheet({
  cat, info, isCurrent, onClose, onOpen, onPlay,
}: {
  cat: Category
  info: SeriesInfo
  isCurrent: boolean
  onClose: () => void
  onOpen: () => void
  onPlay: () => void
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true))
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { cancelAnimationFrame(raf); document.body.style.overflow = prev }
  }, [])

  const close = () => { setShown(false); window.setTimeout(onClose, 200) }
  const mode = info.resume?.mode
  const PlayIcon = mode === 'rewatch' ? RotateCcw : Play

  return createPortal(
    <div data-inverted="true" className="fixed inset-0 z-[90]" role="dialog" aria-label={cat.title}>
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', opacity: shown ? 1 : 0, transition: 'opacity 200ms ease' }}
        onClick={close}
      />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl"
        style={{
          background: '#11141c',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 260ms cubic-bezier(0.22,1,0.36,1)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        }}
      >
        <div className="relative">
          <SeriesCover cat={cat} info={info} isCurrent={isCurrent} big />
          <button
            onClick={close}
            aria-label="Chiudi"
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="px-4 pt-4">
          <div className="flex flex-col gap-2.5 mb-4">
            {info.resume && (
              <button
                onClick={onPlay}
                className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl text-[15px] font-bold"
                style={{ background: '#ffffff', color: '#05070d' }}
              >
                <PlayIcon size={18} strokeWidth={2.5} fill={mode === 'rewatch' ? 'none' : 'currentColor'} />
                {mode ? RESUME_CTA[mode] : 'Guarda'}
                {mode === 'resume' || mode === 'next' ? <span className="font-semibold opacity-60">· Lezione {info.resume.entry.number}</span> : null}
              </button>
            )}
            <button
              onClick={onOpen}
              className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl text-[15px] font-semibold text-white"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)' }}
            >
              Lezioni e dettagli
            </button>
          </div>
          <SeriesDetails cat={cat} info={info} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
