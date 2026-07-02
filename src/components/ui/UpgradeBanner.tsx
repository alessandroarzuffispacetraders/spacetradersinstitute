import { useState } from 'react'
import { Sparkles, ArrowRight, X } from 'lucide-react'
import { useContactAdmin } from '../../lib/upgradeContact'

// Banner slim di conversione per l'utente gratuito. Chiudibile per la sessione.
export default function UpgradeBanner() {
  const { contactAdmin, ready } = useContactAdmin()
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('ist_upgrade_banner_dismissed') === '1',
  )
  if (dismissed) return null

  const dismiss = () => {
    sessionStorage.setItem('ist_upgrade_banner_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl mb-4"
      style={{
        background: 'linear-gradient(135deg, rgba(90,154,177,0.16), rgba(40,102,128,0.10))',
        border: '1px solid rgba(124,187,208,0.28)',
      }}
    >
      <Sparkles size={16} strokeWidth={2.2} style={{ color: '#7CBBD0' }} className="flex-shrink-0" />
      <p className="text-xs sm:text-sm font-medium flex-1 min-w-0" style={{ color: 'var(--ist-text)' }}>
        Stai usando la <strong>versione gratuita</strong>. Sblocca coaching 1:1, tutti i corsi e la community.
      </p>
      <button
        onClick={contactAdmin}
        disabled={!ready}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold whitespace-nowrap transition-all hover:-translate-y-0.5 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)' }}
      >
        Sblocca tutto
        <ArrowRight size={13} strokeWidth={2.6} />
      </button>
      <button
        onClick={dismiss}
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ color: 'var(--ist-text-muted)' }}
        aria-label="Chiudi"
      >
        <X size={14} strokeWidth={2.4} />
      </button>
    </div>
  )
}
