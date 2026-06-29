import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Public types (mirror the old coursesData shape so pages change minimally) ──
// `phase` is exposed capitalized ('Build', 'Test', …) to match PHASE_STYLE maps
// in the pages; the DB stores it lowercase.

export interface Attachment {
  id: string
  name: string
  type: 'pdf' | 'xlsx' | 'docx' | 'pptx' | 'zip'
  size: string              // formatted, e.g. "2.4 MB" (from size_bytes)
  objectKey: string | null  // R2 key; null until uploaded (Phase C4)
}

export interface Lesson {
  id: string
  courseId: string
  title: string
  description: string
  duration: string          // formatted, e.g. "18 min" (from duration_seconds)
  durationSeconds: number
  videoKey: string | null   // R2 key; null until uploaded (Phase C4)
  done: boolean             // per-student, from lesson_progress
  lastPositionSeconds: number
  attachments: Attachment[]
}

export interface Course {
  id: string
  categoryId: string
  title: string
  description: string
  phase: string
  published: boolean
  lessons: Lesson[]
}

export interface Category {
  id: string
  title: string
  description: string
  accent: string
  phase: string
  published: boolean
  courses: Course[]
}

// ─── Formatting helpers ─────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  onboarding: 'Onboarding', build: 'Build', test: 'Test', deploy: 'Deploy',
}

function phaseLabel(p: string): string {
  return PHASE_LABEL[p] ?? p
}

function formatDuration(seconds: number): string {
  const m = Math.max(0, Math.round(seconds / 60))
  return `${m} min`
}

function formatBytes(b: number): string {
  if (!b || b <= 0) return '—'
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`
  if (b >= 1_000) return `${Math.round(b / 1_000)} KB`
  return `${b} B`
}

// ─── Pure stats helpers (same contract as the old coursesData helpers) ──────────

export function getCategoryStats(cat: Category) {
  const all = cat.courses.flatMap(c => c.lessons)
  const done = all.filter(l => l.done).length
  return { total: all.length, done, pct: all.length ? Math.round((done / all.length) * 100) : 0 }
}

export function getCourseStats(course: Course) {
  const done = course.lessons.filter(l => l.done).length
  return { total: course.lessons.length, done, pct: course.lessons.length ? Math.round((done / course.lessons.length) * 100) : 0 }
}

// ─── Raw DB row shapes (nested select) ──────────────────────────────────────────

interface RawAttachment {
  id: string; lesson_id: string; name: string; type: Attachment['type']
  size_bytes: number; object_key: string | null; position: number
}
interface RawLesson {
  id: string; course_id: string; title: string; description: string
  duration_seconds: number; video_key: string | null; published: boolean
  position: number; attachments: RawAttachment[] | null
}
interface RawCourse {
  id: string; category_id: string; title: string; description: string
  phase: string; published: boolean; position: number; lessons: RawLesson[] | null
}
interface RawCategory {
  id: string; title: string; description: string; accent: string
  phase: string; published: boolean; position: number; courses: RawCourse[] | null
}

const SELECT = `
  id, title, description, accent, phase, published, position,
  courses (
    id, category_id, title, description, phase, published, position,
    lessons (
      id, course_id, title, description, duration_seconds, video_key, published, position,
      attachments ( id, lesson_id, name, type, size_bytes, object_key, position )
    )
  )
`

function byPosition<T extends { position: number }>(a: T, b: T) {
  return a.position - b.position
}

// ─── Student catalog hook ───────────────────────────────────────────────────────
// Fetches the published catalog (RLS gives an admin the full tree, incl. drafts)
// and merges per-student lesson_progress into a coursesData-shaped tree.

export function useStudentCatalog(userId: string) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data: rawCats }, progressRes] = await Promise.all([
      supabase.from('categories').select(SELECT),
      userId
        ? supabase.from('lesson_progress')
            .select('lesson_id, completed, last_position_seconds')
            .eq('user_id', userId)
        : Promise.resolve({ data: [] as { lesson_id: string; completed: boolean; last_position_seconds: number }[] }),
    ])

    const progress = new Map<string, { done: boolean; pos: number }>()
    for (const p of (progressRes.data ?? [])) {
      progress.set(p.lesson_id, { done: !!p.completed, pos: p.last_position_seconds ?? 0 })
    }

    const tree: Category[] = ((rawCats as RawCategory[] | null) ?? [])
      .slice()
      .sort(byPosition)
      .map(cat => ({
        id: cat.id,
        title: cat.title,
        description: cat.description,
        accent: cat.accent,
        phase: phaseLabel(cat.phase),
        published: cat.published,
        courses: (cat.courses ?? [])
          .slice()
          .sort(byPosition)
          .map(crs => ({
            id: crs.id,
            categoryId: crs.category_id,
            title: crs.title,
            description: crs.description,
            phase: phaseLabel(crs.phase),
            published: crs.published,
            lessons: (crs.lessons ?? [])
              .slice()
              .sort(byPosition)
              .map(les => {
                const pr = progress.get(les.id)
                return {
                  id: les.id,
                  courseId: les.course_id,
                  title: les.title,
                  description: les.description,
                  duration: formatDuration(les.duration_seconds),
                  durationSeconds: les.duration_seconds,
                  videoKey: les.video_key,
                  done: pr?.done ?? false,
                  lastPositionSeconds: pr?.pos ?? 0,
                  attachments: (les.attachments ?? [])
                    .slice()
                    .sort(byPosition)
                    .map(att => ({
                      id: att.id,
                      name: att.name,
                      type: att.type,
                      size: formatBytes(att.size_bytes),
                      objectKey: att.object_key,
                    })),
                }
              }),
          })),
      }))

    setCategories(tree)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const findCategory = useCallback(
    (id: string): Category | null => categories.find(c => c.id === id) ?? null,
    [categories],
  )

  const findLesson = useCallback(
    (lessonId: string): { lesson: Lesson; course: Course; category: Category } | null => {
      for (const cat of categories) {
        for (const crs of cat.courses) {
          const lesson = crs.lessons.find(l => l.id === lessonId)
          if (lesson) return { lesson, course: crs, category: cat }
        }
      }
      return null
    },
    [categories],
  )

  // Toggle completion for a lesson; optimistic local update + upsert.
  const markDone = useCallback(async (lessonId: string, done = true): Promise<boolean> => {
    if (!userId) return false
    const { error } = await supabase.from('lesson_progress').upsert({
      user_id: userId,
      lesson_id: lessonId,
      completed: done,
      completed_at: done ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,lesson_id' })
    if (error) return false
    setCategories(prev => prev.map(cat => ({
      ...cat,
      courses: cat.courses.map(crs => ({
        ...crs,
        lessons: crs.lessons.map(les => les.id === lessonId ? { ...les, done } : les),
      })),
    })))
    return true
  }, [userId])

  // Persist the resume point (called by the real player in Phase C4).
  const saveLastPosition = useCallback(async (lessonId: string, seconds: number): Promise<void> => {
    if (!userId) return
    await supabase.from('lesson_progress').upsert({
      user_id: userId,
      lesson_id: lessonId,
      last_position_seconds: Math.max(0, Math.round(seconds)),
    }, { onConflict: 'user_id,lesson_id' })
  }, [userId])

  return { categories, loading, findCategory, findLesson, getCategoryStats, getCourseStats, markDone, saveLastPosition, reload: load }
}
