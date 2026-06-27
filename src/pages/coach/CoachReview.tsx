import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { useCoachSubmissions, ExerciseSubmission } from '../../lib/coaching'

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 16,
  color: '#F7FAFC',
  outline: 'none',
  width: '100%',
}

function timeAgo(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

function ReviewCard({ review, onSend }: {
  review: ExerciseSubmission
  onSend: (id: string, text: string, blocked: boolean) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (blocked: boolean) => {
    if (!text.trim()) return
    setSaving(true)
    await onSend(review.id, text, blocked)
    setSaving(false)
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-ist-300 flex-shrink-0"
          style={{ background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' }}
        >
          {(review.student?.name ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{review.title}</p>
          <p className="text-xs mt-0.5" style={{ color: '#8495A3' }}>
            {review.student?.name ?? 'Studente'} · Inviato {timeAgo(review.submitted_at)}
          </p>

          {review.content && <p className="text-sm mt-3" style={{ color: '#C7D3DD' }}>{review.content}</p>}
          {review.content_url && (
            <a href={review.content_url} target="_blank" rel="noreferrer" className="text-xs mt-1 inline-block" style={{ color: 'var(--ist-accent-text)' }}>
              Apri allegato →
            </a>
          )}

          {review.status === 'pending' ? (
            <div className="mt-4">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Scrivi il tuo commento privato..."
                rows={3}
                className="px-3 py-2.5 text-sm placeholder:text-[#56636F] resize-none mb-3"
                style={inputStyle}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => submit(false)}
                  disabled={saving || !text.trim()}
                  className="px-4 py-2 text-white text-xs font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', border: '1px solid var(--ist-w14)' }}
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Invia feedback
                </button>
                <button
                  onClick={() => submit(true)}
                  disabled={saving || !text.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-full transition-all disabled:opacity-50"
                  style={{ background: 'rgba(255,107,122,0.12)', color: '#FF6B7A', border: '1px solid rgba(255,107,122,0.22)' }}
                >
                  Feedback + segnala bloccato
                </button>
              </div>
            </div>
          ) : (
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
  )
}

export default function CoachReview() {
  const { user } = useAuth()
  const { submissions, loading, sendFeedback } = useCoachSubmissions(user?.id ?? '')
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending')

  const pendingCount = submissions.filter(r => r.status === 'pending').length
  const filtered = submissions.filter(r => r.status === activeTab)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Review Esercizi" subtitle="Revisiona e commenta gli esercizi degli studenti" />

      <div className="flex gap-2 mb-6">
        {(['pending', 'reviewed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={activeTab === tab
              ? { background: 'rgba(90,154,177,0.16)', border: '1px solid rgba(124,187,208,0.28)', color: '#7CBBD0' }
              : { background: 'transparent', border: '1px solid transparent', color: '#8495A3' }
            }
          >
            {tab === 'pending' ? `Da revisionare (${pendingCount})` : 'Completate'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => (
            <ReviewCard key={review.id} review={review} onSend={sendFeedback} />
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12" style={{ color: '#56636F' }}>
              <div className="text-4xl mb-3">✅</div>
              <p className="text-sm">
                {activeTab === 'pending'
                  ? 'Nessun esercizio da revisionare. Gli invii compariranno qui quando gli studenti consegnano dalle lezioni.'
                  : 'Nessuna review completata.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
