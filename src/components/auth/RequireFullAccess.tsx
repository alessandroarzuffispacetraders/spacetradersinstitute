import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isFreeUser } from '../../lib/freeTier'
import LockedSection from './LockedSection'

// Cancello "solo paganti": l'utente gratuito vede un'anteprima ESCA della
// sezione (dati finti, offuscati) con l'upsell in overlay, anche navigando via
// URL diretto. Il contenuto reale non viene mai montato/fetchato per i free
// (il gating vero resta comunque server-side via RLS). Gli altri passano.
export default function RequireFullAccess() {
  const { user } = useAuth()
  if (isFreeUser(user)) return <LockedSection />
  return <Outlet />
}
