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
  vimeoId: string | null    // raw Vimeo URL/id pasted by the admin (null if none)
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
  isFree: boolean           // categoria in vetrina: tutto il suo contenuto è
                            // accessibile all'utente gratuito (gating a cascata)
  courses: Course[]
}

// ─── Formatting helpers ─────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  onboarding: 'Onboarding', build: 'Build', test: 'Test', deploy: 'Deploy',
}

function phaseLabel(p: string): string {
  return PHASE_LABEL[p] ?? p
}

// Reverse map: capitalized display label -> lowercase DB enum value.
const PHASE_TO_DB: Record<string, string> = {
  Onboarding: 'onboarding', Build: 'build', Test: 'test', Deploy: 'deploy',
}

function phaseToDb(p: string): string {
  return PHASE_TO_DB[p] ?? p.toLowerCase()
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
  duration_seconds: number; vimeo_id: string | null; published: boolean
  position: number; attachments: RawAttachment[] | null
}
interface RawCourse {
  id: string; category_id: string; title: string; description: string
  phase: string; published: boolean; position: number; lessons: RawLesson[] | null
}
interface RawCategory {
  id: string; title: string; description: string; accent: string
  phase: string; published: boolean; is_free: boolean; position: number; courses: RawCourse[] | null
}

const SELECT = `
  id, title, description, accent, phase, published, is_free, position,
  courses (
    id, category_id, title, description, phase, published, position,
    lessons (
      id, course_id, title, description, duration_seconds, vimeo_id, published, position,
      attachments ( id, lesson_id, name, type, size_bytes, object_key, position )
    )
  )
`

function byPosition<T extends { position: number }>(a: T, b: T) {
  return a.position - b.position
}

// Build the coursesData-shaped tree from raw rows, merging per-student progress
// (pass an empty Map for the admin view, where completion is irrelevant).
function buildTree(
  rawCats: RawCategory[] | null,
  progress: Map<string, { done: boolean; pos: number }>,
): Category[] {
  return (rawCats ?? [])
    .slice()
    .sort(byPosition)
    .map(cat => ({
      id: cat.id,
      title: cat.title,
      description: cat.description,
      accent: cat.accent,
      phase: phaseLabel(cat.phase),
      published: cat.published,
      isFree: cat.is_free ?? false,
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
                vimeoId: les.vimeo_id,
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

    setCategories(buildTree(rawCats as RawCategory[] | null, progress))
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

// ─── Admin catalog hook (CRUD + reorder) ────────────────────────────────────────
// Reads the full tree (an admin sees drafts too via RLS) and exposes mutations.
// `phase` is passed in/out capitalized; converted to the lowercase DB enum here.

export interface CategoryInput { title: string; description: string; accent: string; phase: string }
export interface CourseInput   { title: string; description: string; phase: string }
export interface LessonInput   { title: string; description: string; durationMinutes: number; vimeoId?: string }

type ContentTable = 'categories' | 'courses' | 'lessons'

export function useContentAdmin() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // silent=true skips the full-page spinner (used after mutations).
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { data } = await supabase.from('categories').select(SELECT)
    setCategories(buildTree(data as RawCategory[] | null, new Map()))
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ---- categories ----
  const createCategory = useCallback(async (input: CategoryInput): Promise<boolean> => {
    const { error } = await supabase.from('categories').insert({
      title: input.title.trim(), description: input.description.trim(),
      accent: input.accent, phase: phaseToDb(input.phase),
      position: categories.length, published: false,
    })
    if (!error) await load(true)
    return !error
  }, [categories.length, load])

  const updateCategory = useCallback(async (id: string, input: CategoryInput): Promise<boolean> => {
    const { error } = await supabase.from('categories').update({
      title: input.title.trim(), description: input.description.trim(),
      accent: input.accent, phase: phaseToDb(input.phase),
    }).eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  // ---- courses ----
  const createCourse = useCallback(async (categoryId: string, input: CourseInput): Promise<boolean> => {
    const cat = categories.find(c => c.id === categoryId)
    const { error } = await supabase.from('courses').insert({
      category_id: categoryId, title: input.title.trim(), description: input.description.trim(),
      phase: phaseToDb(input.phase), position: cat?.courses.length ?? 0, published: false,
    })
    if (!error) await load(true)
    return !error
  }, [categories, load])

  const updateCourse = useCallback(async (id: string, input: CourseInput): Promise<boolean> => {
    const { error } = await supabase.from('courses').update({
      title: input.title.trim(), description: input.description.trim(), phase: phaseToDb(input.phase),
    }).eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  const deleteCourse = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  // ---- lessons ----
  const createLesson = useCallback(async (courseId: string, input: LessonInput): Promise<boolean> => {
    let count = 0
    for (const c of categories) {
      const crs = c.courses.find(x => x.id === courseId)
      if (crs) { count = crs.lessons.length; break }
    }
    const { error } = await supabase.from('lessons').insert({
      course_id: courseId, title: input.title.trim(), description: input.description.trim(),
      duration_seconds: Math.max(0, Math.round(input.durationMinutes * 60)),
      vimeo_id: input.vimeoId?.trim() || null,
      position: count, published: true,
    })
    if (!error) await load(true)
    return !error
  }, [categories, load])

  const updateLesson = useCallback(async (id: string, input: LessonInput): Promise<boolean> => {
    const { error } = await supabase.from('lessons').update({
      title: input.title.trim(), description: input.description.trim(),
      duration_seconds: Math.max(0, Math.round(input.durationMinutes * 60)),
      vimeo_id: input.vimeoId?.trim() || null,
    }).eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  const deleteLesson = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('lessons').delete().eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  // ---- publish toggle (any level) ----
  const setPublished = useCallback(async (table: ContentTable, id: string, published: boolean): Promise<boolean> => {
    const { error } = await supabase.from(table).update({ published }).eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  // ---- "gratis" toggle a livello di CATEGORIA: rende l'intera categoria (e tutto
  // il suo contenuto, a cascata) accessibile all'utente gratuito ----
  const setFree = useCallback(async (id: string, isFree: boolean): Promise<boolean> => {
    const { error } = await supabase.from('categories').update({ is_free: isFree }).eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  // ---- reorder: renormalize the whole sibling list to 0..n in the new order ----
  const move = useCallback(async (table: ContentTable, siblings: { id: string }[], id: string, dir: 'up' | 'down'): Promise<boolean> => {
    const idx = siblings.findIndex(s => s.id === id)
    const j = dir === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || j < 0 || j >= siblings.length) return false
    const ordered = siblings.slice()
    ;[ordered[idx], ordered[j]] = [ordered[j], ordered[idx]]
    const results = await Promise.all(
      ordered.map((s, i) => supabase.from(table).update({ position: i }).eq('id', s.id)),
    )
    if (results.some(r => r.error)) return false
    await load(true)
    return true
  }, [load])

  const moveCategory = useCallback((id: string, dir: 'up' | 'down') =>
    move('categories', categories, id, dir), [move, categories])

  const moveCourse = useCallback((categoryId: string, id: string, dir: 'up' | 'down') => {
    const cat = categories.find(c => c.id === categoryId)
    return cat ? move('courses', cat.courses, id, dir) : Promise.resolve(false)
  }, [move, categories])

  const moveLesson = useCallback((courseId: string, id: string, dir: 'up' | 'down') => {
    for (const c of categories) {
      const crs = c.courses.find(x => x.id === courseId)
      if (crs) return move('lessons', crs.lessons, id, dir)
    }
    return Promise.resolve(false)
  }, [move, categories])

  return {
    categories, loading, reload: () => load(true),
    createCategory, updateCategory, deleteCategory,
    createCourse, updateCourse, deleteCourse,
    createLesson, updateLesson, deleteLesson,
    setPublished, setFree, moveCategory, moveCourse, moveLesson,
  }
}
