import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AssignmentStatus = 'assigned' | 'submitted' | 'reviewed'
export type SubmissionStatus = 'pending' | 'reviewed'

export interface SubmissionFile {
  id: string
  submission_id: string
  uploaded_by: string
  kind: 'student' | 'coach_markup'
  object_key: string
  source_file_id: string | null
  created_at: string
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  note: string | null
  status: SubmissionStatus
  coach_feedback: string | null
  blocked: boolean
  submitted_at: string
  reviewed_at: string | null
  submission_files?: SubmissionFile[]
}

export interface Assignment {
  id: string
  coach_id: string
  student_id: string
  title: string
  description: string
  status: AssignmentStatus
  due_at: string | null
  created_at: string
  student?: { name: string } | null
  coach?: { name: string } | null
  submissions?: Submission[]
}

// Display status is derived: the student can't write the 'submitted' status
// (RLS), so we infer it from the presence of submissions.
export function displayStatus(a: Assignment): AssignmentStatus {
  if (a.status === 'reviewed') return 'reviewed'
  if ((a.submissions?.length ?? 0) > 0) return 'submitted'
  return 'assigned'
}

// ─── Storage (private 'exercise-files' bucket; path = <uploaderId>/...) ──────────

const BUCKET = 'exercise-files'

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'image'
}

export async function uploadExerciseFile(uploaderId: string, file: File | Blob, name: string): Promise<string | null> {
  const path = `${uploaderId}/${crypto.randomUUID()}-${safeName(name)}`
  const contentType = file instanceof File ? (file.type || 'image/png') : 'image/png'
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType, upsert: false })
  return error ? null : path
}

export async function exerciseFileUrl(objectKey: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(objectKey, 3600)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

// Download the bytes (for the annotator): a blob: URL is same-origin, so the
// canvas stays untainted and can be exported to PNG.
export async function downloadExerciseBlob(objectKey: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(objectKey)
  if (error || !data) return null
  return data
}

const ASSIGNMENT_SELECT = '*, submissions(*, submission_files(*))'

// ─── Coach side ─────────────────────────────────────────────────────────────────

export function useCoachAssignments(coachId: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  // silent=true skips the full-page spinner (so an in-progress feedback textarea
  // isn't unmounted when a markup upload triggers a refresh).
  const load = useCallback(async (silent = false) => {
    if (!coachId) { setLoading(false); return }
    if (!silent) setLoading(true)
    const { data } = await supabase
      .from('assignments')
      .select(`${ASSIGNMENT_SELECT}, student:student_id(name)`)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
    setAssignments((data as Assignment[]) ?? [])
    if (!silent) setLoading(false)
  }, [coachId])

  useEffect(() => { load() }, [load])

  const createAssignment = useCallback(async (studentId: string, title: string, description: string, dueAt?: string | null): Promise<boolean> => {
    if (!coachId || !studentId || !title.trim()) return false
    const { error } = await supabase.from('assignments').insert({
      coach_id: coachId, student_id: studentId,
      title: title.trim(), description: description.trim(), due_at: dueAt || null,
    })
    if (!error) await load()
    return !error
  }, [coachId, load])

  const deleteAssignment = useCallback(async (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id))
    await supabase.from('assignments').delete().eq('id', id)
  }, [])

  // Coach review: feedback text + blocked flag; marks submission + assignment reviewed.
  const reviewSubmission = useCallback(async (submissionId: string, assignmentId: string, feedback: string, blocked: boolean): Promise<boolean> => {
    const { error } = await supabase.from('submissions').update({
      coach_feedback: feedback.trim() || null,
      blocked,
      status: 'reviewed',
      reviewed_at: new Date().toISOString(),
    }).eq('id', submissionId)
    if (error) return false
    await supabase.from('assignments').update({ status: 'reviewed' }).eq('id', assignmentId)
    await load()
    return true
  }, [load])

  // Upload a freehand-annotated image (PNG blob) as a coach markup (Phase C5d).
  const addMarkup = useCallback(async (submissionId: string, blob: Blob, sourceFileId: string | null): Promise<boolean> => {
    if (!coachId) return false
    const key = await uploadExerciseFile(coachId, blob, 'markup.png')
    if (!key) return false
    const { error } = await supabase.from('submission_files').insert({
      submission_id: submissionId, uploaded_by: coachId, kind: 'coach_markup',
      object_key: key, source_file_id: sourceFileId,
    })
    if (!error) await load(true)   // silent: keep the open review form intact
    return !error
  }, [coachId, load])

  return { assignments, loading, createAssignment, deleteAssignment, reviewSubmission, addMarkup, reload: load }
}

// ─── Student side ───────────────────────────────────────────────────────────────

export function useStudentAssignments(studentId: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!studentId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('assignments')
      .select(`${ASSIGNMENT_SELECT}, coach:coach_id(name)`)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    setAssignments((data as Assignment[]) ?? [])
    setLoading(false)
  }, [studentId])

  useEffect(() => { load() }, [load])

  // Create a submission (note) and upload the student's images.
  const submit = useCallback(async (assignmentId: string, note: string, files: File[]): Promise<boolean> => {
    if (!studentId) return false
    const { data: sub, error } = await supabase.from('submissions').insert({
      assignment_id: assignmentId, student_id: studentId, note: note.trim() || null, status: 'pending',
    }).select().single()
    if (error || !sub) return false

    for (const f of files) {
      const key = await uploadExerciseFile(studentId, f, f.name)
      if (key) {
        await supabase.from('submission_files').insert({
          submission_id: sub.id, uploaded_by: studentId, kind: 'student', object_key: key,
        })
      }
    }
    await load()
    return true
  }, [studentId, load])

  return { assignments, loading, submit, reload: load }
}
