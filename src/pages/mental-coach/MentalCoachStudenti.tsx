import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { ChevronDown } from 'lucide-react'

const STUDENTS = [
  { id: 1, name: 'Marco Rossi', phase: 'Build', session1: true, session2: false, lastNote: 'Buona apertura emotiva, gestione delle perdite ancora difficile', lastContact: '1 giorno fa' },
  { id: 2, name: 'Anna Pellegrini', phase: 'Build', session1: false, session2: false, lastNote: 'Prima sessione da programmare', lastContact: '3 giorni fa' },
  { id: 3, name: 'Stefano Mancini', phase: 'Onboarding', session1: true, session2: true, lastNote: 'Ottima evoluzione, pronto per la fase Test', lastContact: 'Ieri' },
  { id: 4, name: 'Luca Ferrari', phase: 'Build', session1: true, session2: false, lastNote: 'Ansia da performance elevata, da monitorare', lastContact: '5 giorni fa' },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 16,
  color: '#F7FAFC',
  outline: 'none',
  width: '100%',
}

export default function MentalCoachStudenti() {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="I tuoi Studenti" subtitle={`${STUDENTS.length} studenti assegnati`} />

      <div className="space-y-3">
        {STUDENTS.map((s) => (
          <Card key={s.id} className="overflow-hidden">
            <button
              onClick={() => setSelected(selected === s.id ? null : s.id)}
              className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(90,154,177,0.28), rgba(40,102,128,0.28))', color: '#A8D5E2' }}
              >
                {s.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{s.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#8495A3' }}>Fase {s.phase} · {s.lastContact}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {[{ done: s.session1, label: 'S1' }, { done: s.session2, label: 'S2' }].map((sess, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={sess.done
                      ? { background: 'rgba(70,211,154,0.14)', color: '#46D39A', border: '1px solid rgba(70,211,154,0.22)' }
                      : { border: '1px solid var(--ist-w12)', color: '#56636F' }
                    }
                  >
                    {sess.label}
                  </div>
                ))}
              </div>
              <ChevronDown
                size={16}
                strokeWidth={2}
                className={`ml-2 transition-transform duration-200 ${selected === s.id ? 'rotate-180' : ''}`}
                style={{ color: '#56636F' }}
              />
            </button>

            {selected === s.id && (
              <div className="p-5" style={{ borderTop: '1px solid var(--ist-w6)' }}>
                <p className="text-xs mb-1 font-medium" style={{ color: '#8495A3' }}>Ultima nota</p>
                <p className="text-sm italic mb-4" style={{ color: '#C7D3DD' }}>"{s.lastNote}"</p>
                <textarea
                  placeholder="Aggiungi nota privata..."
                  rows={3}
                  className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none mb-3"
                  style={inputStyle}
                />
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5"
                    style={{
                      background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)',
                      border: '1px solid var(--ist-w14)',
                    }}
                  >
                    Salva nota
                  </button>
                  <button
                    className="px-4 py-2 text-sm rounded-full transition-all"
                    style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: '#8495A3' }}
                  >
                    Invia messaggio
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
