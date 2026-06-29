import { useState } from 'react'
import { Loader2, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import ExerciseImage from '../../components/ui/ExerciseImage'
import { useAuth } from '../../context/AuthContext'
import { useAssignedStudents } from '../../lib/coaching'
import { useCoachAssignments, displayStatus, Assignment, Submission } from '../../lib/assignments'

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)',
  borderRadius: 16, color: '#F7FAFC', outline: 'none', width: '100%',
}

const STATUS_STYLE: Record<string, { label: string; css: React.CSSProperties }> = {
  assigned:  { label: 'Assegnato',  css: { color: '#7CBBD0', background: 'rgba(124,187,208,0.14)', border: '1px solid rgba(124,187,208,0.24)' } },
  submitted: { label: 'Da rivedere', css: { color: '#F6C85F', background: 'rgba(246,200,95,0.14)',  border: '1px solid rgba(246,200,95,0.24)' } },
  reviewed:  { label: 'Rivisto',    css: { color: '#46D39A', background: 'rgba(70,211,154,0.14)',  border: '1px solid rgba(70,211,154,0.24)' } },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

// ─── Assign form ─────────────────────────────────────────────────────────────

function AssignForm({ students, onCreate, onClose }: {
  students: { id: string; name: string }[]
  onCreate: (studentId: string, title: string, description: string, dueAt?: string | null) => Promise<boolean>
  onClose: () => void
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!studentId || !title.trim() || saving) return
    setSaving(true)
    const ok = await onCreate(studentId, title, description, dueAt || null)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Card className="p-5 mb-4">
      <h3 className="text-sm font-semibold text-white mb-4">Nuovo compito</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>Studente</label>
          <select value={studentId} onChange={e => setStudentId(e.target.value)} className="px-3 py-2.5 text-sm" style={inputStyle}>
            {students.length === 0 && <option value="">Nessuno studente assegnato</option>}
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>Scadenza (facoltativa)</label>
          <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className="px-3 py-2.5 text-sm" style={inputStyle} />
        </div>
      </div>
      <div className="mb-3">
        <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>Titolo</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Analizza 3 setup sul grafico H1" className="px-3 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
      </div>
      <div className="mb-4">
        <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>Descrizione / istruzioni</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Cosa deve fare lo studente..." className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none" style={inputStyle} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit} disabled={saving || !studentId || !title.trim()}
          className="px-4 py-2 text-white text-xs font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', border: '1px solid var(--ist-w14)' }}
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Assegna
        </button>
        <button onClick={onClose} className="px-4 py-2 text-xs rounded-full" style={{ color: '#8495A3' }}>Annulla</button>
      </div>
    </Card>
  )
}

// ─── Submission review ───────────────────────────────────────────────────────

function SubmissionReview({ sub, assignmentId, onReview }: {
  sub: Submission
  assignmentId: string
  onReview: (submissionId: string, assignmentId: string, feedback: string, blocked: boolean) => Promise<boolean>
}) {
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const studentImgs = (sub.submission_files ?? []).filter(f => f.kind === 'student')

  const send = async (blocked: boolean) => {
    if (saving) return
    setSaving(true)
    await onReview(sub.id, assignmentId, feedback, blocked)
    setSaving(false)
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}>
      <p className="text-[11px] mb-2" style={{ color: 'var(--ist-text-dim)' }}>Consegna del {fmtDate(sub.submitted_at)}</p>
      {sub.note && <p className="text-sm mb-3" style={{ color: '#C7D3DD' }}>{sub.note}</p>}

      {studentImgs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {studentImgs.map(f => (
            <ExerciseImage key={f.id} objectKey={f.object_key} className="w-28 h-28 rounded-lg object-cover" style={{ border: '1px solid var(--ist-border)' }} />
          ))}
        </div>
      )}

      {sub.status === 'pending' ? (
        <div>
          <textarea
            value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
            placeholder="Scrivi il feedback per lo studente..."
            className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none mb-3" style={inputStyle}
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => send(false)} disabled={saving || !feedback.trim()}
              className="px-4 py-2 text-white text-xs font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', border: '1px solid var(--ist-w14)' }}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Invia feedback
            </button>
            <button
              onClick={() => send(true)} disabled={saving || !feedback.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-full transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,107,122,0.12)', color: '#FF6B7A', border: '1px solid rgba(255,107,122,0.22)' }}
            >
              Feedback + segnala bloccato
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'var(--ist-text-dim)' }}>
            L'annotazione a mano libera sulle immagini arriva nel prossimo step.
          </p>
        </div>
      ) : (
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={13} strokeWidth={2} style={{ color: '#46D39A' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--ist-text)' }}>Feedback inviato</span>
            {sub.blocked && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ color: '#FF6B7A', background: 'rgba(255,107,122,0.14)', border: '1px solid rgba(255,107,122,0.24)' }}>
                <AlertTriangle size={10} strokeWidth={2.5} /> Bloccato
              </span>
            )}
          </div>
          {sub.coach_feedback && <p className="text-sm" style={{ color: '#C7D3DD' }}>{sub.coach_feedback}</p>}
        </div>
      )}
    </div>
  )
}

function AssignmentRow({ assignment, onReview, onDelete }: {
  assignment: Assignment
  onReview: (submissionId: string, assignmentId: string, feedback: string, blocked: boolean) => Promise<boolean>
  onDelete: (id: string) => void
}) {
  const status = displayStatus(assignment)
  const st = STATUS_STYLE[status]
  const submissions = assignment.submissions ?? []

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-white text-sm">{assignment.title}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={st.css}>{st.label}</span>
          </div>
          <p className="text-xs mb-2" style={{ color: '#8495A3' }}>
            {assignment.student?.name ?? 'Studente'} · {fmtDate(assignment.created_at)}
            {assignment.due_at && <> · scadenza {fmtDate(assignment.due_at)}</>}
          </p>
          {assignment.description && <p className="text-sm" style={{ color: '#C7D3DD' }}>{assignment.description}</p>}
        </div>
        <button
          onClick={() => { if (confirm(`Eliminare il compito "${assignment.title}"?`)) onDelete(assignment.id) }}
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-red-500/10"
          style={{ color: '#FF6B7A' }}
          title="Elimina compito"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>

      {submissions.length > 0 ? (
        <div className="mt-4 space-y-2">
          {submissions.map(s => <SubmissionReview key={s.id} sub={s} assignmentId={assignment.id} onReview={onReview} />)}
        </div>
      ) : (
        <p className="text-xs mt-3" style={{ color: 'var(--ist-text-dim)' }}>In attesa della consegna dello studente.</p>
      )}
    </Card>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CoachReview() {
  const { user } = useAuth()
  const coachId = user?.id ?? ''
  const { students } = useAssignedStudents('coach', coachId)
  const { assignments, loading, createAssignment, deleteAssignment, reviewSubmission } = useCoachAssignments(coachId)
  const [assigning, setAssigning] = useState(false)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Compiti"
        subtitle="Assegna esercizi e rivedi le consegne dei tuoi studenti"
        action={
          <button
            onClick={() => setAssigning(v => !v)}
            className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <Plus size={15} strokeWidth={2.5} /> Nuovo compito
          </button>
        }
      />

      {assigning && (
        <AssignForm
          students={students.map(s => ({ id: s.id, name: s.name }))}
          onCreate={createAssignment}
          onClose={() => setAssigning(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : assignments.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            Nessun compito assegnato. Usa "Nuovo compito" per assegnarne uno ai tuoi studenti.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <AssignmentRow key={a.id} assignment={a} onReview={reviewSubmission} onDelete={deleteAssignment} />
          ))}
        </div>
      )}
    </div>
  )
}
