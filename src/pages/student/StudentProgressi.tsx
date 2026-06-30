import { Loader2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { useStudentBadges } from '../../lib/badges'

export default function StudentProgressi() {
  const { user } = useAuth()
  const { stats, badges, loading } = useStudentBadges(user?.id ?? '')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Progressi & Badge"
        subtitle={`${stats.earnedCount}/${badges.length} badge guadagnati`}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: 'var(--ist-text-muted)' }} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Lezioni completate', value: String(stats.lessonsCompleted), icon: '🎬' },
              { label: 'Voci diario', value: String(stats.diaryCount), icon: '📓' },
              { label: 'Streak (giorni)', value: String(stats.diaryStreak), icon: '🔥' },
              { label: 'Badge', value: String(stats.earnedCount), icon: '🏆' },
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
              {badges.map(badge => (
                <Card key={badge.id} className={`p-4 text-center ${!badge.earned ? 'opacity-35' : ''}`}>
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
        </>
      )}
    </div>
  )
}
