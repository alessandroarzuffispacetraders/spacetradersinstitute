import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { StudentPhase, StudentStatus } from '../types'
import { useIsPreview } from './previewMode'

// ─── Assigned students (coach / mental coach) ───────────────────────────────────

export interface AssignedStudent {
  id: string
  name: string
  email: string
  phase: StudentPhase | null
  status: StudentStatus | null
  diaryCount: number
}

export function useAssignedStudents(role: 'coach' | 'mental_coach', myId: string) {
  const [students, setStudents] = useState<AssignedStudent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!myId) { setLoading(false); return }
    const column = role === 'coach' ? 'assigned_coach_id' : 'assigned_mental_coach_id'
    setLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, phase, status')
        .eq(column, myId)
        .order('name', { ascending: true })

      const base = (data ?? []) as Omit<AssignedStudent, 'diaryCount'>[]
      const withCounts = await Promise.all(base.map(async (s) => {
        const { count } = await supabase
          .from('diary_entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', s.id)
        return { ...s, diaryCount: count ?? 0 }
      }))
      setStudents(withCounts)
      setLoading(false)
    })()
  }, [role, myId])

  return { students, loading }
}

// ─── Mental coach private notes ─────────────────────────────────────────────────

export interface MentalNote {
  id: string
  mental_coach_id: string
  student_id: string
  content: string
  created_at: string
  updated_at: string
  student?: { name: string } | null
}

export function useMentalNotes(myId: string, studentId?: string) {
  const [notes, setNotes] = useState<MentalNote[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!myId) { setLoading(false); return }
    setLoading(true)
    let q = supabase
      .from('mental_coach_notes')
      .select('*, student:student_id(name)')
      .eq('mental_coach_id', myId)
      .order('updated_at', { ascending: false })
    if (studentId) q = q.eq('student_id', studentId)
    const { data } = await q
    setNotes((data as MentalNote[]) ?? [])
    setLoading(false)
  }, [myId, studentId])

  useEffect(() => { load() }, [load])

  const addNote = useCallback(async (student_id: string, content: string) => {
    if (!myId || !content.trim()) return false
    const { error } = await supabase.from('mental_coach_notes').insert({
      mental_coach_id: myId, student_id, content: content.trim(),
    })
    if (!error) await load()
    return !error
  }, [myId, load])

  const updateNote = useCallback(async (id: string, content: string) => {
    if (!content.trim()) return false
    const { error } = await supabase.from('mental_coach_notes').update({ content: content.trim() }).eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  const deleteNote = useCallback(async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
    await supabase.from('mental_coach_notes').delete().eq('id', id)
  }, [])

  return { notes, loading, addNote, updateNote, deleteNote, reload: load }
}

// ─── Mental coach sessions ──────────────────────────────────────────────────────

export type SessionStatus = 'scheduled' | 'completed' | 'pending' | 'cancelled'

export interface MentalSession {
  id: string
  student_id: string
  mental_coach_id: string
  session_number: number
  type: string
  status: SessionStatus
  scheduled_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  student?: { name: string } | null
}

// Coach view: all sessions for the mental coach, with student name
export function useMentalSessions(myId: string) {
  const [sessions, setSessions] = useState<MentalSession[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!myId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('mental_coach_sessions')
      .select('*, student:student_id(name)')
      .eq('mental_coach_id', myId)
      .order('session_number', { ascending: true })
    setSessions((data as MentalSession[]) ?? [])
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  const upsertSession = useCallback(async (
    student_id: string,
    session_number: number,
    fields: Partial<Pick<MentalSession, 'status' | 'scheduled_at' | 'completed_at' | 'notes' | 'type'>>,
  ) => {
    if (!myId) return false
    const existing = sessions.find(s => s.student_id === student_id && s.session_number === session_number)
    if (existing) {
      const { error } = await supabase.from('mental_coach_sessions').update(fields).eq('id', existing.id)
      if (!error) await load()
      return !error
    }
    const { error } = await supabase.from('mental_coach_sessions').insert({
      mental_coach_id: myId, student_id, session_number, ...fields,
    })
    if (!error) await load()
    return !error
  }, [myId, sessions, load])

  return { sessions, loading, upsertSession, reload: load }
}

// Student view: own sessions (read-only)
// Dati FINTI per l'anteprima (vedi previewMode).
const PREVIEW_SESSIONS: MentalSession[] = [
  { id: 'pv-m1', student_id: 'pv-s', mental_coach_id: 'pv-mc', session_number: 1, type: 'valutazione', status: 'completed', scheduled_at: null, completed_at: '2026-06-03T10:00:00Z', notes: null, created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-03T10:00:00Z' },
  { id: 'pv-m2', student_id: 'pv-s', mental_coach_id: 'pv-mc', session_number: 2, type: 'follow-up', status: 'scheduled', scheduled_at: '2026-07-15T18:00:00Z', completed_at: null, notes: null, created_at: '2026-06-03T10:00:00Z', updated_at: '2026-06-03T10:00:00Z' },
]

export function useStudentSessions(studentId: string) {
  const preview = useIsPreview()
  const [sessions, setSessions] = useState<MentalSession[]>(preview ? PREVIEW_SESSIONS : [])
  const [loading, setLoading] = useState(!preview)

  useEffect(() => {
    if (preview) return
    if (!studentId) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('mental_coach_sessions')
      .select('*')
      .eq('student_id', studentId)
      .order('session_number', { ascending: true })
      .then(({ data }) => {
        setSessions((data as MentalSession[]) ?? [])
        setLoading(false)
      })
  }, [studentId, preview])

  return { sessions, loading }
}

// ─── Student flags (coach segnalazioni) ─────────────────────────────────────────

export type FlagSeverity = 'high' | 'medium'

export interface StudentFlag {
  id: string
  coach_id: string             // AUTORE (coach oppure admin)
  recipient_id: string | null  // destinatario staff (segnalazioni admin→coach/mental)
  student_id: string | null
  issue: string
  severity: FlagSeverity
  resolved: boolean
  resolved_at: string | null
  created_at: string
  student?: { name: string } | null
  author?: { name: string } | null
  recipient?: { name: string } | null
}

export function useCoachFlags(myId: string) {
  const [flags, setFlags] = useState<StudentFlag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!myId) { setLoading(false); return }
    setLoading(true)
    // Segnalazioni che il coach ha CREATO sui propri studenti (recipient nullo).
    const { data } = await supabase
      .from('student_flags')
      .select('*, student:student_id(name)')
      .eq('coach_id', myId)
      .is('recipient_id', null)
      .order('created_at', { ascending: false })
    setFlags((data as StudentFlag[]) ?? [])
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  const addFlag = useCallback(async (student_id: string, issue: string, severity: FlagSeverity) => {
    if (!myId || !issue.trim()) return false
    const { error } = await supabase.from('student_flags').insert({
      coach_id: myId, student_id, issue: issue.trim(), severity,
    })
    if (!error) await load()
    return !error
  }, [myId, load])

  const resolveFlag = useCallback(async (id: string) => {
    const { error } = await supabase.from('student_flags')
      .update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', id)
    if (!error) await load()
  }, [load])

  const deleteFlag = useCallback(async (id: string) => {
    setFlags(prev => prev.filter(f => f.id !== id))
    await supabase.from('student_flags').delete().eq('id', id)
  }, [])

  return { flags, loading, addFlag, resolveFlag, deleteFlag, reload: load }
}

// ─── Segnalazioni RICEVUTE (coach/mental: inviate dall'admin) ────────────────────

export function useIncomingFlags(myId: string) {
  const [flags, setFlags] = useState<StudentFlag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!myId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('student_flags')
      .select('*, student:student_id(name), author:coach_id(name)')
      .eq('recipient_id', myId)
      .order('resolved', { ascending: true })
      .order('created_at', { ascending: false })
    setFlags((data as StudentFlag[]) ?? [])
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  // Realtime: le nuove segnalazioni ricevute compaiono senza refresh.
  useEffect(() => {
    if (!myId) return
    const ch = supabase
      .channel(`incoming-flags-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_flags', filter: `recipient_id=eq.${myId}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId, load])

  // Il destinatario può segnare risolta/non risolta (RLS: recipient).
  const setResolved = useCallback(async (id: string, resolved: boolean): Promise<boolean> => {
    const { error } = await supabase.from('student_flags')
      .update({ resolved, resolved_at: resolved ? new Date().toISOString() : null }).eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  return { flags, loading, setResolved, reload: load }
}

// ─── Admin: vista di TUTTE le segnalazioni + crea/invia + risolvi/elimina ────────

export type AdminFlag = StudentFlag

export function useAdminFlags() {
  const [flags, setFlags] = useState<AdminFlag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('student_flags')
      .select('*, student:student_id(name), author:coach_id(name), recipient:recipient_id(name)')
      // aperte prima delle risolte, poi più recenti in cima
      .order('resolved', { ascending: true })
      .order('created_at', { ascending: false })
    setFlags((data as AdminFlag[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime: le nuove segnalazioni compaiono senza refresh.
  useEffect(() => {
    const ch = supabase
      .channel('admin-flags')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_flags' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // Crea e invia una segnalazione a un coach/mental (studente opzionale).
  const addAdminFlag = useCallback(async (
    recipientId: string, studentId: string | null, issue: string, severity: FlagSeverity,
  ): Promise<boolean> => {
    if (!recipientId || !issue.trim()) return false
    const { data: u } = await supabase.auth.getUser()
    const adminId = u.user?.id
    if (!adminId) return false
    const { error } = await supabase.from('student_flags').insert({
      coach_id: adminId, recipient_id: recipientId, student_id: studentId || null,
      issue: issue.trim(), severity,
    })
    if (!error) await load()
    return !error
  }, [load])

  const setResolved = useCallback(async (id: string, resolved: boolean): Promise<boolean> => {
    const { error } = await supabase.from('student_flags')
      .update({ resolved, resolved_at: resolved ? new Date().toISOString() : null }).eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  const deleteFlag = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('student_flags').delete().eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  return { flags, loading, reload: load, addAdminFlag, setResolved, deleteFlag }
}

// ─── Rubrica staff/studenti (per i menu delle segnalazioni admin) ───────────────

export interface DirEntry { id: string; name: string }

export function useStaffDirectory() {
  const [coaches, setCoaches] = useState<DirEntry[]>([])
  const [mentals, setMentals] = useState<DirEntry[]>([])
  const [students, setStudents] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.from('profiles_public').select('id,name,role,roles').order('name').then(({ data }) => {
      if (!active) return
      const rows = (data ?? []) as { id: string; name: string; role: string; roles: string[] | null }[]
      const has = (u: typeof rows[number], r: string) => u.role === r || (u.roles ?? []).includes(r)
      setCoaches(rows.filter(u => has(u, 'coach')).map(u => ({ id: u.id, name: u.name })))
      setMentals(rows.filter(u => has(u, 'mental_coach')).map(u => ({ id: u.id, name: u.name })))
      setStudents(rows.filter(u => has(u, 'student')).map(u => ({ id: u.id, name: u.name })))
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { coaches, mentals, students, loading }
}

// ─── Exercise submissions + feedback (coach review) ─────────────────────────────

export interface ExerciseSubmission {
  id: string
  student_id: string
  lesson_id: string
  title: string
  content: string | null
  content_url: string | null
  status: 'pending' | 'reviewed'
  submitted_at: string
  reviewed_at: string | null
  student?: { name: string } | null
}

// Coach view: submissions of assigned students (RLS scopes rows to assigned coach)
export function useCoachSubmissions(myId: string) {
  const [submissions, setSubmissions] = useState<ExerciseSubmission[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!myId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('exercise_submissions')
      .select('*, student:student_id(name)')
      .order('submitted_at', { ascending: false })
    setSubmissions((data as ExerciseSubmission[]) ?? [])
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  const sendFeedback = useCallback(async (submissionId: string, text: string, blocked: boolean) => {
    if (!myId || !text.trim()) return false
    const { error } = await supabase.from('submission_feedback').insert({
      submission_id: submissionId, coach_id: myId, feedback_text: text.trim(), flagged_blocked: blocked,
    })
    if (error) return false
    await supabase.from('exercise_submissions')
      .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
      .eq('id', submissionId)
    await load()
    return true
  }, [myId, load])

  return { submissions, loading, sendFeedback }
}
