import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { StudentPhase, StudentStatus } from '../types'

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
export function useStudentSessions(studentId: string) {
  const [sessions, setSessions] = useState<MentalSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [studentId])

  return { sessions, loading }
}

// ─── Student flags (coach segnalazioni) ─────────────────────────────────────────

export type FlagSeverity = 'high' | 'medium'

export interface StudentFlag {
  id: string
  coach_id: string
  student_id: string
  issue: string
  severity: FlagSeverity
  resolved: boolean
  resolved_at: string | null
  created_at: string
  student?: { name: string } | null
}

export function useCoachFlags(myId: string) {
  const [flags, setFlags] = useState<StudentFlag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!myId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('student_flags')
      .select('*, student:student_id(name)')
      .eq('coach_id', myId)
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

// ─── Admin: vista di TUTTE le segnalazioni (sola lettura) ───────────────────────
// L'admin supervisiona ma non gestisce: la RLS gli concede solo SELECT
// ("flags admin read all"). Resolve/delete restano in capo al coach proprietario.

export interface AdminFlag extends StudentFlag {
  coach?: { name: string } | null
}

export function useAdminFlags() {
  const [flags, setFlags] = useState<AdminFlag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('student_flags')
      .select('*, student:student_id(name), coach:coach_id(name)')
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

  return { flags, loading, reload: load }
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
