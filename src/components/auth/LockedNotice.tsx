import { Lock } from 'lucide-react'

// Avviso NEUTRO per una sezione riservata, mostrato all'utente free SOLO su iOS
// (App Review Guideline 3.1.1). A differenza di UpgradeCard non contiene alcun
// invito all'acquisto: niente pulsante "Sblocca"/"Richiedi accesso", niente
// contatto admin, niente prezzi o link. Solo la comunicazione di fatto che la
// sezione fa parte del percorso completo. La conversione avviene fuori dall'app.
export default function LockedNotice({
  title = 'Sezione non disponibile',
  body = 'Questa sezione non è disponibile per il tuo account.',
}: {
  title?: string
  body?: string
}) {
  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-md rounded-[28px] px-8 py-10 flex flex-col items-center text-center"
        style={{
          background: 'var(--ist-card-bg)',
          border: '1px solid var(--ist-border)',
          boxShadow: 'var(--ist-card-shadow)',
        }}
      >
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6"
          style={{ background: 'rgba(90,154,177,0.16)', border: '1px solid rgba(124,187,208,0.28)' }}
        >
          <Lock size={28} strokeWidth={1.8} style={{ color: '#7CBBD0' }} />
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--ist-text)' }}>{title}</h1>
        <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'var(--ist-text-muted)' }}>{body}</p>
      </div>
    </div>
  )
}
