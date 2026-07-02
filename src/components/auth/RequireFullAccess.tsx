import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isFreeUser } from '../../lib/freeTier'
import UpgradeWall from './UpgradeWall'

// Cancello "solo paganti": l'utente gratuito vede l'upsell al posto della pagina,
// anche navigando via URL diretto. Gli altri passano.
export default function RequireFullAccess() {
  const { user } = useAuth()
  if (isFreeUser(user)) return <UpgradeWall />
  return <Outlet />
}
