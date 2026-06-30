import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Statistiche reali dell'attività dello studente ─────────────────────────────

export interface StudentStats {
  lessonsCompleted: number
  diaryCount: number
  diaryStreak: number        // giorni di diario consecutivi (fino a oggi/ieri)
  submissionsCount: number   // compiti consegnati
  reviewedCount: number      // compiti rivisti dal coach
  earnedCount: number
}

export interface Badge {
  id: string
  icon: string
  title: string
  desc: string
  earned: boolean
}

// Definizioni badge: regola pura sulle statistiche reali (nessun lavoro manuale).
interface BadgeDef {
  id: string; icon: string; title: string; desc: string
  rule: (s: Omit<StudentStats, 'earnedCount'>) => boolean
}

const BADGE_DEFS: BadgeDef[] = [
  { id: 'first-lesson', icon: '📚', title: 'Prima lezione', desc: 'Completa la prima lezione', rule: s => s.lessonsCompleted >= 1 },
  { id: 'studious',     icon: '🎓', title: 'Studioso',      desc: '10 lezioni completate',     rule: s => s.lessonsCompleted >= 10 },
  { id: 'first-diary',  icon: '📝', title: 'Primo trade',   desc: 'Prima voce nel diario',     rule: s => s.diaryCount >= 1 },
  { id: 'diarist',      icon: '📓', title: 'Diarista',      desc: '10 voci nel diario',        rule: s => s.diaryCount >= 10 },
  { id: 'streak-7',     icon: '🔥', title: '7 giorni di fila', desc: 'Diario per 7 giorni',    rule: s => s.diaryStreak >= 7 },
  { id: 'streak-30',    icon: '⚡', title: '30 giorni di fila', desc: 'Diario per 30 giorni',  rule: s => s.diaryStreak >= 30 },
  { id: 'first-task',   icon: '🎯', title: 'Primo compito', desc: 'Consegna il primo compito', rule: s => s.submissionsCount >= 1 },
  { id: 'task-passed',  icon: '✅', title: 'Compito rivisto', desc: 'Un compito rivisto dal coach', rule: s => s.reviewedCount >= 1 },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Streak = giorni consecutivi con almeno una voce, terminanti oggi o ieri.
function computeStreak(dates: string[]): number {
  const set = new Set(dates)
  const cursor = new Date()
  if (!set.has(isoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!set.has(isoDate(cursor))) return 0
  }
  let streak = 0
  while (set.has(isoDate(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudentBadges(userId: string) {
  const [stats, setStats] = useState<StudentStats>({
    lessonsCompleted: 0, diaryCount: 0, diaryStreak: 0,
    submissionsCount: 0, reviewedCount: 0, earnedCount: 0,
  })
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)

    const [lessonsRes, diaryRes, subsRes] = await Promise.all([
      supabase.from('lesson_progress').select('lesson_id').eq('user_id', userId).eq('completed', true),
      supabase.from('diary_entries').select('entry_date').eq('user_id', userId),
      supabase.from('submissions').select('status').eq('student_id', userId),
    ])

    const lessonsCompleted = lessonsRes.data?.length ?? 0
    const diaryDates = (diaryRes.data ?? []).map(d => d.entry_date as string)
    const diaryCount = diaryDates.length
    const diaryStreak = computeStreak(diaryDates)
    const subs = subsRes.data ?? []
    const submissionsCount = subs.length
    const reviewedCount = subs.filter(s => s.status === 'reviewed').length

    const base = { lessonsCompleted, diaryCount, diaryStreak, submissionsCount, reviewedCount }
    const computed = BADGE_DEFS.map(d => ({
      id: d.id, icon: d.icon, title: d.title, desc: d.desc, earned: d.rule(base),
    }))
    const earnedCount = computed.filter(b => b.earned).length

    setBadges(computed)
    setStats({ ...base, earnedCount })
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  return { stats, badges, loading, reload: load }
}
