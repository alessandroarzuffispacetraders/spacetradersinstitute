import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, ChevronUp, ChevronDown, Check, X, Pencil } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { usePathAdmin, PHASE_ORDER, PHASE_META } from '../../lib/path'
import {
  useMentalMaterialsAdmin, useMentalChecklistAdmin,
  MentalMaterialType, MaterialInput,
} from '../../lib/mental'
import { useWelcomeVideoAdmin, WELCOME_WINDOW_DAYS } from '../../lib/onboarding'

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)',
  borderRadius: 12, color: 'var(--ist-text)', outline: 'none', width: '100%',
}

type Tab = 'percorso' | 'materiali' | 'checklist' | 'benvenuto'
const TABS: { id: Tab; label: string }[] = [
  { id: 'percorso', label: 'Percorso' },
  { id: 'materiali', label: 'Materiali Mental' },
  { id: 'checklist', label: 'Checklist Mental' },
  { id: 'benvenuto', label: 'Video benvenuto' },
]

function IconBtn({ icon, onClick, danger, disabled, title }: {
  icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30 hover:bg-white/[0.06]"
      style={{ color: danger ? '#FF6B7A' : 'var(--ist-text-dim)' }}
    >
      {icon}
    </button>
  )
}

// ─── Riga label editabile (usata da Percorso e Checklist) ───────────────────────

function LabelRow({ label, first, last, onSave, onDelete, onMove }: {
  label: string; first: boolean; last: boolean
  onSave: (label: string) => void; onDelete: () => void; onMove: (dir: 'up' | 'down') => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)

  return (
    <div className="flex items-center gap-2 py-1.5">
      {editing ? (
        <>
          <input
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onSave(draft); setEditing(false) } if (e.key === 'Escape') { setDraft(label); setEditing(false) } }}
            className="flex-1 px-3 py-1.5 text-sm"
            style={inputStyle}
          />
          <IconBtn icon={<Check size={14} strokeWidth={2.5} />} onClick={() => { if (draft.trim()) { onSave(draft); setEditing(false) } }} />
          <IconBtn icon={<X size={14} strokeWidth={2.5} />} onClick={() => { setDraft(label); setEditing(false) }} />
        </>
      ) : (
        <>
          <span className="flex-1 text-sm" style={{ color: 'var(--ist-text)' }}>{label}</span>
          <IconBtn icon={<ChevronUp size={15} strokeWidth={2} />} onClick={() => onMove('up')} disabled={first} title="Su" />
          <IconBtn icon={<ChevronDown size={15} strokeWidth={2} />} onClick={() => onMove('down')} disabled={last} title="Giù" />
          <IconBtn icon={<Pencil size={13} strokeWidth={2} />} onClick={() => { setDraft(label); setEditing(true) }} title="Modifica" />
          <IconBtn icon={<Trash2 size={13} strokeWidth={2} />} onClick={onDelete} danger title="Elimina" />
        </>
      )}
    </div>
  )
}

// ─── Aggiungi label (input + bottone) ───────────────────────────────────────────

function AddLabel({ placeholder, onAdd }: { placeholder: string; onAdd: (label: string) => void }) {
  const [value, setValue] = useState('')
  const submit = () => { if (value.trim()) { onAdd(value); setValue('') } }
  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 text-sm placeholder:text-[#56636F]"
        style={inputStyle}
      />
      <button
        onClick={submit}
        disabled={!value.trim()}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white disabled:opacity-45 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
      >
        <Plus size={13} strokeWidth={2.5} /> Aggiungi
      </button>
    </div>
  )
}

// ─── Tab: Percorso ──────────────────────────────────────────────────────────────

function PercorsoTab() {
  const { steps, loading, addStep, updateStep, deleteStep, moveStep } = usePathAdmin()
  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} /></div>

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>
        Le 4 fasi sono fisse; personalizza gli step che lo studente spunta in ciascuna.
      </p>
      {PHASE_ORDER.map(phase => {
        const phaseSteps = steps.filter(s => s.phase === phase).sort((a, b) => a.position - b.position)
        return (
          <Card key={phase} className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{PHASE_META[phase].icon}</span>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>{PHASE_META[phase].label}</h3>
            </div>
            {phaseSteps.length === 0 && (
              <p className="text-xs py-1" style={{ color: 'var(--ist-text-dim)' }}>Nessuno step in questa fase.</p>
            )}
            {phaseSteps.map((s, i) => (
              <LabelRow
                key={s.id}
                label={s.label}
                first={i === 0}
                last={i === phaseSteps.length - 1}
                onSave={label => updateStep(s.id, label)}
                onDelete={() => deleteStep(s.id)}
                onMove={dir => moveStep(s.id, dir)}
              />
            ))}
            <AddLabel placeholder="Nuovo step…" onAdd={label => addStep(phase, label)} />
          </Card>
        )
      })}
    </div>
  )
}

// ─── Tab: Materiali ─────────────────────────────────────────────────────────────

const MAT_TYPES: MentalMaterialType[] = ['link', 'pdf', 'audio', 'video', 'task']
const MAT_TYPE_LABEL: Record<MentalMaterialType, string> = {
  link: 'Link', pdf: 'PDF', audio: 'Audio', video: 'Video', task: 'Task',
}

function MaterialForm({ initial, onSubmit, onCancel }: {
  initial?: MaterialInput; onSubmit: (input: MaterialInput) => Promise<boolean>; onCancel?: () => void
}) {
  const [form, setForm] = useState<MaterialInput>(initial ?? { title: '', type: 'link', url: '' })
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<MaterialInput>) => setForm(f => ({ ...f, ...patch }))

  const submit = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const ok = await onSubmit(form)
    setSaving(false)
    if (ok && !initial) setForm({ title: '', type: 'link', url: '' })
    if (ok && onCancel) onCancel()
  }

  return (
    <div className="space-y-2.5">
      <input value={form.title} onChange={e => set({ title: e.target.value })} placeholder="Titolo del materiale" className="px-3 py-2 text-sm placeholder:text-[#56636F]" style={inputStyle} />
      <div className="flex gap-2">
        <select value={form.type} onChange={e => set({ type: e.target.value as MentalMaterialType })} className="px-3 py-2 text-sm" style={{ ...inputStyle, width: 130, flexShrink: 0 }}>
          {MAT_TYPES.map(t => <option key={t} value={t} style={{ background: '#0d1117' }}>{MAT_TYPE_LABEL[t]}</option>)}
        </select>
        <input value={form.url} onChange={e => set({ url: e.target.value })} placeholder="https://… (link al materiale)" className="px-3 py-2 text-sm placeholder:text-[#56636F]" style={inputStyle} />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !form.title.trim()} className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl text-white disabled:opacity-45" style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}>
          {saving && <Loader2 size={13} className="animate-spin" />}
          {initial ? 'Salva' : <><Plus size={13} strokeWidth={2.5} /> Aggiungi</>}
        </button>
        {onCancel && <button onClick={onCancel} className="text-xs font-semibold px-4 py-2 rounded-xl" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>Annulla</button>}
      </div>
    </div>
  )
}

function MaterialiTab() {
  const { materials, loading, addMaterial, updateMaterial, deleteMaterial, moveMaterial } = useMentalMaterialsAdmin()
  const [editId, setEditId] = useState<string | null>(null)
  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} /></div>

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ist-text)' }}>Nuovo materiale</h3>
        <MaterialForm onSubmit={addMaterial} />
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ist-text)' }}>Materiali ({materials.length})</h3>
        {materials.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>Nessun materiale. Aggiungine uno qui sopra.</p>
        ) : (
          <div className="space-y-1">
            {materials.map((m, i) => (
              editId === m.id ? (
                <div key={m.id} className="py-2">
                  <MaterialForm
                    initial={{ title: m.title, type: m.type, url: m.url ?? '' }}
                    onSubmit={input => updateMaterial(m.id, input)}
                    onCancel={() => setEditId(null)}
                  />
                </div>
              ) : (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--ist-w6)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-w8)' }}>
                    {MAT_TYPE_LABEL[m.type]}
                  </span>
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--ist-text)' }}>{m.title}</span>
                  <IconBtn icon={<ChevronUp size={15} strokeWidth={2} />} onClick={() => moveMaterial(m.id, 'up')} disabled={i === 0} title="Su" />
                  <IconBtn icon={<ChevronDown size={15} strokeWidth={2} />} onClick={() => moveMaterial(m.id, 'down')} disabled={i === materials.length - 1} title="Giù" />
                  <IconBtn icon={<Pencil size={13} strokeWidth={2} />} onClick={() => setEditId(m.id)} title="Modifica" />
                  <IconBtn icon={<Trash2 size={13} strokeWidth={2} />} onClick={() => deleteMaterial(m.id)} danger title="Elimina" />
                </div>
              )
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Tab: Checklist ─────────────────────────────────────────────────────────────

function ChecklistTab() {
  const { items, loading, addItem, updateItem, deleteItem, moveItem } = useMentalChecklistAdmin()
  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} /></div>

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ist-text)' }}>Checklist Mental Coach</h3>
      <p className="text-xs mb-3" style={{ color: 'var(--ist-text-dim)' }}>Attività che lo studente spunterà nella propria Area Mental Coach.</p>
      {items.length === 0 && <p className="text-xs py-1" style={{ color: 'var(--ist-text-dim)' }}>Nessuna attività. Aggiungine una qui sotto.</p>}
      {items.map((it, i) => (
        <LabelRow
          key={it.id}
          label={it.label}
          first={i === 0}
          last={i === items.length - 1}
          onSave={label => updateItem(it.id, label)}
          onDelete={() => deleteItem(it.id)}
          onMove={dir => moveItem(it.id, dir)}
        />
      ))}
      <AddLabel placeholder="Nuova attività…" onAdd={addItem} />
    </Card>
  )
}

// ─── Tab: Video di benvenuto ────────────────────────────────────────────────────

function WelcomeVideoField({ free, title, help }: { free: boolean; title: string; help: string }) {
  const { url, loading, save } = useWelcomeVideoAdmin(free)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setVal(url) }, [url])

  if (loading) return <Card className="p-5"><div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} /></div></Card>

  const doSave = async () => {
    setSaving(true)
    const ok = await save(val)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ist-text)' }}>{title}</h3>
      <p className="text-xs mb-4" style={{ color: 'var(--ist-text-dim)' }}>{help}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="https://vimeo.com/..."
          className="px-3 py-2.5 text-sm flex-1 min-w-[220px] placeholder:text-[#56636F]"
          style={inputStyle}
        />
        <button
          onClick={doSave}
          disabled={saving || val.trim() === url.trim()}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl text-white disabled:opacity-45 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} strokeWidth={2.5} /> : null}
          {saved ? 'Salvato' : 'Salva'}
        </button>
      </div>
    </Card>
  )
}

function BenvenutoTab() {
  return (
    <div className="space-y-4">
      <WelcomeVideoField
        free={false}
        title="Video di benvenuto — utenti completi"
        help={`Link Vimeo mostrato in home agli studenti con accesso completo, per i primi ${WELCOME_WINDOW_DAYS} giorni dalla registrazione. Lascia vuoto per non mostrarlo.`}
      />
      <WelcomeVideoField
        free={true}
        title="Video di benvenuto — utenti gratuiti"
        help={`Link Vimeo mostrato in home SOLO agli utenti gratuiti, per i primi ${WELCOME_WINDOW_DAYS} giorni dalla registrazione. Lascia vuoto per non mostrarlo.`}
      />
    </div>
  )
}

// ─── Pagina ─────────────────────────────────────────────────────────────────────

export default function AdminProgramma() {
  const [tab, setTab] = useState<Tab>('percorso')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Programma" subtitle="Personalizza il percorso e l'area Mental Coach" />

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 text-sm font-semibold rounded-full transition-all"
            style={tab === t.id
              ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)', border: '1px solid var(--ist-border-strong)' }
              : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-w8)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'percorso' && <PercorsoTab />}
      {tab === 'materiali' && <MaterialiTab />}
      {tab === 'checklist' && <ChecklistTab />}
      {tab === 'benvenuto' && <BenvenutoTab />}
    </div>
  )
}
