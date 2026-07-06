import { Clock, Lock, LogOut, LifeBuoy } from 'lucide-react'
import ISTLogo from '../ui/ISTLogo'
import { useAuth } from '../../context/AuthContext'
import { StudentStatus } from '../../types'
import { upsellSuppressed } from '../../lib/freeTier'

// Dove mandare chi non ha ancora accesso (link/mail/WhatsApp). Configurabile via env.
const SUPPORT_URL = (import.meta.env.VITE_SUPPORT_URL as string | undefined)?.trim() || ''

const COPY: Record<Exclude<StudentStatus, 'active'>, { icon: typeof Clock; title: string; body: string }> = {
  pending: {
    icon: Clock,
    title: 'Accesso in attivazione',
    body: 'Il tuo account è stato creato. L\'accesso al percorso viene attivato dopo la conferma: ti avviseremo appena sarà pronto.',
  },
  blocked: {
    icon: Lock,
    title: 'Accesso sospeso',
    body: 'Il tuo accesso è attualmente sospeso. Contatta il supporto per maggiori informazioni.',
  },
  expired: {
    icon: Lock,
    title: 'Accesso non attivo',
    body: 'Il tuo accesso non è attivo. Contatta il supporto per riattivarlo.',
  },
}

// Copy NEUTRA per iOS (App Review 3.1.1): niente inviti/direzioni a riattivare o
// contattare per "riabilitare" l'accesso (letto come pagamento esterno). Solo lo
// stato di fatto; l'unica azione è uscire. pending resta identico (nessun acquisto).
const IOS_BODY: Partial<Record<Exclude<StudentStatus, 'active'>, string>> = {
  blocked: 'Il tuo accesso è attualmente sospeso.',
  expired: 'Il tuo accesso al percorso non è attivo.',
}

export default function AccessWall({ status }: { status: Exclude<StudentStatus, 'active'> }) {
  const { logout, user } = useAuth()
  const c = COPY[status]
  const Icon = c.icon
  const companion = upsellSuppressed()
  const body = (companion && IOS_BODY[status]) || c.body

  return (
    <div
      data-inverted="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(90,154,177,0.14) 0%, transparent 55%), #07090f' }}
    >
      <div className="mb-8"><ISTLogo /></div>

      <div
        className="w-full max-w-md rounded-[28px] px-8 py-10 flex flex-col items-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}
      >
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6"
          style={{ background: 'rgba(90,154,177,0.16)', border: '1px solid rgba(124,187,208,0.28)' }}
        >
          <Icon size={28} strokeWidth={1.8} style={{ color: '#7CBBD0' }} />
        </div>

        <h1 className="text-xl font-bold mb-2" style={{ color: '#F7FAFC' }}>{c.title}</h1>
        <p className="text-sm leading-relaxed mb-7 max-w-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{body}</p>

        {user?.email && (
          <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>Account: {user.email}</p>
        )}

        <div className="flex flex-col gap-3 w-full">
          {!companion && SUPPORT_URL && (
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', boxShadow: '0 14px 40px rgba(40,102,128,0.36)' }}
            >
              <LifeBuoy size={15} strokeWidth={2} />
              Contatta il supporto
            </a>
          )}
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)' }}
          >
            <LogOut size={15} strokeWidth={2} />
            Esci
          </button>
        </div>
      </div>
    </div>
  )
}
