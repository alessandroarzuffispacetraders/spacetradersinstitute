import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'

const BADGES = [
  { icon: '🚀', title: 'Primo giorno', desc: 'Onboarding completato', earned: true },
  { icon: '📚', title: 'Prima lezione', desc: 'Prima video lezione', earned: true },
  { icon: '📝', title: 'Primo trade', desc: 'Prima voce nel diario', earned: true },
  { icon: '🔥', title: '7 giorni di fila', desc: 'Login per 7 giorni', earned: true },
  { icon: '🎯', title: 'Primo modulo', desc: 'Modulo 1 completato', earned: true },
  { icon: '🧠', title: 'Sessione mental', desc: 'Prima sessione Mental Coach', earned: false },
  { icon: '💎', title: 'Build completo', desc: 'Tutta la fase Build', earned: false },
  { icon: '🏆', title: 'IST Graduate', desc: 'Percorso 90gg completato', earned: false },
]

export default function StudentProgressi() {
  const earnedBadges = BADGES.filter(b => b.earned).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Progressi & Badge"
        subtitle={`${earnedBadges}/${BADGES.length} badge guadagnati`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Giorni attivi', value: '42', icon: '📅' },
          { label: 'Corsi completati', value: '7', icon: '🎬' },
          { label: 'Voci diario', value: '18', icon: '📓' },
          { label: 'Badge', value: String(earnedBadges), icon: '🏆' },
        ].map((s, i) => (
          <Card key={i} className="p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold" style={{ color: 'var(--ist-text)' }}>{s.value}</div>
            <div className="text-xs mt-0.5 ist-text-muted">{s.label}</div>
          </Card>
        ))}
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-white mb-4">Badge</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGES.map((badge, i) => (
            <Card key={i} className={`p-4 text-center ${!badge.earned ? 'opacity-35' : ''}`}>
              <div className="text-3xl mb-2">{badge.icon}</div>
              <p className="text-xs font-semibold text-white">{badge.title}</p>
              <p className="text-xs mt-0.5 leading-snug" style={{ color: '#8495A3' }}>{badge.desc}</p>
              {badge.earned && (
                <span
                  className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' }}
                >
                  Ottenuto
                </span>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
