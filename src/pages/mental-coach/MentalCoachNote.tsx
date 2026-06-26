import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { Lock } from 'lucide-react'

const NOTES = [
  {
    student: 'Marco Rossi',
    date: '24 Giu 2024',
    content: 'Marco mostra buona apertura emotiva. La difficoltà principale è nella gestione delle perdite consecutive — tende ad aumentare la size per "recuperare". Da affrontare nella sessione 2 con tecniche di interruzione del pattern.',
  },
  {
    student: 'Luca Ferrari',
    date: '20 Giu 2024',
    content: 'Ansia da performance elevata. Pressione esterna (famiglia) che incide negativamente. Assegnati esercizi di mindfulness pre-sessione. Monitorare attentamente.',
  },
]

export default function MentalCoachNote() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Note Private"
        subtitle="Visibili solo a te — non condivise con nessuno"
        action={
          <button
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

      <div
        className="mb-5 p-3 rounded-2xl flex items-center gap-2"
        style={{
          background: 'rgba(90,154,177,0.08)',
          border: '1px solid rgba(90,154,177,0.16)',
        }}
      >
        <Lock size={14} strokeWidth={2} className="text-ist-400 flex-shrink-0" />
        <p className="text-xs text-ist-300/80">Queste note sono private e visibili solo a te.</p>
      </div>

      <div className="space-y-4">
        {NOTES.map((note, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  style={{ background: 'rgba(90,154,177,0.16)', color: '#7CBBD0', border: '1px solid rgba(90,154,177,0.24)' }}
                >
                  {note.student.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{note.student}</p>
                  <p className="text-xs" style={{ color: '#56636F' }}>{note.date}</p>
                </div>
              </div>
              <button className="text-xs transition-colors" style={{ color: '#8495A3' }}>Modifica</button>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#C7D3DD' }}>{note.content}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
