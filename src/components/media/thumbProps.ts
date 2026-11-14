import { Radio } from 'lucide-react'
import type { Category, Lesson } from '../../lib/content'
import { LiveEvent, liveDurationLabel } from '../../lib/live'
import { watchedFraction } from '../../lib/catalogView'
import type { MediaThumbProps } from './MediaThumb'
import { phaseIcon } from './phase'

// Props di MediaThumb per lezioni e live, uguali in ogni pagina: copertina AI
// (con parola chiave) → miniatura Vimeo → copertina della categoria → copertina
// generata dal colore. Le pagine possono sovrascrivere singoli campi.

const pad2 = (n: number) => String(n).padStart(2, '0')

// tone 'light' (tema chiaro dell'utente): usa la versione chiara della copertina,
// se esiste; altrimenti resta tutto come nella versione scura.
export function lessonThumbProps(lesson: Lesson, category: Category, number: number, tone: 'dark' | 'light' = 'dark'): MediaThumbProps {
  const light = tone === 'light' && !!lesson.coverUrlLight
  return {
    imageUrl: light ? lesson.coverUrlLight : lesson.coverUrl,
    tone: light ? 'light' : 'dark',
    keyword: lesson.coverKeyword,
    kicker: `Lezione ${pad2(number)}`,
    vimeoId: lesson.vimeoId,
    fallbackUrl: category.coverUrl,
    accent: category.accent,
    icon: phaseIcon(category.phase),
    label: pad2(number),
    progress: watchedFraction(lesson),
    done: lesson.done,
    duration: lesson.durationSeconds > 0 ? lesson.duration : undefined,
  }
}

export function liveThumbProps(event: LiveEvent, tone: 'dark' | 'light' = 'dark'): MediaThumbProps {
  const light = tone === 'light' && !!event.coverUrlLight
  return {
    imageUrl: light ? event.coverUrlLight : event.coverUrl,
    tone: light ? 'light' : 'dark',
    keyword: event.coverKeyword,
    kicker: event.status === 'replay' ? 'Replay' : 'Live',
    vimeoId: event.replayVimeoId,
    accent: event.accent,
    accentEnd: event.accentEnd,
    icon: Radio,
    duration: liveDurationLabel(event) || undefined,
  }
}
