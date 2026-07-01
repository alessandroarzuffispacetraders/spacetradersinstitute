import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AccessWall from './AccessWall'

// Cancello d'accesso: solo gli STUDENTI sono soggetti allo stato.
// Uno studente non 'active' (pending/blocked/expired) vede il muro, non l'app.
// Staff e admin non sono mai bloccati.
export default function AccessGate() {
  const { user } = useAuth()
  if (user && user.role === 'student' && user.status && user.status !== 'active') {
    return <AccessWall status={user.status} />
  }
  return <Outlet />
}
