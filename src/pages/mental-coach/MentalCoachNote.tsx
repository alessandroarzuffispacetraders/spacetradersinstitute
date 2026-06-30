import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { Lock, Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAssignedStudents, useMentalNotes, MentalNote } from '../../lib/coaching'

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 16,
  color: 'var(--ist-text)',
  outline: 'none',
  width: '100%',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MentalCoachNote() {
  const { user } = useAuth()
  const myId = user?.id ?? ''
  const { students } = useAssignedStudents('mental_coach', myId)
  const { notes, loading, addNote, updateNote, deleteNote } = useMentalNotes(myId)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleAdd = async () => {
    const sid = studentId || students[0]?.id
    if (!sid || !content.trim()) return
    setSaving(true)
    const ok = await addNote(sid, content)
    setSaving(false)
    if (ok) { setContent(''); setStudentId(''); setShowForm(false) }
  }

  const startEdit = (n: MentalNote) => { setEditingId(n.id); setEditContent(n.content) }
  const saveEdit = async () => {
    if (!editingId) return
    await updateNote(editingId, editContent)
    setEditingId(null); setEditContent('')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Note Private"
        subtitle="Visibili solo a te — non condivise con nessuno"
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)',
              border: '1px solid var(--ist-w14)',
              boxShadow: '0 8px 24px rgba(40,102,128,0.36)',
            }}
          >
            + Nuova nota
          </button>
        }
      />

      <div className="mb-5 p-3 rounded-2xl flex items-center gap-2" style={{ background: 'rgba(90,154,177,0.08)', border: '1px solid rgba(90,154,177,0.16)' }}>
        <Lock size={14} strokeWidth={2} className="text-ist-400 flex-shrink-0" />
        <p className="text-xs text-ist-300/80">Queste note sono private e visibili solo a te.</p>
      </div>

      {showForm && (
        <Card className="p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Nuova nota</h3>
          <div className="space-y-3">
            <select value={studentId} onChange={e => setStudentId(e.target.value)} className="px-3 py-2.5 text-sm" style={inputStyle}>
              <option value="" disabled>Seleziona studente…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Osservazioni, pattern, raccomandazioni..."
              rows={4}
              className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none"
              style={inputStyle}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving || !content.trim() || students.length === 0}
                className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', border: '1px solid var(--ist-w14)' }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Salva
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm rounded-full" style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: '#8495A3' }}>
                Annulla
              </button>
            </div>
            {students.length === 0 && (
              <p className="text-xs" style={{ color: '#F6C85F' }}>Non hai studenti assegnati: chiedi all'admin di assegnartene.</p>
            )}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : notes.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>Nessuna nota. Aggiungi la prima nota privata su uno studente.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <Card key={note.id} className="p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0" style={{ background: 'rgba(90,154,177,0.16)', color: '#7CBBD0', border: '1px solid rgba(90,154,177,0.24)' }}>
                    {(note.student?.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{note.student?.name ?? 'Studente'}</p>
                    <p className="text-xs" style={{ color: '#56636F' }}>{formatDate(note.updated_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === note.id ? (
                    <button onClick={saveEdit} className="text-xs font-medium" style={{ color: 'var(--ist-accent-text)' }}>Salva</button>
                  ) : (
                    <button onClick={() => startEdit(note)} className="text-xs transition-colors" style={{ color: '#8495A3' }}>Modifica</button>
                  )}
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                    style={{ color: '#FF6B7A' }}
                    title="Elimina"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
              {editingId === note.id ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={4}
                  className="px-3 py-2.5 text-sm resize-none"
                  style={inputStyle}
                />
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: '#C7D3DD' }}>{note.content}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
