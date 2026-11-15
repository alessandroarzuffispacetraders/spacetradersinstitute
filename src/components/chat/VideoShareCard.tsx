import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Clapperboard } from 'lucide-react'
import MediaThumb from '../media/MediaThumb'
import { phaseIcon } from '../media/phase'
import { phaseLabel } from '../../lib/content'
import { supabase } from '../../lib/supabase'
import { useCoverTone } from '../../context/ThemeContext'

// Scheda di un video del percorso allegato in chat da admin/coach: copertina,
// sezione, titolo e il pulsante che porta alla pagina del video.

export interface SharedLesson {
  id: string
  title: string
  number: number
  durationMin: number
  vimeoId: string | null
  coverUrl: string | null
  coverUrlLight: string | null
  coverKeyword: string | null
  section: string        // titolo della sezione di corsi
  sectionCover: string | null
  accent: string
  phase: string
  mental: boolean
}

type Raw = {
  id: string; title: string; duration_seconds: number | null; vimeo_id: string | null; position: number | null
  cover_url?: string | null; cover_url_light?: string | null; cover_keyword?: string | null
  courses: {
    categories: { title: string; accent: string | null; phase: string | null; cover_url: string | null; section: string | null } | null
    lessons: { id: string; position: number | null }[] | null
  } | null
}

const cache = new Map<string, Promise<SharedLesson | null>>()

function fetchLesson(id: string): Promise<SharedLesson | null> {
  const hit = cache.get(id)
  if (hit) return hit
  const p = (async () => {
    const { data, error } = await supabase
      .from('lessons')
      .select('id, title, duration_seconds, vimeo_id, position, cover_url, cover_url_light, cover_keyword, courses(categories(title, accent, phase, cover_url, section), lessons(id, position))')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) { cache.delete(id); return null }
    const r = data as unknown as Raw
    const cat = r.courses?.categories
    // Numero della lezione nel corso, come nelle pagine dei videocorsi.
    const siblings = (r.courses?.lessons ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const idx = siblings.findIndex(x => x.id === r.id)
    return {
      id: r.id,
      title: r.title,
      number: idx >= 0 ? idx + 1 : (r.position ?? 0) + 1,
      durationMin: Math.round((r.duration_seconds ?? 0) / 60),
      vimeoId: r.vimeo_id,
      coverUrl: r.cover_url ?? null,
      coverUrlLight: r.cover_url_light ?? null,
      coverKeyword: r.cover_keyword ?? null,
      section: cat?.title ?? '',
      sectionCover: cat?.cover_url ?? null,
      accent: cat?.accent ?? '#5A9AB1',
      phase: phaseLabel(cat?.phase ?? ''),
      mental: cat?.section === 'mental',
    }
  })()
  cache.set(id, p)
  return p
}

export function useSharedLesson(id: string | null | undefined) {
  const [state, setState] = useState<{ lesson: SharedLesson | null; loading: boolean }>({ lesson: null, loading: !!id })
  useEffect(() => {
    if (!id) { setState({ lesson: null, loading: false }); return }
    let alive = true
    setState(s => ({ ...s, loading: true }))
    fetchLesson(id).then(lesson => { if (alive) setState({ lesson, loading: false }) })
    return () => { alive = false }
  }, [id])
  return state
}

export const lessonHref = (id: string) => `/student/corsi/lezione/${id}`

export function VideoShareCardView({ lesson: l, compact, onOpen }: { lesson: SharedLesson; compact?: boolean; onOpen?: () => void }) {
  const navigate = useNavigate()
  const tone = useCoverTone()
  const light = tone === 'light' && !!l.coverUrlLight
  const open = (ev: React.MouseEvent) => { ev.stopPropagation(); if (onOpen) onOpen(); else navigate(lessonHref(l.id)) }
  return (
    <div
      onClick={open}
      role="button"
      className="media-card group block w-full text-left cursor-pointer rounded-2xl overflow-hidden"
      style={{ maxWidth: compact ? 300 : 420, background: 'var(--ist-w6)', border: '1px solid var(--ist-w10)' }}
    >
      <MediaThumb
        imageUrl={light ? l.coverUrlLight : l.coverUrl}
        tone={light ? 'light' : 'dark'}
        keyword={l.coverKeyword}
        kicker={`Lezione ${String(l.number).padStart(2, '0')}`}
        vimeoId={l.vimeoId}
        fallbackUrl={l.sectionCover}
        accent={l.accent}
        icon={phaseIcon(l.phase)}
        label={String(l.number).padStart(2, '0')}
        duration={l.durationMin > 0 ? `${l.durationMin} min` : undefined}
        rounded="rounded-none"
        thumbWidth={640}
      />
      <div className="px-3.5 pt-2.5 pb-3">
        <p className="text-[11px] font-semibold flex items-center gap-1.5 min-w-0" style={{ color: 'var(--ist-accent-text)' }}>
          <Clapperboard size={11} strokeWidth={2.4} className="flex-shrink-0" />
          <span className="truncate">{l.mental ? 'Mental Coach' : 'Videocorso'}{l.section ? ` · ${l.section}` : ''}</span>
        </p>
        <p className="text-sm font-bold leading-snug mt-1 line-clamp-2" style={{ color: 'var(--ist-text)' }}>{l.title}</p>
        <button
          onClick={open}
          className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-transform active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
        >
          <Play size={12} strokeWidth={2.6} fill="currentColor" />
          Guarda il video
        </button>
      </div>
    </div>
  )
}

export default function VideoShareCard({ lessonId, compact }: { lessonId: string; compact?: boolean }) {
  const { lesson, loading } = useSharedLesson(lessonId)
  if (loading) return <div className="rounded-2xl animate-pulse" style={{ width: compact ? 260 : 360, maxWidth: '100%', aspectRatio: '16 / 12', background: 'var(--ist-w6)' }} />
  if (!lesson) return <p className="text-xs italic px-1" style={{ color: 'var(--ist-text-dim)' }}>Questo video non è disponibile.</p>
  return <VideoShareCardView lesson={lesson} compact={compact} />
}
