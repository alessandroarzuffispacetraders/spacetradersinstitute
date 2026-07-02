import UpgradeCard from './UpgradeCard'

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
  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <UpgradeCard title={title} body={body} />
    </div>
  )
}
