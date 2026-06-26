import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'

const SEGNALAZIONI = [
  { id: 1, student: 'Luca Ferrari', issue: 'Inattivo da 5 giorni — non risponde ai messaggi', severity: 'high', date: '24 Giu', resolved: false },
  { id: 2, student: 'Gianna Conti', issue: 'Nessuna voce diario per 7 giorni', severity: 'medium', date: '23 Giu', resolved: false },
  { id: 3, student: 'Marta Esposito', issue: 'Difficoltà con il modulo 1, blocco emotivo evidente', severity: 'high', date: '20 Giu', resolved: true },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 16,
  color: '#F7FAFC',
  outline: 'none',
  width: '100%',
}

export default function CoachSegnalazioni() {
  const [showForm, setShowForm] = useState(false)

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
            <select className="px-3 py-2.5 text-sm" style={inputStyle}>
              <option>Marco Rossi</option>
              <option>Anna Pellegrini</option>
              <option>Luca Ferrari</option>
            </select>
            <select className="px-3 py-2.5 text-sm" style={inputStyle}>
              <option value="high">Alta priorità</option>
              <option value="medium">Media priorità</option>
            </select>
            <textarea
              placeholder="Descrivi il problema..."
              rows={3}
              className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none"
              style={inputStyle}
            />
            <div className="flex gap-2">
              <button
                className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)',
                  border: '1px solid var(--ist-w14)',
                }}
              >
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
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {SEGNALAZIONI.map((s) => (
          <Card
            key={s.id}
            className="p-5"
            style={!s.resolved ? {
              borderLeft: `3px solid ${s.severity === 'high' ? 'rgba(255,107,122,0.40)' : 'rgba(90,154,177,0.40)'}`,
            } : {}}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${!s.resolved && s.severity !== 'high' ? 'animate-pulse' : ''}`}
                style={{ background: s.resolved ? '#46D39A' : s.severity === 'high' ? '#FF6B7A' : '#5A9AB1' }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-white text-sm">{s.student}</p>
                  {!s.resolved && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={s.severity === 'high'
                        ? { color: '#FF6B7A', background: 'rgba(255,107,122,0.14)', border: '1px solid rgba(255,107,122,0.22)' }
                        : { color: '#7CBBD0', background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' }
                      }
                    >
                      {s.severity === 'high' ? 'Alta priorità' : 'Media priorità'}
                    </span>
                  )}
                  {s.resolved && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' }}
                    >
                      Risolta
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: '#C7D3DD' }}>{s.issue}</p>
                <p className="text-xs mt-1" style={{ color: '#56636F' }}>{s.date}</p>
              </div>
              {!s.resolved && (
                <button className="text-xs text-ist-300 hover:text-ist-200 transition-colors flex-shrink-0 font-medium">
                  Segna risolta
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
