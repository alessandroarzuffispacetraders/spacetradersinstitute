import { useState, useEffect } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import { ChevronDown, Radio, Upload, Shield, X, Loader2, Mail, KeyRound, Trash2, Globe, MapPin } from 'lucide-react'
import { UserPermissions, UserRole, StudentStatus, StudentPhase, UserTier } from '../../types'
import { supabase } from '../../lib/supabase'
import { updateUserAuth, deleteUserAccount } from '../../lib/adminUsers'
import { useAccessSummaries, fetchUserAccessLogs, AccessSummary, AccessLog } from '../../lib/accessLog'

const STAFF_ROLES: UserRole[] = ['coach', 'mental_coach', 'admin']

interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  roles: UserRole[] | null
  status: StudentStatus | null
  tier: UserTier | null
  phase: StudentPhase | null
  permissions: UserPermissions | null
  assigned_coach_id: string | null
  assigned_mental_coach_id: string | null
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Studente',
  coach: 'Coach',
  mental_coach: 'Mental Coach',
  admin: 'Admin',
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active:  { color: '#46D39A', background: 'rgba(70,211,154,0.12)',  border: '1px solid rgba(70,211,154,0.22)'  },
  pending: { color: '#7CBBD0', background: 'rgba(90,154,177,0.12)',  border: '1px solid rgba(90,154,177,0.22)'  },
  expired: { color: '#F6C85F', background: 'rgba(246,200,95,0.12)',  border: '1px solid rgba(246,200,95,0.22)'  },
  blocked: { color: '#FF6B7A', background: 'rgba(255,107,122,0.12)', border: '1px solid rgba(255,107,122,0.22)' },
}
const STATUS_LABELS: Record<string, string> = { active: 'Attivo', pending: 'In attesa', expired: 'Scaduto', blocked: 'Bloccato' }

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0" style={STATUS_STYLE[status] ?? {}}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// Badge del piano: mostrato solo per l'utente gratuito (i paganti non hanno badge).
function TierBadge({ tier }: { tier: UserTier | null }) {
  if (tier !== 'free') return null
  return (
    <span
      className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
      style={{ color: '#7CBBD0', background: 'rgba(124,187,208,0.14)', border: '1px solid rgba(124,187,208,0.28)' }}
    >
      Free
    </span>
  )
}

function PermToggle({ icon, label, description, checked, onChange }: {
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
        className="relative flex-shrink-0 rounded-full transition-all"
        style={{ background: checked ? '#46D39A' : 'var(--ist-w10)', boxShadow: checked ? '0 0 8px rgba(70,211,154,0.35)' : 'none', width: 40, height: 22 }}
        role="switch"
        aria-checked={checked}
      >
        <span className="absolute top-0.5 rounded-full bg-white transition-all shadow" style={{ width: 18, height: 18, left: checked ? 20 : 2 }} />
      </button>
    </div>
  )
}

// ── Edit Modal ──────────────────────────────────────────────────────────────

function EditModal({ user, coaches, mentalCoaches, onClose, onSave, onDelete }: {
  user: Profile
  coaches: Profile[]
  mentalCoaches: Profile[]
  onClose: () => void
  onSave: (updated: Profile) => void
  onDelete: (id: string) => void
}) {
  const [role, setRole] = useState<UserRole>(user.role)
  const [extraRoles, setExtraRoles] = useState<UserRole[]>(user.roles ?? [])
  const [status, setStatus] = useState<StudentStatus | null>(user.status)
  const [tier, setTier] = useState<UserTier>(user.tier ?? 'full')
  const [phase, setPhase] = useState<StudentPhase | null>(user.phase)
  const [permissions, setPermissions] = useState<UserPermissions>(user.permissions ?? {})
  const [assignedCoach, setAssignedCoach] = useState<string | null>(user.assigned_coach_id)
  const [assignedMental, setAssignedMental] = useState<string | null>(user.assigned_mental_coach_id)
  const [email, setEmail] = useState(user.email)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    const { error } = await deleteUserAccount(user.id)
    if (error) { setError(error); setDeleting(false); return }
    onDelete(user.id)
    onClose()
  }

  const ALL_ROLES: UserRole[] = ['student', 'coach', 'mental_coach', 'admin']
  const ALL_STATUSES: StudentStatus[] = ['active', 'pending', 'expired', 'blocked']
  const ALL_PHASES: StudentPhase[] = ['onboarding', 'build', 'test', 'deploy']

  const toggleExtraRole = (r: UserRole) => {
    setExtraRoles(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const allRoles = Array.from(new Set([role, ...extraRoles]))
    const isStudent = role === 'student'
    const isStaffTarget = STAFF_ROLES.includes(role) || extraRoles.some(r => STAFF_ROLES.includes(r))
    const emailChanged = email.trim() !== user.email

    // Email/password vanno cambiate via edge function (API admin, lato server)
    if (isStaffTarget && (emailChanged || newPassword.length > 0)) {
      const { error: authErr } = await updateUserAuth(user.id, {
        email: emailChanged ? email.trim() : undefined,
        password: newPassword.length > 0 ? newPassword : undefined,
      })
      if (authErr) { setError(authErr); setSaving(false); return }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        role,
        roles: allRoles.length > 1 ? allRoles : null,
        status: isStudent ? status : null,
        tier: isStudent ? tier : 'full',
        phase: isStudent ? phase : null,
        permissions: (role === 'coach' || role === 'mental_coach' || allRoles.includes('coach') || allRoles.includes('mental_coach'))
          ? permissions
          : null,
        assigned_coach_id: isStudent ? assignedCoach : null,
        assigned_mental_coach_id: isStudent ? assignedMental : null,
      })
      .eq('id', user.id)

    if (error) {
      setError(error.message || 'Errore nel salvataggio. Riprova.')
      setSaving(false)
      return
    }

    onSave({
      ...user, role, roles: allRoles.length > 1 ? allRoles : null, status,
      tier: isStudent ? tier : 'full', phase, permissions,
      email: emailChanged ? email.trim() : user.email,
      assigned_coach_id: isStudent ? assignedCoach : null,
      assigned_mental_coach_id: isStudent ? assignedMental : null,
    })
    onClose()
  }

  const selectStyle: React.CSSProperties = {
    background: 'var(--ist-w8)',
    border: '1px solid var(--ist-border)',
    borderRadius: 14,
    color: 'var(--ist-text)',
    padding: '10px 14px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  }

  const showPermissions = role === 'coach' || role === 'mental_coach'
    || extraRoles.includes('coach') || extraRoles.includes('mental_coach')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <div
        className="w-full max-w-md rounded-3xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: 'var(--ist-card-shadow-premium)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--ist-text)' }}>{user.name}</p>
            <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>{user.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.06]" style={{ color: 'var(--ist-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Ruolo primario */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>Ruolo primario</label>
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} style={selectStyle}>
            {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>

        {/* Ruoli aggiuntivi */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>Ruoli aggiuntivi</label>
          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.filter(r => r !== role).map(r => {
              const active = extraRoles.includes(r)
              return (
                <button
                  key={r}
                  onClick={() => toggleExtraRole(r)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: active ? 'rgba(90,154,177,0.18)' : 'var(--ist-w8)',
                    border: active ? '1px solid rgba(90,154,177,0.4)' : '1px solid var(--ist-border)',
                    color: active ? 'var(--ist-accent-text)' : 'var(--ist-text-muted)',
                  }}
                >
                  {ROLE_LABELS[r]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Account di accesso — solo staff (coach / mental coach / admin) */}
        {(STAFF_ROLES.includes(role) || extraRoles.some(r => STAFF_ROLES.includes(r))) && (
          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--ist-text-dim)' }}>
              <KeyRound size={10} strokeWidth={2.5} /> Account di accesso
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-xs flex items-center gap-1.5" style={{ color: 'var(--ist-text-dim)' }}>
                <Mail size={11} strokeWidth={2} /> Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={selectStyle} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs flex items-center gap-1.5" style={{ color: 'var(--ist-text-dim)' }}>
                <KeyRound size={11} strokeWidth={2} /> Nuova password
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Lascia vuoto per non cambiarla"
                style={selectStyle}
              />
              <p className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>Min. 6 caratteri. Comunica tu la nuova password all'utente.</p>
            </div>
          </div>
        )}

        {/* Stato e fase — solo studenti */}
        {role === 'student' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>Stato</label>
              <select value={status ?? 'active'} onChange={e => setStatus(e.target.value as StudentStatus)} style={selectStyle}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>Fase</label>
              <select value={phase ?? 'onboarding'} onChange={e => setPhase(e.target.value as StudentPhase)} style={selectStyle}>
                {ALL_PHASES.map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Piano — solo studenti (gratuito vs completo) */}
        {role === 'student' && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>Piano</label>
            <select value={tier} onChange={e => setTier(e.target.value as UserTier)} style={selectStyle}>
              <option value="full">Completo (pagante)</option>
              <option value="free">Gratuito (anteprima)</option>
            </select>
            <p className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
              L'utente gratuito accede solo ai contenuti in vetrina. Passa a "Completo" quando attivi il pagamento.
            </p>
          </div>
        )}

        {/* Assegnazione coach / mental coach — solo studenti */}
        {role === 'student' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>Coach assegnato</label>
              <select value={assignedCoach ?? ''} onChange={e => setAssignedCoach(e.target.value || null)} style={selectStyle}>
                <option value="">— Nessuno —</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>Mental coach assegnato</label>
              <select value={assignedMental ?? ''} onChange={e => setAssignedMental(e.target.value || null)} style={selectStyle}>
                <option value="">— Nessuno —</option>
                {mentalCoaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Permessi — coach / mental coach */}
        {showPermissions && (
          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--ist-text-dim)' }}>
              <Shield size={10} strokeWidth={2.5} /> Permessi delegati
            </p>
            <PermToggle
              icon={<Radio size={14} strokeWidth={2} />}
              label="Può andare live"
              description="Abilita a condurre sessioni live"
              checked={permissions.canGoLive ?? false}
              onChange={v => setPermissions(p => ({ ...p, canGoLive: v }))}
            />
            <PermToggle
              icon={<Upload size={14} strokeWidth={2} />}
              label="Può caricare contenuti"
              description="Abilita caricamento video e materiali"
              checked={permissions.canUploadContent ?? false}
              onChange={v => setPermissions(p => ({ ...p, canUploadContent: v }))}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        {/* Danger zone — elimina utente */}
        {confirmDelete ? (
          <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,107,122,0.08)', border: '1px solid rgba(255,107,122,0.22)' }}>
            <p className="text-xs mb-2.5" style={{ color: '#FF6B7A' }}>
              Eliminare definitivamente <strong>{user.name}</strong>? L'account e i suoi dati verranno rimossi. Irreversibile.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-60 flex items-center gap-1.5"
                style={{ background: '#E5484D' }}
              >
                {deleting && <Loader2 size={12} className="animate-spin" />}
                {deleting ? 'Elimino...' : 'Conferma eliminazione'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
              >
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="self-start text-xs font-medium flex items-center gap-1.5 transition-colors hover:opacity-80"
            style={{ color: '#FF6B7A' }}
          >
            <Trash2 size={13} strokeWidth={2} /> Elimina utente
          </button>
        )}

        {/* Azioni */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
            style={{ background: 'var(--ist-w8)', border: '1px solid var(--ist-border)', color: 'var(--ist-text-muted)' }}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', boxShadow: '0 4px 16px rgba(90,154,177,0.3)' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Access helpers ────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function deviceLabel(ua: string | null): string {
  if (!ua) return 'Dispositivo sconosciuto'
  let os = ''
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/Linux/.test(ua)) os = 'Linux'
  let br = ''
  if (/Edg\//.test(ua)) br = 'Edge'
  else if (/Chrome\//.test(ua)) br = 'Chrome'
  else if (/Firefox\//.test(ua)) br = 'Firefox'
  else if (/Safari\//.test(ua)) br = 'Safari'
  const parts = [os, br].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Dispositivo sconosciuto'
}

// Badge "accessi da luoghi diversi" (possibile condivisione account).
function AccessBadge({ summary }: { summary?: AccessSummary }) {
  if (!summary || !summary.suspicious) return null
  const danger = summary.distinctCountries >= 2
  const style = danger
    ? { color: '#FF6B7A', background: 'rgba(255,107,122,0.12)', border: '1px solid rgba(255,107,122,0.24)' }
    : { color: '#F6C85F', background: 'rgba(246,200,95,0.12)', border: '1px solid rgba(246,200,95,0.24)' }
  const text = danger ? `${summary.distinctCountries} paesi` : `${summary.distinctCities} città`
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
      style={style}
      title={`Accessi da luoghi diversi: ${summary.places.join(' · ')}`}
    >
      <Globe size={10} strokeWidth={2.5} />
      {text}
    </span>
  )
}

// ── User Row ────────────────────────────────────────────────────────────────

function UserRow({ user, summary, onEdit, onUpdatePerms, onActivate, onPromote }: {
  user: Profile
  summary?: AccessSummary
  onEdit: (u: Profile) => void
  onUpdatePerms: (id: string, perms: UserPermissions) => void
  onActivate: (id: string) => void
  onPromote: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [logs, setLogs] = useState<AccessLog[] | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const hasPerms = user.role === 'coach' || user.role === 'mental_coach'
    || (user.roles ?? []).some(r => r === 'coach' || r === 'mental_coach')

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next && logs === null) {
      setLogsLoading(true)
      fetchUserAccessLogs(user.id).then(l => { setLogs(l); setLogsLoading(false) })
    }
  }

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: 'var(--ist-card-shadow)' }}>
      <div
        className="flex items-center gap-3 px-4 py-4 cursor-pointer"
        onClick={toggle}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(90,154,177,0.22), rgba(40,102,128,0.22))', color: 'var(--ist-accent-text)' }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--ist-text)' }}>{user.name}</p>
          <p className="text-[11px] truncate" style={{ color: 'var(--ist-text-dim)' }}>{user.email}</p>
        </div>

        <span className="text-xs hidden sm:block flex-shrink-0" style={{ color: 'var(--ist-text-muted)' }}>
          {ROLE_LABELS[user.role]}
          {user.roles && user.roles.length > 1 && (
            <span style={{ color: 'var(--ist-text-dim)' }}> +{user.roles.length - 1}</span>
          )}
        </span>

        {user.phase && (
          <span className="text-xs hidden md:block flex-shrink-0 capitalize" style={{ color: 'var(--ist-text-dim)' }}>
            {user.phase}
          </span>
        )}

        <AccessBadge summary={summary} />

        <TierBadge tier={user.tier} />

        <StatusBadge status={user.status} />

        {user.role === 'student' && user.status !== 'active' && (
          <button
            className="text-xs font-bold flex-shrink-0 px-3 py-1.5 rounded-xl text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #46D39A, #2a8060)' }}
            onClick={e => { e.stopPropagation(); onActivate(user.id) }}
            title="Attiva l'accesso (lifetime)"
          >
            Attiva
          </button>
        )}

        {user.role === 'student' && user.tier === 'free' && (
          <button
            className="text-xs font-bold flex-shrink-0 px-3 py-1.5 rounded-xl text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
            onClick={e => { e.stopPropagation(); onPromote(user.id) }}
            title="Passa l'utente al piano completo"
          >
            Promuovi
          </button>
        )}

        <button
          className="text-xs font-medium flex-shrink-0 px-3 py-1.5 rounded-xl transition-colors hover:bg-white/[0.04]"
          style={{ color: 'var(--ist-accent-text)' }}
          onClick={e => { e.stopPropagation(); onEdit(user) }}
        >
          Modifica
        </button>

        <ChevronDown
          size={14}
          strokeWidth={2}
          style={{ color: 'var(--ist-text-dim)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        />
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Storico accessi */}
          <div className="p-4 rounded-2xl" style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-3 flex-wrap" style={{ color: 'var(--ist-text-dim)' }}>
              <Globe size={10} strokeWidth={2.5} /> Accessi recenti
              {summary && (
                <span className="font-medium normal-case tracking-normal" style={{ color: 'var(--ist-text-dim)' }}>
                  · {summary.logins} accessi · {summary.distinctIps} IP · {summary.distinctCities} città
                </span>
              )}
            </p>
            {logsLoading ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} /></div>
            ) : !logs || logs.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>Nessun accesso registrato per ora.</p>
            ) : (
              <div>
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 py-2"
                    style={i > 0 ? { borderTop: '1px solid var(--ist-w6)' } : {}}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--ist-text)' }}>
                        <MapPin size={11} strokeWidth={2} style={{ color: 'var(--ist-text-dim)', flexShrink: 0 }} />
                        {l.city ? `${l.city}${l.country ? ', ' + l.country : ''}` : 'Posizione sconosciuta'}
                      </p>
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--ist-text-dim)' }}>
                        {l.ip ?? '—'} · {deviceLabel(l.userAgent)}
                      </p>
                    </div>
                    <span className="text-[10px] flex-shrink-0 whitespace-nowrap" style={{ color: 'var(--ist-text-dim)' }}>
                      {formatDateTime(l.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permessi delegati (coach / mental coach) */}
          {hasPerms && (
            <div className="p-4 rounded-2xl space-y-3" style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2" style={{ color: 'var(--ist-text-dim)' }}>
                <Shield size={10} strokeWidth={2.5} /> Permessi delegati
              </p>
              <PermToggle
                icon={<Radio size={14} strokeWidth={2} />}
                label="Può andare live"
                description="Abilita questo utente a condurre sessioni live"
                checked={user.permissions?.canGoLive ?? false}
                onChange={v => onUpdatePerms(user.id, { ...user.permissions, canGoLive: v })}
              />
              <PermToggle
                icon={<Upload size={14} strokeWidth={2} />}
                label="Può caricare contenuti"
                description="Abilita caricamento video e materiali sulla piattaforma"
                checked={user.permissions?.canUploadContent ?? false}
                onChange={v => onUpdatePerms(user.id, { ...user.permissions, canUploadContent: v })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function AdminUtenti() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const { summaries } = useAccessSummaries()

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setUsers(data as Profile[])
        setLoading(false)
      })
  }, [])

  const hasRole = (u: Profile, r: UserRole) => u.role === r || (u.roles ?? []).includes(r)
  const coaches = users.filter(u => hasRole(u, 'coach'))
  const mentalCoaches = users.filter(u => hasRole(u, 'mental_coach'))

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const handleSave = (updated: Profile) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
  }

  const handleDelete = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  const handleUpdatePerms = async (id: string, perms: UserPermissions) => {
    await supabase.from('profiles').update({ permissions: perms }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, permissions: perms } : u))
  }

  // Attivazione rapida: accesso a vita (nessuna scadenza).
  const handleActivate = async (id: string) => {
    await supabase.from('profiles').update({ status: 'active' }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'active' } : u))
  }

  // Promozione rapida: da gratuito a piano completo (accesso pieno).
  const handlePromote = async (id: string) => {
    await supabase.from('profiles').update({ tier: 'full' }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, tier: 'full' } : u))
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
        subtitle={loading ? 'Caricamento...' : `${users.length} utenti totali`}
        action={
          <button
            className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(40,102,128,0.36)' }}
          >
            + Nuovo
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca utente..."
          className="flex-1 min-w-[200px] max-w-sm px-4 py-2.5 text-sm placeholder:opacity-40"
          style={inputStyle}
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-4 py-2.5 text-sm" style={inputStyle}>
          <option value="all">Tutti i ruoli</option>
          <option value="student">Studenti</option>
          <option value="coach">Coach</option>
          <option value="mental_coach">Mental Coach</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(user => (
            <UserRow
              key={user.id}
              user={user}
              summary={summaries[user.id]}
              onEdit={setEditingUser}
              onUpdatePerms={handleUpdatePerms}
              onActivate={handleActivate}
              onPromote={handlePromote}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--ist-text-dim)' }}>
              Nessun utente trovato.
            </p>
          )}
        </div>
      )}

      {editingUser && (
        <EditModal
          user={editingUser}
          coaches={coaches}
          mentalCoaches={mentalCoaches}
          onClose={() => setEditingUser(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
