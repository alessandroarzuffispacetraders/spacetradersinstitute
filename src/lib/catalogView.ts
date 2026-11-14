import type { Category, Course, Lesson } from './content'

// Viste "da catalogo" (stile Netflix) sopra l'albero categorie → corsi → lezioni.
// Funzioni pure: nessuna query, solo riorganizzano i dati già caricati.

export interface LessonEntry {
  lesson: Lesson
  course: Course
  category: Category
  number: number            // numero dell'episodio dentro il corso (1-based)
}

export function flattenLessons(categories: Category[]): LessonEntry[] {
  const out: LessonEntry[] = []
  for (const category of categories) {
    for (const course of category.courses) {
      course.lessons.forEach((lesson, i) => out.push({ lesson, course, category, number: i + 1 }))
    }
  }
  return out
}

// Sotto i 10 secondi è un'apertura per sbaglio, non una visione iniziata.
const STARTED_MIN_SECONDS = 10

export function isInProgress(l: Lesson): boolean {
  return !l.done && l.lastPositionSeconds >= STARTED_MIN_SECONDS
}

// Frazione vista (0..1) per la barra sotto la miniatura; 0 = niente barra.
export function watchedFraction(l: Lesson): number {
  if (l.done || !isInProgress(l) || l.durationSeconds <= 0) return 0
  return Math.min(0.97, Math.max(0.03, l.lastPositionSeconds / l.durationSeconds))
}

// Minuti mancanti, per "Mancano 12 min".
export function remainingLabel(l: Lesson): string | null {
  if (!isInProgress(l) || l.durationSeconds <= 0) return null
  const left = Math.max(1, Math.round((l.durationSeconds - l.lastPositionSeconds) / 60))
  return `Mancano ${left} min`
}

// Lezioni iniziate e non finite, dalla più recente.
export function continueWatching(entries: LessonEntry[], limit = 15): LessonEntry[] {
  return entries
    .filter(e => isInProgress(e.lesson))
    .sort((a, b) => (b.lesson.lastWatchedAt ?? '').localeCompare(a.lesson.lastWatchedAt ?? ''))
    .slice(0, limit)
}

export type ResumeMode = 'resume' | 'start' | 'next' | 'rewatch'

// Cosa proporre nel banner: la lezione lasciata a metà più recente; altrimenti
// la prima non completata (in ordine di percorso); se è tutto fatto, la prima.
export function pickResume(entries: LessonEntry[]): { entry: LessonEntry; mode: ResumeMode } | null {
  if (entries.length === 0) return null
  const inProgress = continueWatching(entries, 1)[0]
  if (inProgress) return { entry: inProgress, mode: 'resume' }
  const firstTodo = entries.findIndex(e => !e.lesson.done)
  if (firstTodo >= 0) {
    const anyDone = entries.some(e => e.lesson.done)
    return { entry: entries[firstTodo], mode: anyDone ? 'next' : 'start' }
  }
  return { entry: entries[0], mode: 'rewatch' }
}

export const RESUME_CTA: Record<ResumeMode, string> = {
  resume: 'Riprendi',
  start: 'Inizia',
  next: 'Guarda',
  rewatch: 'Rivedi',
}

export const RESUME_EYEBROW: Record<ResumeMode, string> = {
  resume: 'Continua a guardare',
  start: 'Inizia da qui',
  next: 'Prossima lezione',
  rewatch: 'Percorso completato',
}
