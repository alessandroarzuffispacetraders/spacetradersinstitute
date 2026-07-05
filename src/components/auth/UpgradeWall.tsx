import UpgradeCard from './UpgradeCard'
import LockedNotice from './LockedNotice'
import { upsellSuppressed } from '../../lib/freeTier'

// Muro di upsell mostrato all'utente gratuito su una funzione riservata.
// Vive dentro l'area contenuti dell'app (sidebar/bottom-nav restano visibili).
// Per le pagine intere usiamo PreviewLock (anteprima offuscata + questa card).
export default function UpgradeWall({
  title,
  body,
}: {
  title?: string
  body?: string
}) {
  // iOS: nessun invito all'acquisto (Guideline 3.1.1). Avviso neutro, mantenendo
  // solo il titolo (già neutro, es. "Lezione riservata"); il body di vendita
  // viene sostituito da quello informativo di default di LockedNotice.
  if (upsellSuppressed()) {
    return <LockedNotice title={title} />
  }
  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <UpgradeCard title={title} body={body} />
    </div>
  )
}
