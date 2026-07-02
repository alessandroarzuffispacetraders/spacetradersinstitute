import { Sparkles, Lock, Check, MessageCircle, X } from 'lucide-react'
import { useContactAdmin } from '../../lib/upgradeContact'

const INCLUDED = [
  'Percorso guidato 1:1 in 90 giorni',
  'Tutti i videocorsi completi',
  'Coach dedicato e mental coach',
  'Compiti, review e sessioni Zoom',
  'Community completa e canali privati',
]

// Card di upsell riutilizzabile: usata centrata da UpgradeWall e in overlay
// (glassy) da PreviewLock sopra l'anteprima offuscata.
export default function UpgradeCard({
  title = 'Sblocca il percorso completo',
  body = 'Questa sezione fa parte del percorso completo IST. Passa alla versione completa per accedere al coaching 1:1, a tutti i videocorsi e alla community.',
  floating = false,
  onClose,
}: {
  title?: string
  body?: string
  floating?: boolean
  onClose?: () => void
}) {
  const { contactAdmin, ready } = useContactAdmin()
  return (
    <div
      className="relative w-full max-w-lg rounded-[28px] px-7 py-9 flex flex-col items-center text-center"
      style={{
        background: 'var(--ist-card-bg)',
        border: '1px solid var(--ist-border)',
        boxShadow: floating ? '0 30px 90px rgba(0,0,0,0.45)' : 'var(--ist-card-shadow)',
        backdropFilter: floating ? 'blur(24px)' : undefined,
        WebkitBackdropFilter: floating ? 'blur(24px)' : undefined,
      }}
    >
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/[0.08]"
          style={{ color: 'var(--ist-text-muted)', border: '1px solid var(--ist-border)' }}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      )}
      <div
        className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(90,154,177,0.16)', border: '1px solid rgba(124,187,208,0.28)' }}
      >
        <Lock size={28} strokeWidth={1.8} style={{ color: '#7CBBD0' }} />
      </div>

      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-4"
        style={{ background: 'rgba(90,154,177,0.14)', color: '#7CBBD0' }}
      >
        <Sparkles size={12} strokeWidth={2.4} /> Versione gratuita
      </span>

      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--ist-text)' }}>{title}</h1>
      <p className="text-sm leading-relaxed mb-6 max-w-sm" style={{ color: 'var(--ist-text-muted)' }}>{body}</p>

      <ul className="w-full max-w-xs flex flex-col gap-2 mb-7 text-left">
        {INCLUDED.map(item => (
          <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--ist-text)' }}>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(70,211,154,0.16)' }}
            >
              <Check size={12} strokeWidth={2.6} style={{ color: '#46D39A' }} />
            </span>
            {item}
          </li>
        ))}
      </ul>

      <button
        onClick={contactAdmin}
        disabled={!ready}
        className="flex items-center justify-center gap-2 w-full max-w-xs py-3 rounded-2xl text-white font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', boxShadow: '0 14px 40px rgba(40,102,128,0.36)' }}
      >
        <MessageCircle size={16} strokeWidth={2.2} />
        Richiedi l'accesso completo
      </button>
      <p className="text-[11px] mt-3" style={{ color: 'var(--ist-text-muted)' }}>
        Scrivi all'admin: ti spieghiamo come entrare nella community.
      </p>
    </div>
  )
}
