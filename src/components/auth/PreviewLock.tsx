import { ReactNode } from 'react'
import UpgradeCard from './UpgradeCard'

// Mostra un'anteprima ESCA della sezione (dati finti, hardcoded) offuscata e
// non interattiva, con la card di upsell in overlay.
//
// Sicurezza: il decoy è JSX statico con dati inventati — nessun fetch reale, e
// il componente di pagina vero non viene mai montato per l'utente gratuito.
// Anche togliendo il blur dai devtools non si trova nulla di reale (il gating
// vero resta comunque server-side via RLS).
export default function PreviewLock({
  title,
  body,
  children,
}: {
  title?: string
  body?: string
  children: ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Anteprima esca: offuscata, non selezionabile, fuori dal tab order */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none"
        style={{
          filter: 'blur(7px) saturate(0.9)',
          opacity: 0.55,
          transform: 'scale(1.02)',
          userSelect: 'none',
        }}
      >
        {children}
      </div>

      {/* Velatura per staccare l'overlay dal fondo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 38%, color-mix(in srgb, var(--ist-bg) 52%, transparent) 0%, color-mix(in srgb, var(--ist-bg) 82%, transparent) 72%)',
        }}
      />

      {/* Card di upsell in overlay */}
      <div className="absolute inset-0 flex items-start justify-center px-4 py-10 sm:py-16 overflow-y-auto">
        <UpgradeCard title={title} body={body} floating />
      </div>
    </div>
  )
}
