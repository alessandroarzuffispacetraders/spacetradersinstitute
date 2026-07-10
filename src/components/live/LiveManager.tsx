import { useState } from 'react'
import { useBackInterceptor } from '../../lib/androidBack'
import { Radio, Edit2, Trash2, X, Plus, Loader2, Play, Square, Save } from 'lucide-react'
import {
  useLiveAdmin, LiveEvent, LiveInput, LiveStatus, LiveRole,
  liveDateLabel, liveDurationLabel,
} from '../../lib/live'

const LIVE_STATUS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  live:     { bg: 'rgba(255,80,80,0.10)',  text: '#FF5050', border: 'rgba(255,80,80,0.22)',  label: 'In diretta'  },
  upcoming: { bg: 'rgba(90,154,177,0.12)', text: '#7CBBD0', border: 'rgba(90,154,177,0.22)', label: 'Programmata' },
  replay:   { bg: 'var(--ist-w6)',         text: 'var(--ist-text-dim)', border: 'var(--ist-border)', label: 'Replay' },
}
const LIVE_ROLES: { id: LiveRole; label: string }[] = [
  { id: 'coach', label: 'Coach' },
  { id: 'mental_coach', label: 'Mental Coach' },
  { id: 'admin', label: 'Admin' },
]
const ACCENTS = ['#7CBBD0', '#46D39A', '#F6C85F', '#A078FF', '#FF6B7A', '#5A9AB1']

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)',
  borderRadius: 14, color: 'var(--ist-text)', outline: 'none', width: '100%',
}

function isoToLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localToIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null
}

function ActionBtn({ icon, label, danger, accent, onClick }: {
  icon: React.ReactNode; label: string; danger?: boolean; accent?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/[0.05]"
      style={{ color: danger ? '#FF6B7A' : accent ? 'var(--ist-accent-text)' : 'var(--ist-text-dim)' }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ─── Modal create/edit ──────────────────────────────────────────────────────────

function LiveModal({ initial, defaultHost, onSave, onClose }: {
  initial?: LiveEvent
  defaultHost?: string
  onSave: (input: LiveInput) => Promise<boolean>
  onClose: () => void
}) {
  const [form, setForm] = useState<LiveInput>(initial ? {
    title: initial.title, description: initial.description, host: initial.host,
    hostRole: initial.hostRole, status: initial.status, startsAt: initial.startsAt,
    zoomUrl: initial.zoomUrl ?? '', liveEmbedUrl: initial.liveEmbedUrl ?? '', replayVimeoId: initial.replayVimeoId ?? '',
    durationMinutes: initial.durationMinutes, accent: initial.accent, accentEnd: initial.accentEnd,
  } : {
    title: '', description: '', host: defaultHost ?? '', hostRole: 'coach',
    status: 'upcoming', startsAt: null, zoomUrl: '', liveEmbedUrl: '', replayVimeoId: '',
    durationMinutes: null, accent: '#7CBBD0', accentEnd: '#286680',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (patch: Partial<LiveInput>) => setForm(f => ({ ...f, ...patch }))
  const isReplay = form.status === 'replay'

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Il titolo è obbligatorio.'); return }
    setSaving(true)
    const ok = await onSave(form)
    setSaving(false)
    if (!ok) { setError('Errore durante il salvataggio.'); return }
    onClose()
  }

  const label = (t: string) => (
    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>{t}</label>
  )

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div
        className="fixed z-50 top-4 bottom-4 right-4 w-full max-w-[440px] overflow-hidden rounded-4xl flex flex-col"
        style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: '0 24px 80px rgba(0,0,0,0.50)', backdropFilter: 'blur(24px)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--ist-text)' }}>{initial ? 'Modifica live' : 'Nuova live'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto no-scrollbar">
          <div>
            {label('Stato')}
            <div className="grid grid-cols-3 gap-2">
              {(['upcoming', 'live', 'replay'] as LiveStatus[]).map(st => (
                <button
                  key={st}
                  onClick={() => set({ status: st })}
                  className="py-2 rounded-xl text-xs font-semibold transition-all"
                  style={form.status === st
                    ? { background: LIVE_STATUS[st].bg, color: LIVE_STATUS[st].text, border: `1px solid ${LIVE_STATUS[st].border}` }
                    : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-w9)' }}
                >
                  {LIVE_STATUS[st].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            {label('Titolo *')}
            <input value={form.title} onChange={e => set({ title: e.target.value })} placeholder="Es. Analisi mercati settimanale" className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
          </div>

          <div>
            {label('Descrizione')}
            <textarea value={form.description} onChange={e => set({ description: e.target.value })} rows={3} placeholder="Di cosa si parla nella sessione..." className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F] resize-none" style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              {label('Host')}
              <input value={form.host} onChange={e => set({ host: e.target.value })} placeholder="Es. Laura Bianchi" className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
            </div>
            <div>
              {label('Ruolo host')}
              <select value={form.hostRole} onChange={e => set({ hostRole: e.target.value as LiveRole })} className="px-3.5 py-2.5 text-sm" style={inputStyle}>
                {LIVE_ROLES.map(r => <option key={r.id} value={r.id} style={{ background: '#0d1117' }}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            {label(isReplay ? 'Data registrazione' : 'Data e ora')}
            <input type="datetime-local" value={isoToLocal(form.startsAt)} onChange={e => set({ startsAt: localToIso(e.target.value) })} className="px-3.5 py-2.5 text-sm" style={inputStyle} />
          </div>

          {isReplay ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                {label('Link/ID Vimeo replay')}
                <input value={form.replayVimeoId ?? ''} onChange={e => set({ replayVimeoId: e.target.value })} placeholder="vimeo.com/..." className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
              </div>
              <div>
                {label('Durata (min)')}
                <input type="number" min="0" value={form.durationMinutes ?? ''} onChange={e => set({ durationMinutes: e.target.value ? parseInt(e.target.value) : null })} placeholder="60" className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
              </div>
            </div>
          ) : (
            <>
              <div>
                {label('Link Zoom')}
                <input value={form.zoomUrl ?? ''} onChange={e => set({ zoomUrl: e.target.value })} placeholder="https://zoom.us/j/..." className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
              </div>
              <div>
                {label('Link live in-app (YouTube/Vimeo) — opzionale')}
                <input value={form.liveEmbedUrl ?? ''} onChange={e => set({ liveEmbedUrl: e.target.value })} placeholder="https://youtube.com/live/... o vimeo.com/event/..." className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
                <p className="text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--ist-text-dim)' }}>
                  Se compilato, durante la diretta lo studente guarda la live <strong>dentro l'app</strong> accanto alla chat. Altrimenti resta il pulsante Zoom.
                </p>
              </div>
            </>
          )}

          <div>
            {label('Colore')}
            <div className="flex gap-2 flex-wrap">
              {ACCENTS.map(c => (
                <button key={c} onClick={() => set({ accent: c })} className="w-8 h-8 rounded-full transition-transform hover:scale-110" style={{ background: c, border: form.accent === c ? '2px solid var(--ist-text)' : '2px solid transparent' }} />
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--ist-w8)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-2xl" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>Annulla</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold rounded-2xl text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', boxShadow: '0 4px 14px rgba(40,102,128,0.30)' }}
          >
            {saving && <Loader2 size={15} strokeWidth={2.5} className="animate-spin" />}
            {initial ? 'Salva modifiche' : 'Crea live'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Manager (lista + azioni ciclo di vita) ──────────────────────────────────────

export default function LiveManager({ api, defaultHost }: {
  api: ReturnType<typeof useLiveAdmin>
  defaultHost?: string
}) {
  const [modal, setModal] = useState<{ open: boolean; editing?: LiveEvent }>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [replayDraft, setReplayDraft] = useState<Record<string, string>>({})

  // Tasto indietro Android: chiudi il modale live invece di navigare.
  useBackInterceptor(() => setModal({ open: false }), modal.open)

  if (api.loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} /></div>
  }

  return (
    <div className="space-y-2.5">
      <button
        onClick={() => setModal({ open: true })}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl transition-all hover:bg-black/[0.02] mb-1"
        style={{ border: '1px dashed var(--ist-border-strong)', color: 'var(--ist-accent-text)' }}
      >
        <Plus size={14} strokeWidth={2.5} />
        <span className="text-sm font-medium">Nuova live</span>
      </button>

      {api.events.length === 0 && (
        <p className="text-[11px] text-center py-6" style={{ color: 'var(--ist-text-dim)' }}>Nessuna live. Creane una con il pulsante qui sopra.</p>
      )}

      {api.events.map(event => {
        const s = LIVE_STATUS[event.status]
        return (
          <div key={event.id} className="p-4 lg:p-5 rounded-3xl" style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: 'var(--ist-card-shadow)' }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${event.accent}12`, border: `1px solid ${event.accent}22` }}>
                <Radio size={16} strokeWidth={2} style={{ color: event.accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--ist-text)' }}>{event.title}</p>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>{s.label}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
                  {event.host || '—'} · {liveDateLabel(event)}
                  {liveDurationLabel(event) && <> · {liveDurationLabel(event)}</>}
                </p>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {deleteConfirm === event.id ? (
                  <>
                    <span className="text-[10px] mr-1" style={{ color: 'var(--ist-text-muted)' }}>Eliminare?</span>
                    <ActionBtn icon={<Trash2 size={11} strokeWidth={2} />} label="Sì" danger onClick={async () => { await api.deleteLive(event.id); setDeleteConfirm(null) }} />
                    <ActionBtn icon={<X size={11} strokeWidth={2} />} label="No" onClick={() => setDeleteConfirm(null)} />
                  </>
                ) : (
                  <>
                    {event.status === 'upcoming' && (
                      <ActionBtn icon={<Play size={11} strokeWidth={2} />} label="Vai in onda" accent onClick={() => api.setLiveStatus(event.id, 'live')} />
                    )}
                    {event.status === 'live' && (
                      <ActionBtn icon={<Square size={11} strokeWidth={2} />} label="Termina" danger onClick={() => api.setLiveStatus(event.id, 'replay')} />
                    )}
                    <ActionBtn icon={<Edit2 size={11} strokeWidth={2} />} label="Modifica" onClick={() => setModal({ open: true, editing: event })} />
                    <ActionBtn icon={<Trash2 size={11} strokeWidth={2} />} label="Elimina" danger onClick={() => setDeleteConfirm(event.id)} />
                  </>
                )}
              </div>
            </div>

            {/* Replay: salva il link della registrazione */}
            {event.status === 'replay' && (
              <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--ist-w7)' }}>
                {event.replayVimeoId ? (
                  <p className="text-xs flex-1 truncate flex items-center gap-1.5" style={{ color: '#46D39A' }}>
                    ✓ Replay salvato: <span style={{ color: 'var(--ist-text-muted)' }}>{event.replayVimeoId}</span>
                  </p>
                ) : (
                  <>
                    <input
                      value={replayDraft[event.id] ?? ''}
                      onChange={e => setReplayDraft(d => ({ ...d, [event.id]: e.target.value }))}
                      placeholder="Incolla il link/ID Vimeo della registrazione…"
                      className="flex-1 px-3 py-2 text-xs placeholder:text-[#56636F]"
                      style={inputStyle}
                    />
                    <button
                      onClick={() => api.setReplay(event.id, replayDraft[event.id] ?? '')}
                      disabled={!(replayDraft[event.id] ?? '').trim()}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white disabled:opacity-50 flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
                    >
                      <Save size={12} strokeWidth={2} /> Salva replay
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {modal.open && (
        <LiveModal
          initial={modal.editing}
          defaultHost={defaultHost}
          onSave={input => modal.editing ? api.updateLive(modal.editing.id, input) : api.createLive(input)}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
