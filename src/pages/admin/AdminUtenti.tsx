import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import { ChevronDown, Radio, Upload, Shield } from 'lucide-react'
import { UserPermissions } from '../../types'

interface MockUser {
  id: number
  name: string
  email: string
  role: string
  status: string
  phase: string
  joined: string
  permissions?: UserPermissions
}

const INITIAL_USERS: MockUser[] = [
  { id: 1, name: 'Marco Rossi',     email: 'marco@example.com',  role: 'student',      status: 'active',  phase: 'Build',       joined: '5 Mag' },
  { id: 2, name: 'Anna Pellegrini', email: 'anna@example.com',   role: 'student',      status: 'active',  phase: 'Build',       joined: '8 Mag' },
  { id: 3, name: 'Marta Esposito',  email: 'marta@example.com',  role: 'student',      status: 'blocked', phase: 'Onboarding',  joined: '1 Giu' },
  { id: 4, name: 'Paolo Gallo',     email: 'paolo@example.com',  role: 'student',      status: 'expired', phase: 'Build',       joined: '20 Apr' },
  { id: 5, name: 'Roberto Greco',   email: 'roberto@example.com',role: 'student',      status: 'active',  phase: 'Deploy',      joined: '15 Apr' },
  { id: 6, name: 'Laura Bianchi',   email: 'laura@ist.com',      role: 'coach',        status: 'active',  phase: '—',           joined: '1 Gen', permissions: { canGoLive: true,  canUploadContent: false } },
  { id: 7, name: 'Sofia Verdi',     email: 'sofia@ist.com',      role: 'mental_coach', status: 'active',  phase: '—',           joined: '1 Gen', permissions: { canGoLive: false, canUploadContent: true  } },
]

const ROLE_LABELS: Record<string, string> = {
  student:      'Studente',
  coach:        'Coach',
  mental_coach: 'Mental Coach',
  admin:        'Admin',
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active:  { color: '#46D39A', background: 'rgba(70,211,154,0.12)',  border: '1px solid rgba(70,211,154,0.22)'  },
  expired: { color: '#F6C85F', background: 'rgba(246,200,95,0.12)',  border: '1px solid rgba(246,200,95,0.22)'  },
  blocked: { color: '#FF6B7A', background: 'rgba(255,107,122,0.12)', border: '1px solid rgba(255,107,122,0.22)' },
}
const STATUS_LABELS: Record<string, string> = { active: 'Attivo', expired: 'Scaduto', blocked: 'Bloccato' }

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0" style={STATUS_STYLE[status] ?? {}}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// Permission toggle row
function PermToggle({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: checked ? 'rgba(70,211,154,0.12)' : 'var(--ist-w8)', color: checked ? '#46D39A' : 'var(--ist-text-dim)' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--ist-text)' }}>{label}</p>
        <p className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 w-10 h-5.5 rounded-full transition-all"
        style={{
          background: checked ? '#46D39A' : 'var(--ist-w10)',
          boxShadow: checked ? '0 0 8px rgba(70,211,154,0.35)' : 'none',
          width: 40, height: 22,
        }}
        aria-checked={checked}
        role="switch"
      >
        <span
          className="absolute top-0.5 rounded-full bg-white transition-all shadow"
          style={{
            width: 18, height: 18,
            left: checked ? 20 : 2,
          }}
        />
      </button>
    </div>
  )
}

// Expanded permissions panel for coach / mental_coach
function PermissionsPanel({
  user,
  onUpdate,
}: {
  user: MockUser
  onUpdate: (id: number, perms: UserPermissions) => void
}) {
  const perms = user.permissions ?? {}
  const set = (key: keyof UserPermissions, val: boolean) =>
    onUpdate(user.id, { ...perms, [key]: val })

  return (
    <div
      className="mt-3 p-4 rounded-2xl space-y-3"
      style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2" style={{ color: 'var(--ist-text-dim)' }}>
        <Shield size={10} strokeWidth={2.5} />
        Permessi delegati
      </p>
      <PermToggle
        icon={<Radio size={14} strokeWidth={2} />}
        label="Può andare live"
        description="Abilita questo utente a condurre sessioni live"
        checked={perms.canGoLive ?? false}
        onChange={v => set('canGoLive', v)}
      />
      <PermToggle
        icon={<Upload size={14} strokeWidth={2} />}
        label="Può caricare contenuti"
        description="Abilita caricamento video e materiali sulla piattaforma"
        checked={perms.canUploadContent ?? false}
        onChange={v => set('canUploadContent', v)}
      />
    </div>
  )
}

// Single user row
function UserRow({
  user,
  onUpdatePerms,
}: {
  user: MockUser
  onUpdatePerms: (id: number, perms: UserPermissions) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasPerms = user.role === 'coach' || user.role === 'mental_coach'

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        background: 'var(--ist-card-bg)',
        border: '1px solid var(--ist-border)',
        boxShadow: 'var(--ist-card-shadow)',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-4"
        onClick={() => hasPerms && setExpanded(e => !e)}
        style={{ cursor: hasPerms ? 'pointer' : 'default' }}
      >
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(90,154,177,0.22), rgba(40,102,128,0.22))',
            color: 'var(--ist-accent-text)',
          }}
        >
          {user.name.charAt(0)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--ist-text)' }}>
            {user.name}
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--ist-text-dim)' }}>
            {user.email}
          </p>
        </div>

        {/* Role */}
        <span className="text-xs hidden sm:block flex-shrink-0" style={{ color: 'var(--ist-text-muted)' }}>
          {ROLE_LABELS[user.role]}
        </span>

        {/* Phase — students only */}
        {user.phase !== '—' && (
          <span className="text-xs hidden md:block flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }}>
            {user.phase}
          </span>
        )}

        <StatusBadge status={user.status} />

        <button
          className="text-xs font-medium flex-shrink-0 px-3 py-1.5 rounded-xl transition-colors hover:bg-white/[0.04]"
          style={{ color: 'var(--ist-accent-text)' }}
          onClick={e => { e.stopPropagation(); /* open edit modal */ }}
        >
          Modifica
        </button>

        {hasPerms && (
          <ChevronDown
            size={14}
            strokeWidth={2}
            style={{
              color: 'var(--ist-text-dim)',
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {/* Permissions panel */}
      {expanded && hasPerms && (
        <div className="px-4 pb-4">
          <PermissionsPanel user={user} onUpdate={onUpdatePerms} />
        </div>
      )}
    </div>
  )
}

export default function AdminUtenti() {
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [users, setUsers]     = useState<MockUser[]>(INITIAL_USERS)

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const updatePerms = (id: number, perms: UserPermissions) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, permissions: perms } : u))
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--ist-w6)',
    border: '1px solid var(--ist-border)',
    borderRadius: 18,
    color: 'var(--ist-text)',
    outline: 'none',
  }

  return (
    <div className="p-5 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Gestione Utenti"
        subtitle={`${users.length} utenti totali`}
        action={
          <button
            className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 24px rgba(40,102,128,0.36)',
            }}
          >
            + Nuovo
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca utente..."
          className="flex-1 min-w-[200px] max-w-sm px-4 py-2.5 text-sm placeholder:opacity-40"
          style={inputStyle}
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 text-sm"
          style={inputStyle}
        >
          <option value="all">Tutti i ruoli</option>
          <option value="student">Studenti</option>
          <option value="coach">Coach</option>
          <option value="mental_coach">Mental Coach</option>
        </select>
      </div>

      {/* Permission info banner for coaches */}
      {(roleFilter === 'coach' || roleFilter === 'mental_coach' || roleFilter === 'all') && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-2xl mb-4"
          style={{
            background: 'rgba(90,154,177,0.07)',
            border: '1px solid rgba(90,154,177,0.15)',
          }}
        >
          <Shield size={14} strokeWidth={2} style={{ color: 'var(--ist-accent-text)', flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
            I coach e mental coach con permessi delegati compaiono con un indicatore espandibile. Tocca la riga per gestire i permessi.
          </p>
        </div>
      )}

      {/* Users list */}
      <div className="space-y-2.5">
        {filtered.map(user => (
          <UserRow key={user.id} user={user} onUpdatePerms={updatePerms} />
        ))}

        {filtered.length === 0 && (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            Nessun utente trovato.
          </p>
        )}
      </div>
    </div>
  )
}
