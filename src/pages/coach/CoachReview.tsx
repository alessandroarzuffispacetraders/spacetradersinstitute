import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'

const REVIEWS = [
  { id: 1, student: 'Marco Rossi', title: 'Analisi EUR/USD — 24 Giu', submittedAt: '2h fa', status: 'pending' },
  { id: 2, student: 'Anna Pellegrini', title: 'Recap settimana 3', submittedAt: '1 giorno fa', status: 'pending' },
  { id: 3, student: 'Stefano Mancini', title: 'Setup GBP/JPY', submittedAt: '2 giorni fa', status: 'pending' },
  { id: 4, student: 'Roberto Greco', title: 'Piano di trading mensile', submittedAt: '3 giorni fa', status: 'reviewed' },
  { id: 5, student: 'Luca Ferrari', title: 'Analisi USD/JPY', submittedAt: '5 giorni fa', status: 'reviewed' },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 16,
  color: '#F7FAFC',
  outline: 'none',
  width: '100%',
}

export default function CoachReview() {
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending')
  const filtered = REVIEWS.filter(r => r.status === activeTab)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Review Esercizi" subtitle="Revisiona e commenta gli esercizi degli studenti" />

      <div className="flex gap-2 mb-6">
        {(['pending', 'reviewed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={activeTab === tab ? {
              background: 'rgba(90,154,177,0.16)',
              border: '1px solid rgba(124,187,208,0.28)',
              color: '#7CBBD0',
            } : {
              background: 'transparent',
              border: '1px solid transparent',
              color: '#8495A3',
            }}
          >
            {tab === 'pending'
              ? `Da revieware (${REVIEWS.filter(r => r.status === 'pending').length})`
              : 'Completate'
            }
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((review) => (
          <Card key={review.id} className="p-5">
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-ist-300 flex-shrink-0"
                style={{ background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' }}
              >
                {review.student.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{review.title}</p>
                <p className="text-xs mt-0.5" style={{ color: '#8495A3' }}>
                  {review.student} · Inviato {review.submittedAt}
                </p>

                {review.status === 'pending' && (
                  <div className="mt-4">
                    <textarea
                      placeholder="Scrivi il tuo commento privato..."
                      rows={3}
                      className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none mb-3"
                      style={inputStyle}
                    />
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2 text-white text-xs font-bold rounded-full transition-all hover:-translate-y-0.5"
                        style={{
                          background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)',
                          border: '1px solid var(--ist-w14)',
                        }}
                      >
                        Invia feedback
                      </button>
                      <button
                        className="px-4 py-2 text-xs font-semibold rounded-full transition-all"
                        style={{ background: 'rgba(255,107,122,0.12)', color: '#FF6B7A', border: '1px solid rgba(255,107,122,0.22)' }}
                      >
                        Segnala bloccato
                      </button>
                    </div>
                  </div>
                )}

                {review.status === 'reviewed' && (
                  <span
                    className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' }}
                  >
                    ✓ Feedback inviato
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: '#56636F' }}>
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm">Nessuna review in questa categoria</p>
          </div>
        )}
      </div>
    </div>
  )
}
