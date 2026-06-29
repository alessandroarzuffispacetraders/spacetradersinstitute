import { Outlet, useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { normalizeRoles } from '../../router/navConfig'
import { UserRole } from '../../types'

// Protegge un gruppo di rotte: le mostra solo se l'utente ha uno dei ruoli indicati,
// altrimenti mostra un 403. Le pagine "d'uso" (/student/*) restano aperte a tutti.
export default function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) return null
  const myRoles = normalizeRoles(user.role, user.roles)
  if (roles.some(r => myRoles.includes(r))) return <Outlet />

  return (
    <div className="flex flex-col items-center justify-center text-center px-8 min-h-[70vh]">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,107,122,0.12)', color: '#FF6B7A' }}>
        <ShieldAlert size={26} strokeWidth={2} />
      </div>
      <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--ist-text)' }}>Accesso non autorizzato</h1>
      <p className="text-sm mb-5 max-w-xs" style={{ color: 'var(--ist-text-dim)' }}>
        Non hai i permessi per accedere a questa sezione.
      </p>
      <button
        onClick={() => navigate('/')}
        className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
        style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', boxShadow: '0 4px 14px rgba(40,102,128,0.3)' }}
      >
        Torna alla home
      </button>
    </div>
  )
}
