import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { useAssignedStudents, useCoachFlags, FlagSeverity } from '../../lib/coaching'
import { triggerStudentFlagNotification } from '../../lib/push'
import IncomingFlags from '../../components/ui/IncomingFlags'

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 16,
  color: 'var(--ist-text)',
  outline: 'none',
  width: '100%',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export default function CoachSegnalazioni() {
  const { user } = useAuth()
  const myId = user?.id ?? ''
  const { students } = useAssignedStudents('coach', myId)
  const { flags, loading, addFlag, resolveFlag, deleteFlag } = useCoachFlags(myId)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [severity, setSeverity] = useState<FlagSeverity>('high')
  const [issue, setIssue] = useState('')

  const handleSubmit = async () => {
    const sid = studentId || students[0]?.id
    if (!sid || !issue.trim()) return
    setSaving(true)
    const ok = await addFlag(sid, issue, severity)
    setSaving(false)
    if (ok) {
      // Alta priorità → notifica push agli admin (fire & forget).
      if (severity === 'high') {
        const studentName = students.find(s => s.id === sid)?.name ?? null
        triggerStudentFlagNotification(studentName)
      }
      setIssue(''); setStudentId(''); setSeverity('high'); setShowForm(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Segnalazioni"
        subtitle="Studenti che richiedono attenzione particolare"
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
            + Nuova
          </button>
        }
      />

      {showForm && (
        <Card className="p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Nuova segnalazione</h3>
          <div className="space-y-3">
            <select value={studentId} onChange={e => setStudentId(e.target.value)} className="px-3 py-2.5 text-sm" style={inputStyle}>
              <option value="" disabled>Seleziona studente…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={severity} onChange={e => setSeverity(e.target.value as FlagSeverity)} className="px-3 py-2.5 text-sm" style={inputStyle}>
              <option value="high">Alta priorità</option>
              <option value="medium">Media priorità</option>
            </select>
            <textarea
              value={issue}
              onChange={e => setIssue(e.target.value)}
              placeholder="Descrivi il problema..."
              rows={3}
              className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none"
              style={inputStyle}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={saving || !issue.trim() || (!studentId && students.length === 0)}
                className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', border: '1px solid var(--ist-w14)' }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Segnala
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-sm rounded-full transition-all"
                style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: '#8495A3' }}
              >
                Annulla
              </button>
            </div>
            {students.length === 0 && (
              <p className="text-xs" style={{ color: '#F6C85F' }}>Non hai studenti assegnati: chiedi all'admin di assegnartene.</p>
            )}
          </div>
        </Card>
      )}

      {/* Ricevute dall'admin */}
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ist-text)' }}>Ricevute dall'admin</h3>
      <div className="mb-8">
        <IncomingFlags userId={myId} emptyText="Nessuna segnalazione ricevuta dall'admin." />
      </div>

      {/* Segnalazioni create dal coach */}
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ist-text)' }}>Le tue segnalazioni</h3>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : flags.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>Nessuna segnalazione. Tutto sotto controllo.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {flags.map((s) => (
            <Card
              key={s.id}
              className="p-5 group"
              style={!s.resolved ? { borderLeft: `3px solid ${s.severity === 'high' ? 'rgba(255,107,122,0.40)' : 'rgba(90,154,177,0.40)'}` } : {}}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${!s.resolved && s.severity !== 'high' ? 'animate-pulse' : ''}`}
                  style={{ background: s.resolved ? '#46D39A' : s.severity === 'high' ? '#FF6B7A' : '#5A9AB1' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-white text-sm">{s.student?.name ?? 'Studente'}</p>
                    {!s.resolved ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={s.severity === 'high'
                          ? { color: '#FF6B7A', background: 'rgba(255,107,122,0.14)', border: '1px solid rgba(255,107,122,0.22)' }
                          : { color: '#7CBBD0', background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' }
                        }
                      >
                        {s.severity === 'high' ? 'Alta priorità' : 'Media priorità'}
                      </span>
                    ) : (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' }}
                      >
                        Risolta
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: '#C7D3DD' }}>{s.issue}</p>
                  <p className="text-xs mt-1" style={{ color: '#56636F' }}>{formatDate(s.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!s.resolved && (
                    <button
                      onClick={() => resolveFlag(s.id)}
                      className="text-xs hover:opacity-80 transition-colors font-medium"
                      style={{ color: 'var(--ist-accent-text)' }}
                    >
                      Segna risolta
                    </button>
                  )}
                  <button
                    onClick={() => deleteFlag(s.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                    style={{ color: '#FF6B7A' }}
                    title="Elimina"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
