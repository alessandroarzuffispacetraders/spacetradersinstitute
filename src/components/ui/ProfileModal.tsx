import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Camera, Eye, EyeOff, Check, Lock, User as UserIcon,
  ChevronRight, Upload, Bell, BellOff, Loader2,
  BookMarked, ExternalLink,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import UserAvatar, { PRESET_AVATARS } from './UserAvatar'
import { subscribeToPush, unsubscribeFromPush } from '../../lib/push'
import { uploadAvatar, deleteAvatar } from '../../lib/storage'
import { isNativeApp } from '../../lib/nativeUi'
import { PushNotifications } from '@capacitor/push-notifications'

const ROLE_LABELS: Record<string, string> = {
  student: 'Studente',
  coach: 'Coach',
  mental_coach: 'Mental Coach',
  admin: 'Admin',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:  { label: 'Attivo',   color: '#46D39A' },
  pending: { label: 'In attesa', color: '#7CBBD0' },
  expired: { label: 'Scaduto',  color: '#F6C85F' },
  blocked: { label: 'Bloccato', color: '#FF6B7A' },
}

type Section = 'main' | 'avatar' | 'name' | 'password' | 'notifications'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function ProfileModal({ isOpen, onClose }: Props) {
  const { user, updateProfile, changePassword } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [section, setSection] = useState<Section>('main')

  // Naviga a una pagina "strumento" (Diario/Journal) e chiude il modale.
  const goTo = (path: string) => { onClose(); navigate(path) }

  // Avatar upload
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  // Name edit
  const [nameValue, setNameValue] = useState('')
  const [nameSaved, setNameSaved] = useState(false)

  // Password
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    if (isOpen && user) {
      setNameValue(user.name)
      setSection('main')
      setNameSaved(false)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setPwError(''); setPwSaved(false); setPwBusy(false)
      setAvatarBusy(false); setAvatarError('')
    }
  }, [isOpen, user])

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen || !user) return null

  const handleAvatarPreset = (presetId: string) => {
    setAvatarError('')
    updateProfile({ avatarPreset: presetId, avatarUrl: undefined })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setAvatarError('')
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Immagine troppo grande (max 5 MB)')
      return
    }
    setAvatarBusy(true)
    const url = await uploadAvatar(user.id, file)
    setAvatarBusy(false)
    if (!url) {
      setAvatarError('Caricamento non riuscito. Riprova.')
      return
    }
    await updateProfile({ avatarUrl: url, avatarPreset: undefined })
    setSection('main')
  }

  const handleRemovePhoto = async () => {
    if (!user) return
    setAvatarError('')
    await deleteAvatar(user.id)
    await updateProfile({ avatarUrl: undefined, avatarPreset: user.avatarPreset ?? 'blue' })
  }

  const handleSaveName = () => {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === user.name) { setSection('main'); return }
    updateProfile({ name: trimmed })
    setNameSaved(true)
    setTimeout(() => { setNameSaved(false); setSection('main') }, 1200)
  }

  const handleSavePassword = async () => {
    setPwError('')
    if (!pwCurrent) { setPwError('Inserisci la password attuale'); return }
    if (pwNew.length < 8) { setPwError('La nuova password deve essere di almeno 8 caratteri'); return }
    if (pwNew !== pwConfirm) { setPwError('Le password non coincidono'); return }
    setPwBusy(true)
    const { error } = await changePassword(pwCurrent, pwNew)
    setPwBusy(false)
    if (error) { setPwError(error); return }
    setPwSaved(true)
    setTimeout(() => {
      setPwSaved(false)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setSection('main')
    }, 1400)
  }

  const pwValid = pwCurrent.length > 0 && pwNew.length >= 8 && pwNew === pwConfirm

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* Modal — la vista principale è più larga (orizzontale su desktop);
          le sotto-schermate (form) restano strette. */}
      <div
        className="fixed z-[101] left-1/2 top-1/2 w-full"
        style={{
          transform: 'translate(-50%, -50%)',
          maxWidth: section === 'main' ? 720 : 420,
          padding: '0 16px',
          animation: 'profileModalIn 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="w-full rounded-[28px] overflow-y-auto no-scrollbar"
          style={{
            maxHeight: '90vh',
            background: 'var(--ist-nav-bg)',
            border: '1px solid var(--ist-nav-border)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
          }}
        >
          {/* ── MAIN SECTION ── */}
          {section === 'main' && (
            <>
              <ModalHeader title="Profilo" onClose={onClose} />

              {/* Layout: colonna identità + colonna azioni (orizzontale su desktop) */}
              <div className="lg:flex">
                {/* ── Identità ── */}
                <div
                  className="flex flex-col items-center text-center gap-3 px-6 pt-6 pb-6 border-b lg:border-b-0 lg:border-r lg:w-[248px] lg:flex-shrink-0 lg:justify-center"
                  style={{ borderColor: 'var(--ist-w8)' }}
                >
                  <div className="relative">
                    <UserAvatar user={user} size={84} />
                    <button
                      onClick={() => setSection('avatar')}
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                      style={{ background: '#5A9AB1', border: '2px solid var(--ist-nav-bg)' }}
                      title="Cambia immagine"
                    >
                      <Camera size={13} strokeWidth={2.5} color="white" />
                    </button>
                  </div>
                  <div>
                    <p className="font-semibold text-base leading-tight" style={{ color: 'var(--ist-text)' }}>
                      {user.name}
                    </p>
                    <p className="text-xs mt-1 break-all" style={{ color: 'var(--ist-text-muted)' }}>
                      {user.email}
                    </p>
                  </div>

                  {/* Badges ruolo + stato */}
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <span
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(90,154,177,0.15)', color: '#7CBBD0', border: '1px solid rgba(90,154,177,0.25)' }}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                    {user.status && STATUS_LABELS[user.status] && (
                      <span
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: `${STATUS_LABELS[user.status].color}18`,
                          color: STATUS_LABELS[user.status].color,
                          border: `1px solid ${STATUS_LABELS[user.status].color}30`,
                        }}
                      >
                        {STATUS_LABELS[user.status].label}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Azioni ── */}
                <div className="flex-1 min-w-0 px-5 pt-5 pb-5 flex flex-col gap-4">
                  {/* Strumenti — tile grandi (2 col) */}
                  <div>
                    <SectionLabel>Strumenti</SectionLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Tile
                        icon={<BookMarked size={18} strokeWidth={2} />}
                        label="Diario"
                        hint="di trading"
                        onClick={() => goTo('/student/diario')}
                      />
                      <Tile
                        icon={<ExternalLink size={18} strokeWidth={2} />}
                        label="Protocol"
                        hint="Data Journal"
                        onClick={() => goTo('/student/journal')}
                      />
                    </div>
                  </div>

                  {/* Account — tile piccoli (3 col) */}
                  <div>
                    <SectionLabel>Account</SectionLabel>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Tile
                        icon={<UserIcon size={18} strokeWidth={2} />}
                        label="Nome"
                        compact
                        onClick={() => { setNameValue(user.name); setSection('name') }}
                      />
                      <Tile
                        icon={<Lock size={18} strokeWidth={2} />}
                        label="Password"
                        compact
                        onClick={() => setSection('password')}
                      />
                      <Tile
                        icon={<Bell size={18} strokeWidth={2} />}
                        label="Notifiche"
                        compact
                        onClick={() => setSection('notifications')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── AVATAR SECTION ── */}
          {section === 'avatar' && (
            <>
              <ModalHeader title="Immagine profilo" onBack={() => setSection('main')} onClose={onClose} />

              <div className="px-5 pb-6">
                {/* Current avatar preview */}
                <div className="flex justify-center py-5">
                  <UserAvatar user={user} size={88} />
                </div>

                {/* Preset grid */}
                <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>
                  Stili preimpostati
                </p>
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {PRESET_AVATARS.map(preset => {
                    const isSelected = !user.avatarUrl && user.avatarPreset === preset.id
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleAvatarPreset(preset.id)}
                        className="flex flex-col items-center gap-1.5 py-2 rounded-2xl transition-all active:scale-95"
                        style={{
                          background: isSelected ? 'rgba(90,154,177,0.14)' : 'var(--ist-w6)',
                          border: isSelected ? '1px solid rgba(90,154,177,0.35)' : '1px solid var(--ist-w8)',
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm relative"
                          style={{ background: preset.gradient }}
                        >
                          {user.name.charAt(0).toUpperCase()}
                          {isSelected && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#46D39A' }}>
                              <Check size={9} strokeWidth={3} color="white" />
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] font-medium" style={{ color: 'var(--ist-text-muted)' }}>
                          {preset.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Upload custom */}
                <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>
                  Foto personalizzata
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarBusy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.98]"
                  style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', opacity: avatarBusy ? 0.6 : 1 }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.18)' }}
                  >
                    {avatarBusy
                      ? <Loader2 size={16} strokeWidth={2} className="animate-spin" style={{ color: '#7CBBD0' }} />
                      : <Upload size={16} strokeWidth={2} style={{ color: '#7CBBD0' }} />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium" style={{ color: 'var(--ist-text)' }}>
                      {avatarBusy ? 'Caricamento…' : 'Carica immagine'}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--ist-text-muted)' }}>PNG, JPG, WEBP — max 5 MB</p>
                  </div>
                </button>

                {avatarError && (
                  <p className="text-xs mt-2 px-1" style={{ color: '#FF6B7A' }}>{avatarError}</p>
                )}

                {user.avatarUrl && (
                  <button
                    onClick={handleRemovePhoto}
                    disabled={avatarBusy}
                    className="w-full mt-2 py-2.5 rounded-2xl text-sm font-medium transition-all"
                    style={{ color: '#FF6B7A', background: 'rgba(255,107,122,0.08)', border: '1px solid rgba(255,107,122,0.15)' }}
                  >
                    Rimuovi foto
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── NAME SECTION ── */}
          {section === 'name' && (
            <>
              <ModalHeader title="Nome visualizzato" onBack={() => setSection('main')} onClose={onClose} />
              <div className="px-5 pb-6 pt-2">
                <p className="text-xs mb-4" style={{ color: 'var(--ist-text-muted)' }}>
                  Il nome che vedi su dashboard, chat e profilo pubblico.
                </p>
                <input
                  autoFocus
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                  style={{
                    background: 'var(--ist-w8)',
                    border: '1px solid var(--ist-w12)',
                    color: 'var(--ist-text)',
                  }}
                  placeholder="Il tuo nome..."
                />
                <button
                  onClick={handleSaveName}
                  disabled={!nameValue.trim() || nameSaved}
                  className="w-full mt-3 py-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  style={{
                    background: nameSaved ? 'rgba(70,211,154,0.15)' : 'rgba(90,154,177,0.20)',
                    border: nameSaved ? '1px solid rgba(70,211,154,0.30)' : '1px solid rgba(90,154,177,0.30)',
                    color: nameSaved ? '#46D39A' : '#7CBBD0',
                    opacity: !nameValue.trim() ? 0.5 : 1,
                  }}
                >
                  {nameSaved ? <><Check size={15} strokeWidth={2.5} /> Salvato</> : 'Salva nome'}
                </button>
              </div>
            </>
          )}

          {/* ── NOTIFICATIONS SECTION ── */}
          {section === 'notifications' && (
            <NotificationsSection onBack={() => setSection('main')} onClose={onClose} />
          )}

          {/* ── PASSWORD SECTION ── */}
          {section === 'password' && (
            <>
              <ModalHeader title="Cambia password" onBack={() => setSection('main')} onClose={onClose} />
              <div className="px-5 pb-6 pt-2 flex flex-col gap-3">
                <p className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
                  Scegli una password sicura di almeno 8 caratteri.
                </p>

                <PasswordField
                  label="Password attuale"
                  value={pwCurrent}
                  onChange={setPwCurrent}
                  show={showCurrent}
                  toggleShow={() => setShowCurrent(v => !v)}
                  autoFocus
                />
                <PasswordField
                  label="Nuova password"
                  value={pwNew}
                  onChange={setPwNew}
                  show={showNew}
                  toggleShow={() => setShowNew(v => !v)}
                />
                <PasswordField
                  label="Conferma nuova password"
                  value={pwConfirm}
                  onChange={setPwConfirm}
                  show={showConfirm}
                  toggleShow={() => setShowConfirm(v => !v)}
                />

                {/* Strength indicator */}
                {pwNew.length > 0 && (
                  <PasswordStrength password={pwNew} />
                )}

                {pwError && (
                  <p className="text-xs px-1" style={{ color: '#FF6B7A' }}>{pwError}</p>
                )}

                <button
                  onClick={handleSavePassword}
                  disabled={!pwValid || pwSaved || pwBusy}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-1"
                  style={{
                    background: pwSaved ? 'rgba(70,211,154,0.15)' : 'rgba(90,154,177,0.20)',
                    border: pwSaved ? '1px solid rgba(70,211,154,0.30)' : '1px solid rgba(90,154,177,0.30)',
                    color: pwSaved ? '#46D39A' : '#7CBBD0',
                    opacity: (!pwValid && !pwSaved) || pwBusy ? 0.5 : 1,
                  }}
                >
                  {pwSaved
                    ? <><Check size={15} strokeWidth={2.5} /> Password aggiornata</>
                    : pwBusy
                      ? <><Loader2 size={15} strokeWidth={2} className="animate-spin" /> Aggiornamento…</>
                      : 'Aggiorna password'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes profileModalIn {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  )
}

/* ── Sub-components ── */

function ModalHeader({
  title, onBack, onClose,
}: {
  title: string
  onBack?: () => void
  onClose: () => void
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ borderBottom: '1px solid var(--ist-w8)' }}
    >
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors mr-1"
            style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
          >
            <ChevronRight size={14} strokeWidth={2.5} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
        <span className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>{title}</span>
      </div>
      <button
        onClick={onClose}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
        style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--ist-text-dim)' }}>
      {children}
    </p>
  )
}

function Tile({
  icon, label, hint, onClick, compact,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  onClick?: () => void
  compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex flex-col items-center justify-start text-center gap-2 rounded-2xl transition-all active:scale-[0.97] hover:-translate-y-0.5 ${compact ? 'py-3 px-1.5' : 'py-4 px-2'}`}
      style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}
    >
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(90,154,177,0.12)', border: '1px solid rgba(90,154,177,0.16)', color: '#7CBBD0' }}
      >
        {icon}
      </div>
      <div className="min-w-0 w-full">
        <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--ist-text)' }}>{label}</p>
        {hint && (
          <p className="text-[10px] leading-tight mt-0.5 truncate" style={{ color: 'var(--ist-text-muted)' }}>{hint}</p>
        )}
      </div>
    </button>
  )
}

function PasswordField({
  label, value, onChange, show, toggleShow, autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  toggleShow: () => void
  autoFocus?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5 px-1" style={{ color: 'var(--ist-text-muted)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          autoFocus={autoFocus}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-3 pr-11 rounded-2xl text-sm outline-none transition-all"
          style={{
            background: 'var(--ist-w8)',
            border: '1px solid var(--ist-w12)',
            color: 'var(--ist-text)',
          }}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity"
          style={{ color: 'var(--ist-text-dim)' }}
        >
          {show ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
        </button>
      </div>
    </div>
  )
}

function NotificationsSection({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  // App nativa (iOS/Android): le notifiche NON usano l'API web `Notification`
  // (assente nel WebView) ma APNs/FCM via @capacitor/push-notifications → mostra
  // lo stato del permesso NATIVO, non il fuorviante "Non supportate" del web.
  if (isNativeApp()) return <NativeNotificationsSection onBack={onBack} onClose={onClose} />

  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  )
  const [localEnabled, setLocalEnabled] = useState(
    () => localStorage.getItem('ist_notif_enabled') !== 'false'
  )

  const handleRequest = async () => {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted' && user?.id) {
      localStorage.setItem('ist_notif_enabled', 'true')
      setLocalEnabled(true)
      await subscribeToPush()
    }
  }

  const toggleLocal = async () => {
    const next = !localEnabled
    setLocalEnabled(next)
    localStorage.setItem('ist_notif_enabled', next ? 'true' : 'false')
    if (!next && user?.id) {
      await unsubscribeFromPush(user.id)
    } else if (next && user?.id) {
      await subscribeToPush()
    }
  }

  const notSupported = !('Notification' in window)

  return (
    <>
      <ModalHeader title="Notifiche" onBack={onBack} onClose={onClose} />
      <div className="px-5 pb-6 pt-3 flex flex-col gap-4">

        {/* Stato corrente */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: permission === 'granted' ? 'rgba(70,211,154,0.08)' : 'var(--ist-w6)',
            border: `1px solid ${permission === 'granted' ? 'rgba(70,211,154,0.20)' : 'var(--ist-w9)'}`,
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: permission === 'granted' ? 'rgba(70,211,154,0.15)' : 'rgba(255,107,122,0.10)',
              color: permission === 'granted' ? '#46D39A' : '#FF6B7A',
            }}
          >
            {permission === 'granted' ? <Bell size={17} strokeWidth={2} /> : <BellOff size={17} strokeWidth={2} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>
              {notSupported ? 'Non supportate' : permission === 'granted' ? 'Notifiche attive' : permission === 'denied' ? 'Notifiche bloccate' : 'Notifiche disabilitate'}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ist-text-muted)' }}>
              {notSupported
                ? 'Il tuo browser non supporta le notifiche push'
                : permission === 'granted'
                ? 'Ricevi aggiornamenti su messaggi e live'
                : permission === 'denied'
                ? 'Riattivale dalle impostazioni del browser'
                : 'Tocca "Abilita" per ricevere notifiche'}
            </p>
          </div>
        </div>

        {/* Toggle locale (se già concesse) */}
        {permission === 'granted' && (
          <button
            onClick={toggleLocal}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all"
            style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(90,154,177,0.12)', border: '1px solid rgba(90,154,177,0.16)', color: '#7CBBD0' }}
              >
                <Bell size={16} strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium" style={{ color: 'var(--ist-text)' }}>Ricezione notifiche</p>
                <p className="text-[11px]" style={{ color: 'var(--ist-text-muted)' }}>
                  {localEnabled ? 'Attiva' : 'Disattivata'}
                </p>
              </div>
            </div>
            {/* Toggle pill */}
            <div
              className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
              style={{ background: localEnabled ? '#5A9AB1' : 'var(--ist-w12)' }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200"
                style={{ transform: localEnabled ? 'translateX(21px)' : 'translateX(2px)' }}
              />
            </div>
          </button>
        )}

        {/* CTA se non ancora richieste */}
        {!notSupported && permission === 'default' && (
          <button
            onClick={handleRequest}
            className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #5A9AB1, #286680)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(40,102,128,0.30)',
            }}
          >
            <Bell size={15} strokeWidth={2} />
            Abilita notifiche
          </button>
        )}

        {/* Info se bloccate */}
        {permission === 'denied' && (
          <p className="text-xs px-1 leading-relaxed" style={{ color: 'var(--ist-text-dim)' }}>
            Hai bloccato le notifiche. Per riattivarle vai su{' '}
            <span style={{ color: '#7CBBD0' }}>Impostazioni → Sito → Notifiche</span>{' '}
            nel tuo browser.
          </p>
        )}
      </div>
    </>
  )
}

// Stato notifiche per l'app NATIVA (APNs/FCM). Il permesso e il device token sono
// gestiti automaticamente all'avvio (NativePushBridge in AppLayout): qui mostriamo
// solo lo stato e, se serve, un CTA per abilitarle o le istruzioni per riattivarle.
function NativeNotificationsSection({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [perm, setPerm] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const res = await PushNotifications.checkPermissions()
      const r = res.receive
      setPerm(r === 'granted' ? 'granted' : r === 'denied' ? 'denied' : 'prompt')
    } catch {
      setPerm('unknown')
    }
  }

  useEffect(() => { refresh() }, [])

  const handleEnable = async () => {
    setBusy(true)
    try {
      const res = await PushNotifications.requestPermissions()
      if (res.receive === 'granted') await PushNotifications.register()
    } catch { /* ignora */ }
    await refresh()
    setBusy(false)
  }

  const granted = perm === 'granted'

  return (
    <>
      <ModalHeader title="Notifiche" onBack={onBack} onClose={onClose} />
      <div className="px-5 pb-6 pt-3 flex flex-col gap-4">

        {/* Stato corrente */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: granted ? 'rgba(70,211,154,0.08)' : 'var(--ist-w6)',
            border: `1px solid ${granted ? 'rgba(70,211,154,0.20)' : 'var(--ist-w9)'}`,
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: granted ? 'rgba(70,211,154,0.15)' : 'rgba(255,107,122,0.10)',
              color: granted ? '#46D39A' : '#FF6B7A',
            }}
          >
            {granted ? <Bell size={17} strokeWidth={2} /> : <BellOff size={17} strokeWidth={2} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>
              {granted ? 'Notifiche attive' : perm === 'denied' ? 'Notifiche bloccate' : 'Notifiche disabilitate'}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ist-text-muted)' }}>
              {granted
                ? 'Ricevi aggiornamenti su messaggi e live'
                : perm === 'denied'
                ? 'Riattivale dalle impostazioni del telefono'
                : 'Tocca "Abilita" per ricevere notifiche'}
            </p>
          </div>
        </div>

        {/* CTA se non ancora concesse */}
        {!granted && perm !== 'denied' && (
          <button
            onClick={handleEnable}
            disabled={busy}
            className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #5A9AB1, #286680)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(40,102,128,0.30)',
            }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} strokeWidth={2} />}
            Abilita notifiche
          </button>
        )}

        {/* Istruzioni se bloccate a livello di sistema */}
        {perm === 'denied' && (
          <p className="text-xs px-1 leading-relaxed" style={{ color: 'var(--ist-text-dim)' }}>
            Hai bloccato le notifiche. Per riattivarle vai su{' '}
            <span style={{ color: '#7CBBD0' }}>Impostazioni → Space Traders Institute → Notifiche</span>{' '}
            sul tuo telefono.
          </p>
        )}
      </div>
    </>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['#FF6B7A', '#F6C85F', '#F6C85F', '#46D39A', '#46D39A']
  const labels = ['Troppo corta', 'Debole', 'Discreta', 'Buona', 'Ottima']

  return (
    <div className="flex flex-col gap-1.5 px-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score] : 'var(--ist-w10)' }}
          />
        ))}
      </div>
      <p className="text-[10px] font-medium" style={{ color: colors[score] }}>
        {labels[score]}
      </p>
    </div>
  )
}
