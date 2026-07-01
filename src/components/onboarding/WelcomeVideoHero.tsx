import { useWelcomeVideo, WELCOME_WINDOW_DAYS } from '../../lib/onboarding'
import VimeoPlayer from '../ui/VimeoPlayer'

// Video di benvenuto in cima alla home, mostrato solo per i primi
// WELCOME_WINDOW_DAYS giorni dalla registrazione dello studente.
export default function WelcomeVideoHero({ registeredAt }: { registeredAt: string | null }) {
  const { url, loading } = useWelcomeVideo()

  if (loading || !url || !registeredAt) return null
  const days = (Date.now() - new Date(registeredAt).getTime()) / 86_400_000
  if (!Number.isFinite(days) || days >= WELCOME_WINDOW_DAYS) return null

  return (
    <div
      className="rounded-3xl p-5 lg:p-6"
      style={{
        background: 'var(--ist-card-bg-premium, var(--ist-card-bg))',
        border: '1px solid var(--ist-border)',
        boxShadow: 'var(--ist-card-shadow-premium, var(--ist-card-shadow))',
      }}
    >
      <div className="mb-3">
        <h2 className="text-base font-bold" style={{ color: 'var(--ist-text)' }}>Benvenuto in IST 👋</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ist-text-dim)' }}>
          Guarda il video di benvenuto per partire con il piede giusto.
        </p>
      </div>
      <div className="rounded-2xl overflow-hidden">
        <VimeoPlayer vimeoId={url} accent="#5A9AB1" />
      </div>
    </div>
  )
}
