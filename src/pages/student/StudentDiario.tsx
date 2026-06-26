import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'

const MOCK_ENTRIES = [
  {
    id: 1,
    date: '26 Giu 2024',
    result: '+€340',
    positive: true,
    trades: 3,
    notes: 'Ottima giornata. Ho rispettato il piano e uscito prima che il mercato girasse contro. La pazienza sta pagando.',
    emotion: '😊',
  },
  {
    id: 2,
    date: '25 Giu 2024',
    result: '-€120',
    positive: false,
    trades: 2,
    notes: 'Sono entrato troppo presto su EUR/USD. Devo aspettare la conferma del secondo candlestick. Errore di fretta.',
    emotion: '😤',
  },
  {
    id: 3,
    date: '24 Giu 2024',
    result: '+€210',
    positive: true,
    trades: 4,
    notes: 'Buon setup su GBP/JPY. Ho gestito bene il risk, uscito a target. Tutto secondo piano.',
    emotion: '😎',
  },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 16,
  color: '#F7FAFC',
  outline: 'none',
  width: '100%',
}

export default function StudentDiario() {
  const [showForm, setShowForm] = useState(false)

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
              <input type="text" placeholder="Es. +€200" className="px-3 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>N° trade</label>
              <input type="number" placeholder="0" className="px-3 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>Umore</label>
              <select className="px-3 py-2.5 text-sm" style={inputStyle}>
                <option>😊 Soddisfatto</option>
                <option>😐 Neutro</option>
                <option>😤 Frustrato</option>
                <option>😰 Stressato</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs block mb-1.5" style={{ color: '#8495A3' }}>Note sulla sessione</label>
            <textarea
              placeholder="Cosa ha funzionato? Cosa hai imparato? Cosa farai diversamente?"
              rows={4}
              className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none"
              style={inputStyle}
            />
          </div>
          <div className="flex gap-3">
            <button
              className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)',
                border: '1px solid var(--ist-w14)',
              }}
            >
              Salva
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 text-sm rounded-full transition-all"
              style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: '#8495A3' }}
            >
              Annulla
            </button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {MOCK_ENTRIES.map((entry) => (
          <Card key={entry.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{entry.emotion}</span>
                <div>
                  <p className="text-sm" style={{ color: '#8495A3' }}>{entry.date}</p>
                  <p className={`text-lg font-bold`} style={{ color: entry.positive ? '#46D39A' : '#FF6B7A' }}>
                    {entry.result}
                  </p>
                </div>
              </div>
              <span
                className="text-xs px-2 py-1 rounded-xl font-medium"
                style={{ background: 'var(--ist-w7)', color: '#8495A3' }}
              >
                {entry.trades} trade
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#C7D3DD' }}>{entry.notes}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
