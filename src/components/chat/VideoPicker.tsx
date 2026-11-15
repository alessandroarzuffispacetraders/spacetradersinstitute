import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Loader2, Clapperboard } from 'lucide-react'
import MediaThumb from '../media/MediaThumb'
import { lessonThumbProps } from '../media/thumbProps'
import { useStudentCatalog, type Category, type Lesson } from '../../lib/content'
import { useCoverTone } from '../../context/ThemeContext'

// Selettore dei video del percorso da allegare in chat (admin e coach):
// ricerca, filtro per fase, elenco per sezione di corsi. Un tocco sceglie il
// video, che resta allegato al messaggio finché non lo si invia.

export interface PickedVideo { id: string; title: string }

const FILTERS = ['Tutti', 'Onboarding', 'Build', 'Test', 'Deploy', 'Mental Coach'] as const
type Filter = typeof FILTERS[number]

export default function VideoPicker({ userId, onPick, onClose }: {
  userId: string
  onPick: (v: PickedVideo) => void
  onClose: () => void
}) {
  const { categories, loading } = useStudentCatalog(userId, 'all')
  const tone = useCoverTone()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('Tutti')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Sezioni pubblicate con i loro video pubblicati, filtrati per fase e ricerca.
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out: { cat: Category; items: { lesson: Lesson; number: number }[] }[] = []
    for (const cat of categories) {
      if (!cat.published) continue
      const mental = cat.section === 'mental'
      if (filter === 'Mental Coach' ? !mental : filter !== 'Tutti' && (mental || cat.phase !== filter)) continue
      const items: { lesson: Lesson; number: number }[] = []
      for (const crs of cat.courses) {
        if (!crs.published) continue
        crs.lessons.forEach((lesson, i) => {
          if (lesson.published === false) return
          if (needle && !`${lesson.title} ${cat.title} ${crs.title}`.toLowerCase().includes(needle)) return
          items.push({ lesson, number: i + 1 })
        })
      }
      if (items.length) out.push({ cat, items })
    }
    return out
  }, [categories, q, filter])

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-6" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div
        className="video-picker w-full sm:max-w-xl flex flex-col rounded-t-[28px] sm:rounded-[28px] overflow-hidden"
        style={{ maxHeight: 'min(86vh, 760px)', background: '#0b0f18', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,187,208,0.12)', color: '#7CBBD0' }}>
              <Clapperboard size={17} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-white leading-tight">Allega un video</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Lo studente lo apre con un tocco</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ color: 'rgba(255,255,255,0.55)' }} aria-label="Chiudi">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-shrink-0 px-5 pb-2">
          <label className="flex items-center gap-2 h-10 px-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search size={15} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.45)' }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cerca un video"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex-shrink-0 flex gap-1.5 px-5 pb-3 overflow-x-auto no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
              style={filter === f
                ? { background: '#fff', color: '#0b0f18' }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: 'rgba(255,255,255,0.5)' }} /></div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: 'rgba(255,255,255,0.5)' }}>Nessun video trovato.</p>
          ) : groups.map(({ cat, items }) => (
            <div key={cat.id} className="pt-3">
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {cat.section === 'mental' ? cat.title : `${cat.phase} · ${cat.title}`}
              </p>
              {items.map(({ lesson, number }) => (
                <button
                  key={lesson.id}
                  onClick={() => onPick({ id: lesson.id, title: lesson.title })}
                  className="w-full flex items-center gap-3 p-2 rounded-2xl text-left transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
                >
                  <div className="w-28 flex-shrink-0">
                    <MediaThumb {...lessonThumbProps(lesson, cat, number, tone)} keyword={null} kicker={undefined} duration={undefined} rounded="rounded-lg" showPlay={false} thumbWidth={320} progress={0} done={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{lesson.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Lezione {String(number).padStart(2, '0')}{lesson.durationSeconds > 0 ? ` · ${lesson.duration}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
