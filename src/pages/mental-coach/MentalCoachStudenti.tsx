import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Loader2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { useAssignedStudents, useMentalNotes, useMentalSessions } from '../../lib/coaching'

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 16,
  color: '#F7FAFC',
  outline: 'none',
  width: '100%',
}

export default function MentalCoachStudenti() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const myId = user?.id ?? ''
  const { students, loading } = useAssignedStudents('mental_coach', myId)
  const { notes, addNote } = useMentalNotes(myId)
  const { sessions } = useMentalSessions(myId)

  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const lastNoteFor = (sid: string) => notes.find(n => n.student_id === sid)?.content ?? null
  const sessionDone = (sid: string, num: number) =>
    sessions.some(s => s.student_id === sid && s.session_number === num && s.status === 'completed')

  const handleSaveNote = async (sid: string) => {
    if (!draft.trim()) return
    setSaving(true)
    const ok = await addNote(sid, draft)
    setSaving(false)
    if (ok) setDraft('')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="I tuoi Studenti" subtitle={loading ? 'Caricamento...' : `${students.length} studenti assegnati`} />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : students.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            Nessuno studente assegnato. Le assegnazioni si gestiscono dall'area Admin → Utenti.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {students.map((s) => {
            const isOpen = selected === s.id
            const note = lastNoteFor(s.id)
            return (
              <Card key={s.id} className="overflow-hidden">
                <button
                  onClick={() => { setSelected(isOpen ? null : s.id); setDraft('') }}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(90,154,177,0.28), rgba(40,102,128,0.28))', color: '#A8D5E2' }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{s.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#8495A3' }}>{s.phase ? `Fase ${s.phase}` : 'Fase —'}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2].map((num) => {
                      const done = sessionDone(s.id, num)
                      return (
                        <div
                          key={num}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                          style={done
                            ? { background: 'rgba(70,211,154,0.14)', color: '#46D39A', border: '1px solid rgba(70,211,154,0.22)' }
                            : { border: '1px solid var(--ist-w12)', color: '#56636F' }
                          }
                        >
                          S{num}
                        </div>
                      )
                    })}
                  </div>
                  <ChevronDown size={16} strokeWidth={2} className={`ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: '#56636F' }} />
                </button>

                {isOpen && (
                  <div className="p-5" style={{ borderTop: '1px solid var(--ist-w6)' }}>
                    <p className="text-xs mb-1 font-medium" style={{ color: '#8495A3' }}>Ultima nota</p>
                    <p className="text-sm italic mb-4" style={{ color: note ? '#C7D3DD' : '#56636F' }}>
                      {note ? `"${note}"` : 'Nessuna nota ancora.'}
                    </p>
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      placeholder="Aggiungi nota privata..."
                      rows={3}
                      className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none mb-3"
                      style={inputStyle}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveNote(s.id)}
                        disabled={saving || !draft.trim()}
                        className="px-4 py-2 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', border: '1px solid var(--ist-w14)' }}
                      >
                        {saving && <Loader2 size={13} className="animate-spin" />}
                        Salva nota
                      </button>
                      <button
                        onClick={() => navigate('/student/chat', { state: { openDm: s.id, tab: 'direct' } })}
                        className="px-4 py-2 text-sm rounded-full transition-all"
                        style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: '#8495A3' }}
                      >
                        Invia messaggio
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
