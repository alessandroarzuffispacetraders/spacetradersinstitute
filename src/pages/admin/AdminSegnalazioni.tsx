import { useState } from 'react'
import { Loader2, AlertTriangle, Trash2, Send, ArrowUpRight } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAdminFlags, useStaffDirectory, FlagSeverity } from '../../lib/coaching'

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)',
  borderRadius: 14, color: 'var(--ist-text)', outline: 'none', width: '100%',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminSegnalazioni() {
  const { flags, loading, addAdminFlag, setResolved, deleteFlag } = useAdminFlags()
  const { coaches, mentals, students } = useStaffDirectory()
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // form
  const [recipientId, setRecipientId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [severity, setSeverity] = useState<FlagSeverity>('high')
  const [issue, setIssue] = useState('')

  const openCount = flags.filter(f => !f.resolved).length
  const openHigh = flags.filter(f => !f.resolved && f.severity === 'high').length
  const visible = onlyOpen ? flags.filter(f => !f.resolved) : flags

  const submit = async () => {
    if (!recipientId || !issue.trim()) return
    setSaving(true)
    const ok = await addAdminFlag(recipientId, studentId || null, issue, severity)
    setSaving(false)
    if (ok) { setRecipientId(''); setStudentId(''); setSeverity('high'); setIssue(''); setShowForm(false) }
  }

  const FilterChip = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="px-4 py-1.5 text-xs font-semibold rounded-full transition-all"
      style={active
        ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)', border: '1px solid var(--ist-border-strong)' }
        : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-w8)' }}
    >
      {label}
    </button>
  )

  const label = (t: string) => (
    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>{t}</label>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Segnalazioni"
        subtitle="Supervisiona le segnalazioni dei coach e inviane a coach/mental coach"
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid var(--ist-w14)', boxShadow: '0 8px 24px rgba(40,102,128,0.36)' }}
          >
            + Nuova
          </button>
        }
      />

      {showForm && (
        <Card className="p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ist-text)' }}>Invia una segnalazione</h3>
          <div className="space-y-3">
            <div>
              {label('Destinatario *')}
              <select value={recipientId} onChange={e => setRecipientId(e.target.value)} className="px-3 py-2.5 text-sm" style={inputStyle}>
                <option value="" disabled>Seleziona coach o mental coach…</option>
                {coaches.length > 0 && (
                  <optgroup label="Coach">
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
                {mentals.length > 0 && (
                  <optgroup label="Mental Coach">
                    {mentals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              {label('Studente (opzionale)')}
              <select value={studentId} onChange={e => setStudentId(e.target.value)} className="px-3 py-2.5 text-sm" style={inputStyle}>
                <option value="">Nessuno studente specifico</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              {label('Priorità')}
              <select value={severity} onChange={e => setSeverity(e.target.value as FlagSeverity)} className="px-3 py-2.5 text-sm" style={inputStyle}>
                <option value="high">Alta priorità</option>
                <option value="medium">Media priorità</option>
              </select>
            </div>
            <div>
              {label('Messaggio *')}
              <textarea value={issue} onChange={e => setIssue(e.target.value)} rows={3} placeholder="Descrivi cosa deve fare o a cosa prestare attenzione…" className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none" style={inputStyle} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving || !recipientId || !issue.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', border: '1px solid var(--ist-w14)' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2} />}
                Invia
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm rounded-full" style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
                Annulla
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Riepilogo + filtro */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <FilterChip active={onlyOpen} label="Solo aperte" onClick={() => setOnlyOpen(true)} />
          <FilterChip active={!onlyOpen} label="Tutte" onClick={() => setOnlyOpen(false)} />
        </div>
        <div className="flex-1" />
        <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>
          {openCount} aperte
          {openHigh > 0 && <span style={{ color: '#FF6B7A', fontWeight: 600 }}> · {openHigh} alta priorità</span>}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            {onlyOpen ? 'Nessuna segnalazione aperta. Tutto sotto controllo.' : 'Nessuna segnalazione.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((s) => {
            const toStaff = !!s.recipient_id
            const heading = s.student?.name ?? (toStaff ? s.recipient?.name : null) ?? 'Segnalazione'
            const meta = toStaff
              ? `Inviata a ${s.recipient?.name ?? '—'}${s.student?.name ? ` · su ${s.student.name}` : ''} · ${formatDate(s.created_at)}`
              : `Coach: ${s.author?.name ?? '—'} · ${formatDate(s.created_at)}`
            return (
              <Card
                key={s.id}
                className="p-5"
                style={!s.resolved ? { borderLeft: `3px solid ${s.severity === 'high' ? 'rgba(255,107,122,0.40)' : 'rgba(90,154,177,0.40)'}` } : {}}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: s.resolved ? 'rgba(70,211,154,0.12)' : s.severity === 'high' ? 'rgba(255,107,122,0.12)' : 'rgba(90,154,177,0.12)',
                      color: s.resolved ? '#46D39A' : s.severity === 'high' ? '#FF6B7A' : '#7CBBD0',
                    }}
                  >
                    {toStaff ? <ArrowUpRight size={16} strokeWidth={2} /> : <AlertTriangle size={16} strokeWidth={2} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: 'var(--ist-text)' }}>{heading}</p>
                      {toStaff && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: '#7CBBD0', background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' }}>
                          Inviata dall'admin
                        </span>
                      )}
                      {!s.resolved ? (
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={s.severity === 'high'
                            ? { color: '#FF6B7A', background: 'rgba(255,107,122,0.14)', border: '1px solid rgba(255,107,122,0.22)' }
                            : { color: '#7CBBD0', background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' }}
                        >
                          {s.severity === 'high' ? 'Alta priorità' : 'Media priorità'}
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' }}>
                          Risolta
                        </span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>{s.issue}</p>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--ist-text-dim)' }}>{meta}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => setResolved(s.id, !s.resolved)}
                      className="text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ color: s.resolved ? 'var(--ist-text-dim)' : 'var(--ist-accent-text)' }}
                    >
                      {s.resolved ? 'Riapri' : 'Segna risolta'}
                    </button>
                    {deleteId === s.id ? (
                      <>
                        <button onClick={async () => { await deleteFlag(s.id); setDeleteId(null) }} className="text-xs font-semibold" style={{ color: '#FF6B7A' }}>Elimina</button>
                        <button onClick={() => setDeleteId(null)} className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>Annulla</button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteId(s.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
                        style={{ color: '#FF6B7A' }}
                        title="Elimina"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
