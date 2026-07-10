import { ReactNode, useEffect, useState } from 'react'
import UpgradeCard from './UpgradeCard'
import { useBackInterceptor } from '../../lib/androidBack'

// Secondi prima che compaia il popup di upsell dopo l'apertura della pagina.
const POPUP_DELAY_MS = 3500

// Mostra un'anteprima ESCA della sezione (dati finti, hardcoded) come se fosse
// abilitata; dopo qualche secondo compare un popup di upsell (chiudibile).
//
// Sicurezza: il decoy è JSX statico con dati inventati — nessun fetch reale, e
// il componente di pagina vero non viene mai montato per l'utente gratuito.
// Quello che si vede è tutto finto; il gating vero resta server-side via RLS.
export default function PreviewLock({
  title,
  body,
  children,
}: {
  title?: string
  body?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), POPUP_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  // Tasto indietro Android: chiudi il popup di upsell invece di navigare.
  useBackInterceptor(() => setOpen(false), open)

  return (
    <>
      {/* Anteprima piena: la sezione appare "abilitata". Contenuto = esca. */}
      {children}

      {open && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[101] left-1/2 top-1/2 w-full px-4"
            style={{
              transform: 'translate(-50%, -50%)',
              maxWidth: 540,
              animation: 'upgradePopIn 0.24s cubic-bezier(0.22,1,0.36,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <UpgradeCard title={title} body={body} floating onClose={() => setOpen(false)} />
          </div>
          <style>{`
            @keyframes upgradePopIn {
              from { opacity: 0; transform: translate(-50%, calc(-50% + 14px)); }
              to   { opacity: 1; transform: translate(-50%, -50%); }
            }
          `}</style>
        </>
      )}
    </>
  )
}
