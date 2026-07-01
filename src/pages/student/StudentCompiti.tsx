import { useEffect, useState } from 'react'
import { Loader2, ImagePlus, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import ExerciseImage from '../../components/ui/ExerciseImage'
import ImageLightbox from '../../components/ui/ImageLightbox'
import { useAuth } from '../../context/AuthContext'
import { useStudentAssignments, displayStatus, Assignment, Submission } from '../../lib/assignments'

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)',
  borderRadius: 16, color: 'var(--ist-text)', outline: 'none', width: '100%',
}

const STATUS_STYLE: Record<string, { label: string; css: React.CSSProperties }> = {
  assigned:  { label: 'Da fare',     css: { color: '#7CBBD0', background: 'rgba(124,187,208,0.14)', border: '1px solid rgba(124,187,208,0.24)' } },
  submitted: { label: 'Consegnato',  css: { color: '#F6C85F', background: 'rgba(246,200,95,0.14)',  border: '1px solid rgba(246,200,95,0.24)' } },
  reviewed:  { label: 'Rivisto',     css: { color: '#46D39A', background: 'rgba(70,211,154,0.14)',  border: '1px solid rgba(70,211,154,0.24)' } },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Local preview for a not-yet-uploaded file.
function LocalThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url] = useState(() => URL.createObjectURL(file))
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover" style={{ border: '1px solid var(--ist-border)' }} />
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: '#FF6B7A', color: '#fff' }}
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </div>
  )
}

function SubmissionBlock({ sub }: { sub: Submission }) {
  const studentImgs = (sub.submission_files ?? []).filter(f => f.kind === 'student')
  const markups     = (sub.submission_files ?? []).filter(f => f.kind === 'coach_markup')
  const [lightbox, setLightbox] = useState<string | null>(null)
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>Consegna del {fmtDate(sub.submitted_at)}</span>
        {sub.status === 'reviewed'
          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={STATUS_STYLE.reviewed.css}>Rivista</span>
          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={STATUS_STYLE.submitted.css}>In attesa</span>}
      </div>

      {sub.note && <p className="text-sm mb-3" style={{ color: '#C7D3DD' }}>{sub.note}</p>}

      {studentImgs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {studentImgs.map(f => (
            <ExerciseImage
              key={f.id} objectKey={f.object_key} onClick={() => setLightbox(f.object_key)}
              className="w-24 h-24 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
              style={{ border: '1px solid var(--ist-border)' }}
            />
          ))}
        </div>
      )}

      {sub.status === 'reviewed' && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--ist-border)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 size={13} strokeWidth={2} style={{ color: '#46D39A' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--ist-text)' }}>Feedback del coach</span>
            {sub.blocked && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ color: '#FF6B7A', background: 'rgba(255,107,122,0.14)', border: '1px solid rgba(255,107,122,0.24)' }}>
                <AlertTriangle size={10} strokeWidth={2.5} /> Bloccato
              </span>
            )}
          </div>
          {sub.coach_feedback && <p className="text-sm" style={{ color: '#C7D3DD' }}>{sub.coach_feedback}</p>}
          {markups.length > 0 && (
            <>
              <p className="text-[11px] mt-3 mb-1.5" style={{ color: 'var(--ist-text-dim)' }}>Immagini corrette dal coach — tocca per ingrandire:</p>
              <div className="flex flex-wrap gap-2">
                {markups.map(f => (
                  <ExerciseImage
                    key={f.id} objectKey={f.object_key} onClick={() => setLightbox(f.object_key)}
                    className="w-28 h-28 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ border: '1px solid rgba(70,211,154,0.3)' }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {lightbox && <ImageLightbox objectKey={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}

function AssignmentCard({ assignment, onSubmit }: {
  assignment: Assignment
  onSubmit: (assignmentId: string, note: string, files: File[]) => Promise<boolean>
}) {
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)

  const status = displayStatus(assignment)
  const st = STATUS_STYLE[status]
  const submissions = assignment.submissions ?? []

  const handleSubmit = async () => {
    if (sending || (!note.trim() && files.length === 0)) return
    setSending(true)
    const ok = await onSubmit(assignment.id, note, files)
    setSending(false)
    if (ok) { setNote(''); setFiles([]); setOpen(false) }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-white text-sm">{assignment.title}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={st.css}>{st.label}</span>
          </div>
          <p className="text-xs mb-2" style={{ color: '#8495A3' }}>
            Da {assignment.coach?.name ?? 'Coach'} · {fmtDate(assignment.created_at)}
            {assignment.due_at && <> · scadenza {fmtDate(assignment.due_at)}</>}
          </p>
          {assignment.description && <p className="text-sm" style={{ color: '#C7D3DD' }}>{assignment.description}</p>}
        </div>
      </div>

      {/* Past submissions */}
      {submissions.length > 0 && (
        <div className="mt-4 space-y-2">
          {submissions.map(s => <SubmissionBlock key={s.id} sub={s} />)}
        </div>
      )}

      {/* Submit form */}
      {open ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="Aggiungi una nota alla consegna (facoltativa)..."
            className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none" style={inputStyle}
          />
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <LocalThumb key={i} file={f} onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <label
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium cursor-pointer transition-colors hover:bg-white/[0.04]"
              style={{ border: '1px dashed var(--ist-border-strong)', color: 'var(--ist-accent-text)' }}
            >
              <ImagePlus size={14} strokeWidth={2} /> Aggiungi immagini
              <input
                type="file" accept="image/*" multiple className="hidden"
                onChange={e => { const fl = Array.from(e.target.files ?? []); setFiles(prev => [...prev, ...fl]); e.target.value = '' }}
              />
            </label>
            <button
              onClick={handleSubmit}
              disabled={sending || (!note.trim() && files.length === 0)}
              className="px-4 py-2 text-white text-xs font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', border: '1px solid var(--ist-w14)' }}
            >
              {sending && <Loader2 size={13} className="animate-spin" />}
              {sending ? 'Invio...' : 'Invia consegna'}
            </button>
            <button onClick={() => { setOpen(false); setNote(''); setFiles([]) }} className="px-4 py-2 text-xs rounded-full" style={{ color: '#8495A3' }}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 px-4 py-2 text-xs font-semibold rounded-full transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-border)', color: 'var(--ist-text)' }}
        >
          {submissions.length > 0 ? '+ Nuova consegna' : 'Consegna'}
        </button>
      )}
    </Card>
  )
}

export default function StudentCompiti() {
  const { user } = useAuth()
  const { assignments, loading, submit } = useStudentAssignments(user?.id ?? '')

  // Visitando la pagina, il feedback è "visto" → spegne il pallino "novità" sui Compiti.
  useEffect(() => {
    if (!user?.id || loading) return
    localStorage.setItem('ist_compiti_seen_' + user.id, new Date().toISOString())
    window.dispatchEvent(new CustomEvent('ist:compiti-seen'))
  }, [user?.id, loading])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Compiti" subtitle="Esercizi assegnati dal tuo coach" />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : assignments.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            Nessun compito al momento. Il tuo coach te ne assegnerà in base al tuo percorso.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => <AssignmentCard key={a.id} assignment={a} onSubmit={submit} />)}
        </div>
      )}
    </div>
  )
}
