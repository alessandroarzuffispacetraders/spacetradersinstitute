import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { useDiaryEntries, DiaryEntry } from '../../lib/diary'

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 16,
  color: 'var(--ist-text)',
  outline: 'none',
  width: '100%',
}

const EMOTIONS = ['😊 Soddisfatto', '😐 Neutro', '😤 Frustrato', '😰 Stressato']

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isPositive(result: string | null): boolean {
  if (!result) return true
  return !result.trim().startsWith('-')
}

export default function StudentDiario() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { entries, loading, addEntry, deleteEntry } = useDiaryEntries(userId)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState('')
  const [trades, setTrades] = useState('')
  const [emotion, setEmotion] = useState(EMOTIONS[0])
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setResult(''); setTrades(''); setEmotion(EMOTIONS[0]); setNotes('')
  }

  const handleSave = async () => {
    if (!result.trim() && !notes.trim()) return
    setSaving(true)
    const ok = await addEntry({
      result,
      trades_count: trades.trim() === '' ? null : Number(trades),
      emotion: emotion.split(' ')[0], // salva solo l'emoji
      notes,
    })
    setSaving(false)
    if (ok) { resetForm(); setShowForm(false) }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Diario di Trading"
        subtitle="Documenta ogni sessione per crescere come trader"
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
            + Nuova voce
          </button>
        }
      />

      {showForm && (
        <Card className="p-6 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Nuova voce diario</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>Risultato</label>
              <input value={result} onChange={e => setResult(e.target.value)} type="text" placeholder="Es. +€200" className="px-3 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>N° trade</label>
              <input value={trades} onChange={e => setTrades(e.target.value)} type="number" min="0" placeholder="0" className="px-3 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>Umore</label>
              <select value={emotion} onChange={e => setEmotion(e.target.value)} className="px-3 py-2.5 text-sm" style={inputStyle}>
                {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>Note sulla sessione</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Cosa ha funzionato? Cosa hai imparato? Cosa farai diversamente?"
              rows={4}
              className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none"
              style={inputStyle}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || (!result.trim() && !notes.trim())}
              className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)',
                border: '1px solid var(--ist-w14)',
              }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="px-5 py-2.5 text-sm rounded-full transition-all"
              style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: '#8495A3' }}
            >
              Annulla
            </button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : entries.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            Nessuna voce nel diario. Aggiungi la tua prima sessione per iniziare a tracciare i progressi.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry: DiaryEntry) => {
            const positive = isPositive(entry.result)
            return (
              <Card key={entry.id} className="p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{entry.emotion ?? '📝'}</span>
                    <div>
                      <p className="text-sm" style={{ color: '#8495A3' }}>{formatDate(entry.entry_date)}</p>
                      {entry.result && (
                        <p className="text-lg font-bold" style={{ color: positive ? '#46D39A' : '#FF6B7A' }}>
                          {entry.result}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.trades_count != null && (
                      <span
                        className="text-xs px-2 py-1 rounded-xl font-medium"
                        style={{ background: 'var(--ist-w7)', color: '#8495A3' }}
                      >
                        {entry.trades_count} trade
                      </span>
                    )}
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                      style={{ color: '#FF6B7A' }}
                      title="Elimina voce"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
                {entry.notes && <p className="text-sm leading-relaxed" style={{ color: '#C7D3DD' }}>{entry.notes}</p>}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
