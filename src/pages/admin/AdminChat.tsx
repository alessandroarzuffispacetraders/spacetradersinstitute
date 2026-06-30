import { useState } from 'react'
import { Hash, Megaphone, Edit2, Trash2, X, Plus, Loader2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'
import { Channel, ChannelType, MemberRole } from '../../data/chatData'
import { useChannelsAdmin, ChannelInput } from '../../lib/channels'

// ─── helpers ──────────────────────────────────────────────────────────────────

const ALL_ROLES: MemberRole[] = ['student', 'coach', 'mental_coach', 'admin']
const ALL_CATEGORIES = ['Annunci', 'Community', 'Coaching', 'Mental Coach']

const ROLE_LABEL: Record<MemberRole, string> = {
  admin: 'Admin',
  coach: 'Coach',
  mental_coach: 'Mental Coach',
  student: 'Studente',
}

const ROLE_COLOR: Record<MemberRole, { bg: string; text: string }> = {
  admin: { bg: 'rgba(124,187,208,0.15)', text: '#7CBBD0' },
  coach: { bg: 'rgba(40,102,128,0.22)', text: '#7CBBD0' },
  mental_coach: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
  student: { bg: 'rgba(255,255,255,0.08)', text: 'var(--ist-text-muted)' },
}

const CATEGORY_ICON: Record<string, string> = {
  Annunci: '📢',
  Community: '💬',
  Coaching: '🎯',
  'Mental Coach': '🧠',
}

// ─── empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  description: '',
  type: 'chat' as ChannelType,
  category: 'Community',
  roles: ['student', 'coach', 'mental_coach', 'admin'] as MemberRole[],
  canPost: ['student', 'coach', 'mental_coach', 'admin'] as MemberRole[],
}

type ChannelForm = typeof EMPTY_FORM

// ─── modal ────────────────────────────────────────────────────────────────────

function ChannelModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<ChannelForm>
  onSave: (form: ChannelForm) => Promise<string | null>
  onClose: () => void
}) {
  const [form, setForm] = useState<ChannelForm>({ ...EMPTY_FORM, ...initial })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleRole = (field: 'roles' | 'canPost', role: MemberRole) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(role)
        ? prev[field].filter(r => r !== role)
        : [...prev[field], role],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Il nome del canale è obbligatorio.')
      return
    }
    if (form.roles.length === 0) {
      setError('Seleziona almeno un ruolo che può vedere il canale.')
      return
    }
    setSaving(true)
    const err = await onSave(form)
    setSaving(false)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-50 top-4 bottom-4 right-4 w-full max-w-[420px] overflow-y-auto rounded-4xl flex flex-col"
        style={{
          background: 'var(--ist-card-bg)',
          border: '1px solid var(--ist-border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.50)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--ist-w8)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--ist-text)' }}>
              {initial?.name ? 'Modifica canale' : 'Nuovo canale'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ist-text-muted)' }}>
              Configura le proprietà del canale
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto no-scrollbar">

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>
              Nome canale *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
              placeholder="es. trading-avanzato"
              className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none"
              style={{
                background: 'var(--ist-w6)',
                border: '1px solid var(--ist-w10)',
                color: 'var(--ist-text)',
              }}
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--ist-text-dim)' }}>
              Solo lettere minuscole, numeri e trattini
            </p>
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>
              Descrizione (opzionale)
            </label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Breve descrizione del canale"
              className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none"
              style={{
                background: 'var(--ist-w6)',
                border: '1px solid var(--ist-w10)',
                color: 'var(--ist-text)',
              }}
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--ist-text-muted)' }}>
              Tipo canale
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['chat', 'bacheca'] as ChannelType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(p => ({ ...p, type: t }))}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all text-sm font-semibold"
                  style={form.type === t
                    ? { background: 'rgba(124,187,208,0.18)', border: '1px solid rgba(124,187,208,0.40)', color: '#7CBBD0' }
                    : { background: 'var(--ist-w6)', border: '1px solid var(--ist-w9)', color: 'var(--ist-text-muted)' }
                  }
                >
                  {t === 'chat' ? <Hash size={18} strokeWidth={2} /> : <Megaphone size={18} strokeWidth={2} />}
                  {t === 'chat' ? 'Chat' : 'Bacheca'}
                  <span className="text-[10px] font-normal text-center leading-tight" style={{ opacity: 0.7 }}>
                    {t === 'chat' ? 'Messaggi in tempo reale' : 'Post tipo annunci'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>
              Categoria
            </label>
            <select
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none"
              style={{
                background: 'var(--ist-w6)',
                border: '1px solid var(--ist-w10)',
                color: 'var(--ist-text)',
                appearance: 'none',
              }}
            >
              {ALL_CATEGORIES.map(cat => (
                <option key={cat} value={cat} style={{ background: '#0d1117' }}>
                  {CATEGORY_ICON[cat]} {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Chi può vedere */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--ist-text-muted)' }}>
              Chi può vedere
            </label>
            <div className="space-y-1.5">
              {ALL_ROLES.map(role => (
                <label
                  key={role}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                  style={{ background: form.roles.includes(role) ? 'rgba(124,187,208,0.08)' : 'var(--ist-w5)' }}
                >
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole('roles', role)}
                    className="accent-ist-400 w-4 h-4 rounded"
                  />
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: ROLE_COLOR[role].bg, color: ROLE_COLOR[role].text }}
                  >
                    {ROLE_LABEL[role]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Chi può scrivere */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--ist-text-muted)' }}>
              Chi può scrivere / postare
            </label>
            <div className="space-y-1.5">
              {ALL_ROLES.map(role => (
                <label
                  key={role}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                  style={{ background: form.canPost.includes(role) ? 'rgba(124,187,208,0.08)' : 'var(--ist-w5)' }}
                >
                  <input
                    type="checkbox"
                    checked={form.canPost.includes(role)}
                    onChange={() => toggleRole('canPost', role)}
                    className="accent-ist-400 w-4 h-4 rounded"
                  />
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: ROLE_COLOR[role].bg, color: ROLE_COLOR[role].text }}
                  >
                    {ROLE_LABEL[role]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--ist-w8)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold rounded-2xl transition-all"
            style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold rounded-2xl transition-all hover:-translate-y-0.5 text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', boxShadow: '0 4px 14px rgba(40,102,128,0.30)' }}
          >
            {saving && <Loader2 size={15} strokeWidth={2.5} className="animate-spin" />}
            {initial?.name ? 'Salva modifiche' : 'Crea canale'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-5 py-4 rounded-3xl"
      style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: 'var(--ist-card-shadow)' }}
    >
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs font-medium" style={{ color: 'var(--ist-text-muted)' }}>{label}</span>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function AdminChat() {
  const { channels, loading, createChannel, updateChannel, deleteChannel } = useChannelsAdmin()
  const [modal, setModal] = useState<{ open: boolean; editing?: Channel }>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const totalChat = channels.filter(c => c.type === 'chat').length
  const totalBacheca = channels.filter(c => c.type === 'bacheca').length

  // Group by category
  const byCategory: Record<string, Channel[]> = {}
  for (const ch of channels) {
    if (!byCategory[ch.category]) byCategory[ch.category] = []
    byCategory[ch.category].push(ch)
  }

  const openNew = () => setModal({ open: true, editing: undefined })
  const openEdit = (ch: Channel) => setModal({ open: true, editing: ch })
  const closeModal = () => setModal({ open: false })

  // Ritorna un messaggio d'errore (o null in caso di successo); il modal resta
  // aperto sull'errore e si chiude da solo al successo.
  const handleSave = async (form: ChannelForm): Promise<string | null> => {
    const input: ChannelInput = {
      ...form,
      categoryIcon: CATEGORY_ICON[form.category] ?? '💬',
    }
    const res = modal.editing
      ? await updateChannel(modal.editing.id, input)
      : await createChannel(input)
    return res.ok ? null : (res.error ?? 'Errore durante il salvataggio.')
  }

  const handleDelete = async (id: string) => {
    await deleteChannel(id)
    setDeleteConfirm(null)
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Gestione Chat"
        subtitle="Crea, modifica e gestisci i canali della community IST"
        action={
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #5A9AB1, #286680)',
              boxShadow: '0 4px 16px rgba(40,102,128,0.30)',
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Nuovo Canale
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatBadge label="Canali totali" value={channels.length} color="#7CBBD0" />
        <StatBadge label="Chat" value={totalChat} color="#7CBBD0" />
        <StatBadge label="Bacheche" value={totalBacheca} color="#a78bfa" />
      </div>

      {/* Channels by category */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: 'var(--ist-text-muted)' }} />
        </div>
      ) : (
      <div className="space-y-6">
        {Object.entries(byCategory).map(([cat, chs]) => (
          <Card key={cat} className="p-0 overflow-hidden">
            {/* Category header */}
            <div
              className="flex items-center gap-2 px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--ist-w8)' }}
            >
              <span className="text-base">{CATEGORY_ICON[cat] ?? '📁'}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>{cat}</span>
              <span
                className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
              >
                {chs.length} {chs.length === 1 ? 'canale' : 'canali'}
              </span>
            </div>

            {/* Channel rows */}
            <div className="divide-y" style={{ borderColor: 'var(--ist-w7)' }}>
              {chs.map(ch => (
                <div
                  key={ch.id}
                  className="flex items-start gap-3 px-5 py-4 transition-colors"
                  style={{ '--hover-bg': 'var(--ist-w5)' } as React.CSSProperties}
                >
                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: ch.type === 'bacheca' ? 'rgba(167,139,250,0.12)' : 'rgba(124,187,208,0.12)',
                      color: ch.type === 'bacheca' ? '#a78bfa' : '#7CBBD0',
                    }}
                  >
                    {ch.type === 'bacheca' ? <Megaphone size={15} strokeWidth={2} /> : <Hash size={15} strokeWidth={2} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>
                        #{ch.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={ch.type === 'bacheca'
                          ? { background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }
                          : { background: 'rgba(124,187,208,0.12)', color: '#7CBBD0' }
                        }
                      >
                        {ch.type === 'bacheca' ? 'Bacheca' : 'Chat'}
                      </span>
                    </div>

                    {ch.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--ist-text-muted)' }}>
                        {ch.description}
                      </p>
                    )}

                    {/* Roles */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>Vede:</span>
                      {ch.roles.map(r => (
                        <span
                          key={r}
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: ROLE_COLOR[r].bg, color: ROLE_COLOR[r].text }}
                        >
                          {ROLE_LABEL[r]}
                        </span>
                      ))}
                      <span className="text-[10px] ml-2" style={{ color: 'var(--ist-text-dim)' }}>Scrive:</span>
                      {ch.canPost.map(r => (
                        <span
                          key={`post-${r}`}
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: ROLE_COLOR[r].bg, color: ROLE_COLOR[r].text }}
                        >
                          {ROLE_LABEL[r]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {deleteConfirm === ch.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]" style={{ color: 'var(--ist-text-muted)' }}>Eliminare?</span>
                        <button
                          onClick={() => handleDelete(ch.id)}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-semibold"
                          style={{ background: 'rgba(255,107,122,0.15)', color: '#FF6B7A' }}
                        >
                          Sì
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-semibold"
                          style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(ch)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                          style={{ background: 'var(--ist-w7)', color: 'var(--ist-text-muted)' }}
                          title="Modifica"
                        >
                          <Edit2 size={13} strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(ch.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                          style={{ background: 'rgba(255,107,122,0.08)', color: '#FF6B7A' }}
                          title="Elimina"
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      )}

      {/* Modal */}
      {modal.open && (
        <ChannelModal
          initial={modal.editing
            ? {
              name: modal.editing.name,
              description: modal.editing.description ?? '',
              type: modal.editing.type,
              category: modal.editing.category,
              roles: [...modal.editing.roles],
              canPost: [...modal.editing.canPost],
            }
            : undefined
          }
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
