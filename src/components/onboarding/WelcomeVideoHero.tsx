import { useWelcomeVideo, WELCOME_WINDOW_DAYS } from '../../lib/onboarding'
import VimeoPlayer from '../ui/VimeoPlayer'

// Video di benvenuto in home, mostrato solo per i primi WELCOME_WINDOW_DAYS
// giorni dalla registrazione. Gli utenti gratuiti vedono il video dedicato
// (freeUrl); gli altri quello completo. Su desktop è un riquadro compatto
// affiancato al testo; su mobile è impilato a larghezza piena.
export default function WelcomeVideoHero({
  registeredAt,
  isFree = false,
  className = '',
}: {
  registeredAt: string | null
  isFree?: boolean
  className?: string
}) {
  const { fullUrl, freeUrl, loading } = useWelcomeVideo()
  const url = isFree ? freeUrl : fullUrl

  if (loading || !url || !registeredAt) return null
  const days = (Date.now() - new Date(registeredAt).getTime()) / 86_400_000
  if (!Number.isFinite(days) || days >= WELCOME_WINDOW_DAYS) return null

  const title = isFree ? 'Scopri IST 👋' : 'Benvenuto in IST 👋'
  const subtitle = isFree
    ? 'Guarda il video e scopri cosa ti aspetta nel percorso completo.'
    : 'Guarda il video di benvenuto per partire con il piede giusto.'

  return (
    <div
      className={`rounded-3xl p-5 lg:p-6 ${className}`}
      style={{
        background: 'var(--ist-card-bg-premium, var(--ist-card-bg))',
        border: '1px solid var(--ist-border)',
        boxShadow: 'var(--ist-card-shadow-premium, var(--ist-card-shadow))',
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <div className="lg:flex-1 lg:min-w-0">
          <h2 className="text-base lg:text-lg font-bold" style={{ color: 'var(--ist-text)' }}>{title}</h2>
          <p className="text-xs lg:text-sm mt-1" style={{ color: 'var(--ist-text-dim)' }}>{subtitle}</p>
        </div>
        <div className="w-full lg:w-[400px] lg:flex-shrink-0 rounded-2xl overflow-hidden">
          <VimeoPlayer vimeoId={url} accent="#5A9AB1" />
        </div>
      </div>
    </div>
  )
}
