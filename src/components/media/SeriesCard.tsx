import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Play, RotateCcw, ChevronRight, X, Check } from 'lucide-react'
import MediaThumb from './MediaThumb'
import { phaseIcon } from './phase'
import { getCategoryStats, type Category } from '../../lib/content'
import { flattenLessons, pickResume, RESUME_CTA, type LessonEntry, type ResumeMode } from '../../lib/catalogView'
import { useCoverTone } from '../../context/ThemeContext'

// Una categoria del catalogo presentata come una "serie": i corsi sono i
// capitoli e le lezioni le puntate (i nomi nell'app restano quelli di sempre).
//  - nella riga: LOCANDINA VERTICALE (2:3) con titolo, stato e avanzamento
//  - desktop: passando col mouse la locandina si allarga DENTRO la riga e
//    diventa orizzontale (16:9, stessa altezza) con dettagli e pulsanti; le
//    vicine scivolano di lato e si attenuano (niente sovrapposizioni)
//  - telefono: il tocco apre una scheda dal basso con copertina e dettagli
//  - tema chiaro dell'utente: la pagina resta scura, ma le IMMAGINI usano la
//    versione chiara (se esiste) con testi blu notte su veli bianchi

const HOVER_DELAY_MS = 380
const OPEN_MS = 380
const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

export interface SeriesInfo {
  stats: { total: number; done: number; pct: number }
  resume: { entry: LessonEntry; mode: ResumeMode } | null
  duration: string | null
  status: string | null
  lessonCover: string | null   // illustrazione AI della prima puntata che ne ha una
  lessonCoverLight: string | null  // la stessa, versione chiara (se esiste)
}

type Tone = 'dark' | 'light'
const NAVY = '#0b1530'

// Locandina AI della serie (null finché non è generata o senza migrazione).
const posterOf = (c: Category): string | null => c.posterUrl ?? null

interface Art { url: string | null; pos?: string; light?: boolean }

// Verticale: locandina AI → copertina dell'admin → illustrazione di una puntata
// (l'arte delle copertine AI sta a destra) → copertina generata. Col tono chiaro
// si usano le versioni chiare della stessa catena, se esistono.
function posterArt(cat: Category, info: SeriesInfo, tone: Tone = 'dark'): Art {
  if (tone === 'light') {
    if (cat.posterUrlLight) return { url: cat.posterUrlLight, light: true }
    if (!cat.posterUrl && !cat.coverUrl && info.lessonCoverLight) return { url: info.lessonCoverLight, pos: '74% 50%', light: true }
  }
  const poster = posterOf(cat)
  if (poster) return { url: poster }
  if (cat.coverUrl) return { url: cat.coverUrl, pos: '50% 50%' }
  if (info.lessonCover) return { url: info.lessonCover, pos: '74% 50%' }
  return { url: null }
}

// Orizzontale (anteprima/scheda): stessa locandina inquadrata sul soggetto, così
// "la locandina si apre"; altrimenti copertina dell'admin o di una puntata.
function landscapeArt(cat: Category, info: SeriesInfo, tone: Tone = 'dark'): Art {
  if (tone === 'light') {
    if (cat.posterUrlLight) return { url: cat.posterUrlLight, pos: '50% 18%', light: true }
    if (!cat.posterUrl && !cat.coverUrl && info.lessonCoverLight) return { url: info.lessonCoverLight, light: true }
  }
  const poster = posterOf(cat)
  if (poster) return { url: poster, pos: '50% 18%' }
  if (cat.coverUrl) return { url: cat.coverUrl }
  if (info.lessonCover) return { url: info.lessonCover }
  return { url: null }
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
  const withCover = entries.find(e => e.lesson.coverUrl)
  return {
    stats,
    resume: pickResume(entries),
    duration: durationLabel(entries.reduce((s, e) => s + Math.max(0, e.lesson.durationSeconds), 0)),
    status: done ? 'Completato' : isCurrent ? 'Sei qui' : stats.pct > 0 ? 'In corso' : null,
    lessonCover: withCover?.lesson.coverUrl ?? null,
    lessonCoverLight: withCover?.lesson.coverUrlLight ?? null,
  }
}

function StatusTag({ status, done, isCurrent, light = false }: { status: string; done: boolean; isCurrent: boolean; light?: boolean }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-md"
      style={done
        ? { background: '#46D39A', color: '#05170f' }
        : isCurrent
          ? { background: 'var(--ist-media-accent)', color: '#05070d' }
          : light ? { background: 'rgba(10,20,40,0.08)', color: NAVY } : { background: 'rgba(0,0,0,0.55)', color: '#fff' }
      }
    >
      {status}
    </span>
  )
}

function PhaseTag({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-md"
      style={light
        ? { background: 'rgba(10,20,40,0.08)', color: NAVY, border: '1px solid rgba(10,20,40,0.12)' }
        : { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
    >
      {children}
    </span>
  )
}

// Copertina della serie con il titolo sovrapposto (usata in card, anteprima e scheda).
function SeriesCover({
  cat, info, isCurrent, big = false, tone = 'dark',
}: {
  cat: Category
  info: SeriesInfo
  isCurrent: boolean
  big?: boolean
  tone?: Tone
}) {
  const done = info.stats.pct === 100
  const art = landscapeArt(cat, info, tone)
  const L = !!art.light
  return (
    <MediaThumb
      imageUrl={art.url}
      objectPosition={art.pos}
      tone={L ? 'light' : 'dark'}
      accent={cat.accent}
      icon={phaseIcon(cat.phase)}
      progress={info.stats.pct > 0 && !done ? info.stats.pct / 100 : 0}
      showPlay={false}
      rounded={big ? '' : 'rounded-xl'}
      className={!big && isCurrent ? 'media-thumb-current' : ''}
      thumbWidth={big ? 1280 : 640}
      topLeft={<>
        <PhaseTag light={L}>{cat.phase}</PhaseTag>
        {info.status && <StatusTag status={info.status} done={done} isCurrent={isCurrent} light={L} />}
      </>}
    >
      <div
        className={`absolute inset-x-0 bottom-0 ${big ? 'px-5 pb-5 pt-16' : 'px-3.5 pb-3.5 pt-10 lg:px-4 lg:pb-4'}`}
        style={{ background: L
          ? 'linear-gradient(to top, rgba(248,250,253,0.92) 0%, rgba(248,250,253,0.4) 60%, transparent 100%)'
          : 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 60%, transparent 100%)' }}
      >
        <h3
          className={`font-extrabold leading-[1.05] tracking-tight line-clamp-2 ${L ? '' : 'text-white'} ${big ? 'text-[26px]' : 'text-lg lg:text-xl'}`}
          style={L ? { color: NAVY } : { textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
        >
          {cat.title}
        </h3>
      </div>
    </MediaThumb>
  )
}

// Locandina verticale: arte a tutta altezza, titolo grande in basso.
function SeriesPoster({ cat, info, isCurrent, tone = 'dark' }: { cat: Category; info: SeriesInfo; isCurrent: boolean; tone?: Tone }) {
  const done = info.stats.pct === 100
  const art = posterArt(cat, info, tone)
  const L = !!art.light
  return (
    <MediaThumb
      imageUrl={art.url}
      objectPosition={art.pos}
      tone={L ? 'light' : 'dark'}
      accent={cat.accent}
      icon={phaseIcon(cat.phase)}
      iconSize="78%"
      aspect="h-full"
      progress={info.stats.pct > 0 && !done ? info.stats.pct / 100 : 0}
      showPlay={false}
      rounded=""
      thumbWidth={640}
      topLeft={<>
        <PhaseTag light={L}>{cat.phase}</PhaseTag>
        {info.status && <StatusTag status={info.status} done={done} isCurrent={isCurrent} light={L} />}
      </>}
    >
      <div
        className="absolute inset-x-0 bottom-0 px-4 pb-5 pt-24"
        style={{ background: L
          ? 'linear-gradient(to top, rgba(248,250,253,0.96) 0%, rgba(248,250,253,0.72) 38%, rgba(248,250,253,0) 100%)'
          : 'linear-gradient(to top, rgba(3,4,8,0.95) 0%, rgba(3,4,8,0.7) 38%, rgba(3,4,8,0) 100%)' }}
      >
        <h3
          className={`text-[24px] lg:text-[26px] font-black leading-[1.02] tracking-tight line-clamp-3 ${L ? '' : 'text-white'}`}
          style={L ? { color: NAVY, textWrap: 'balance' } : { textShadow: '0 2px 20px rgba(0,0,0,0.5)', textWrap: 'balance' }}
        >
          {cat.title}
        </h3>
        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: L ? 'rgba(11,21,48,0.6)' : 'rgba(255,255,255,0.62)' }}>
          {cat.courses.length} {cat.courses.length === 1 ? 'corso' : 'corsi'} · {info.stats.total} lezioni
        </p>
      </div>
    </MediaThumb>
  )
}

// Versione aperta (desktop): arte orizzontale, titolo, dettagli e pulsanti.
function SeriesOpen({
  cat, info, isCurrent, onPlay, onOpen, tone = 'dark',
}: {
  cat: Category
  info: SeriesInfo
  isCurrent: boolean
  onPlay: (e: MouseEvent) => void
  onOpen: (e: MouseEvent) => void
  tone?: Tone
}) {
  const done = info.stats.pct === 100
  const art = landscapeArt(cat, info, tone)
  const L = !!art.light
  const mode = info.resume?.mode
  const PlayIcon = mode === 'rewatch' ? RotateCcw : Play
  return (
    <div className="series-open absolute inset-0">
      <MediaThumb
        imageUrl={art.url}
        objectPosition={art.pos}
        tone={L ? 'light' : 'dark'}
        accent={cat.accent}
        icon={phaseIcon(cat.phase)}
        aspect="h-full"
        showPlay={false}
        rounded=""
        thumbWidth={1280}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: L
          ? 'linear-gradient(90deg, rgba(248,250,253,0.95) 0%, rgba(248,250,253,0.8) 36%, rgba(248,250,253,0.15) 70%, transparent 100%), linear-gradient(to top, rgba(248,250,253,0.8) 0%, rgba(248,250,253,0) 45%)'
          : 'linear-gradient(90deg, rgba(3,4,8,0.94) 0%, rgba(3,4,8,0.78) 36%, rgba(3,4,8,0.2) 70%, rgba(3,4,8,0) 100%), linear-gradient(to top, rgba(3,4,8,0.85) 0%, rgba(3,4,8,0) 45%)' }}
      />
      <div className={`series-open-content absolute inset-0 p-5 xl:p-6 flex flex-col justify-end ${L ? '' : 'text-white'}`} style={L ? { maxWidth: '68%', color: NAVY } : { maxWidth: '68%' }}>
        <div className="flex items-center gap-1.5 mb-2.5">
          <PhaseTag light={L}>{cat.phase}</PhaseTag>
          {info.status && <StatusTag status={info.status} done={done} isCurrent={isCurrent} light={L} />}
        </div>
        <h3 className="text-[28px] xl:text-[32px] font-black leading-[1.02] tracking-tight line-clamp-2" style={{ textWrap: 'balance' }}>
          {cat.title}
        </h3>
        <div className="mt-2 flex items-center gap-x-2 gap-y-1 flex-wrap text-[13px] font-medium" style={{ color: L ? 'rgba(11,21,48,0.72)' : 'rgba(255,255,255,0.75)' }}>
          <span>{cat.courses.length} {cat.courses.length === 1 ? 'corso' : 'corsi'}</span>
          <span aria-hidden>·</span>
          <span>{info.stats.total} lezioni</span>
          {info.duration && <><span aria-hidden>·</span><span>{info.duration}</span></>}
        </div>
        {info.stats.total > 0 && (
          <div className="mt-2.5 flex items-center gap-2.5 max-w-[280px]">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: L ? 'rgba(10,20,40,0.15)' : 'rgba(255,255,255,0.2)' }}>
              <div className="h-full rounded-full" style={{ width: `${info.stats.pct}%`, background: L ? '#1f5fd8' : 'var(--ist-media-accent)' }} />
            </div>
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: L ? 'rgba(11,21,48,0.65)' : 'rgba(255,255,255,0.7)' }}>{info.stats.done}/{info.stats.total}</span>
          </div>
        )}
        {cat.description && (
          <p className="mt-2.5 text-[13px] leading-relaxed line-clamp-2" style={{ color: L ? 'rgba(11,21,48,0.72)' : 'rgba(255,255,255,0.75)' }}>
            {cat.description}
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          {info.resume && (
            <button
              onClick={onPlay}
              className="inline-flex items-center gap-2 h-10 pl-4 pr-5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
              style={L ? { background: NAVY, color: '#ffffff' } : { background: '#ffffff', color: '#05070d' }}
            >
              <PlayIcon size={16} strokeWidth={2.5} fill={mode === 'rewatch' ? 'none' : 'currentColor'} />
              {mode ? RESUME_CTA[mode] : 'Guarda'}
              {mode === 'resume' || mode === 'next' ? <span className="font-semibold opacity-60">· Lez. {info.resume.entry.number}</span> : null}
            </button>
          )}
          <button
            onClick={onOpen}
            className={L
              ? 'inline-flex items-center gap-1 h-10 pl-4 pr-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85'
              : 'inline-flex items-center gap-1 h-10 pl-4 pr-3 rounded-xl text-sm font-semibold text-white transition-colors hover:bg-white/20'}
            style={L
              ? { background: '#ffffff', color: NAVY, border: '1px solid rgba(10,20,40,0.15)' }
              : { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            Dettagli <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
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
  const tone = useCoverTone()
  const rootRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number>()
  const lastPointer = useRef<string>('mouse')
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState(false)

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  // Aperta: se la versione larga esce dalla riga, la riga scorre per mostrarla.
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, OPEN_MS + 30)
    return () => window.clearTimeout(t)
  }, [open])

  const play = () => { if (info.resume) onPlay(info.resume.entry.lesson.id) }

  return (
    <>
      <div
        ref={rootRef}
        role="link"
        tabIndex={0}
        aria-label={cat.title}
        className={`series-card media-card group relative w-full aspect-[2/3] lg:aspect-auto lg:h-[330px] xl:h-[360px] rounded-xl overflow-hidden cursor-pointer outline-none ${open ? 'is-open lg:w-[587px] xl:w-[640px]' : 'lg:w-[220px] xl:w-[240px]'} ${isCurrent ? 'series-current' : ''}`}
        onPointerDown={e => { lastPointer.current = e.pointerType }}
        onPointerEnter={e => {
          if (e.pointerType !== 'mouse' || !isDesktop()) return
          window.clearTimeout(hoverTimer.current)
          hoverTimer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS)
        }}
        onPointerLeave={() => { window.clearTimeout(hoverTimer.current); setOpen(false) }}
        onClick={() => {
          window.clearTimeout(hoverTimer.current)
          if (lastPointer.current === 'mouse' && isDesktop()) onOpen()
          else setSheet(true)
        }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      >
        <div className="absolute inset-0 transition-opacity duration-300" style={{ opacity: open ? 0 : 1 }}>
          <SeriesPoster cat={cat} info={info} isCurrent={isCurrent} tone={tone} />
        </div>
        {open && (
          <SeriesOpen
            cat={cat}
            info={info}
            isCurrent={isCurrent}
            tone={tone}
            onPlay={e => { e.stopPropagation(); play() }}
            onOpen={e => { e.stopPropagation(); onOpen() }}
          />
        )}
      </div>

      {sheet && (
        <SeriesSheet
          cat={cat}
          info={info}
          isCurrent={isCurrent}
          tone={tone}
          onClose={() => setSheet(false)}
          onOpen={() => { setSheet(false); onOpen() }}
          onPlay={() => { setSheet(false); play() }}
        />
      )}
    </>
  )
}

// ─── Scheda dal basso (telefono) ──────────────────────────────────────────────

function SeriesSheet({
  cat, info, isCurrent, onClose, onOpen, onPlay, tone = 'dark',
}: {
  cat: Category
  info: SeriesInfo
  isCurrent: boolean
  tone?: Tone
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
          <SeriesCover cat={cat} info={info} isCurrent={isCurrent} big tone={tone} />
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
