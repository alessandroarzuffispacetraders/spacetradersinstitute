import { CheckCircle2, Lock, CheckSquare, Square, ExternalLink, MessageCircle, Radio, ChevronRight, Clock, Trash2, ImagePlus } from 'lucide-react'
import { CSSProperties } from 'react'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'

// ⚠️ ESCHE (decoy) — dati COMPLETAMENTE INVENTATI, mostrati offuscati dietro
// PreviewLock all'utente gratuito. Non arrivano MAI dal database: nessun fetch,
// nessun contenuto reale qui dentro. Servono solo a far intuire cosa c'è nel
// percorso completo. Modificarli liberamente: non influenzano dati reali.

/* ── Percorso ──────────────────────────────────────────────── */

const PHASE_BADGE: Record<string, CSSProperties> = {
  completed: { color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' },
  active: { color: '#7CBBD0', background: 'rgba(90,154,177,0.16)', border: '1px solid rgba(124,187,208,0.28)' },
  locked: { color: '#8495A3', background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' },
}
const PHASE_LABEL: Record<string, string> = { completed: 'Completata', active: 'In corso', locked: 'Bloccata' }

const DECOY_PHASES = [
  { icon: '🚀', label: 'Onboarding', status: 'completed', steps: [['Setup account e piattaforma', true], ['Prima call con il coach', true], ['Definizione obiettivi 90 giorni', true]] },
  { icon: '🛠️', label: 'Build', status: 'active', steps: [['Piano di trading personale', true], ['Regole di risk management', true], ['Backtest della strategia', false], ['Journaling quotidiano', false], ['Review settimanale col coach', false]] },
  { icon: '🧪', label: 'Test', status: 'locked', steps: [] },
  { icon: '📦', label: 'Deploy', status: 'locked', steps: [] },
] as const

export function DecoyPercorso() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Il tuo Percorso" subtitle="Programma da 90 giorni — Fase attuale: Build" />
      <div className="space-y-4">
        {DECOY_PHASES.map((p) => {
          const done = p.steps.filter(s => s[1]).length
          return (
            <Card key={p.label} className={`p-6 ${p.status === 'locked' ? 'opacity-40' : ''}`} premium={p.status === 'active'}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                  style={p.status === 'completed' ? { background: 'rgba(70,211,154,0.16)', border: '1px solid rgba(70,211,154,0.24)' }
                    : p.status === 'active' ? { background: 'rgba(90,154,177,0.18)', border: '1px solid rgba(124,187,208,0.30)' }
                    : { background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}>
                  {p.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{p.label}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={PHASE_BADGE[p.status]}>{PHASE_LABEL[p.status]}</span>
                </div>
                {p.status !== 'locked' && <span className="text-sm" style={{ color: '#8495A3' }}>{done}/{p.steps.length}</span>}
              </div>
              {p.status !== 'locked' ? (
                <div className="space-y-2 pl-[52px]">
                  {p.steps.map(([label, ok]) => (
                    <div key={label as string} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={ok ? { background: 'rgba(70,211,154,0.16)', color: '#46D39A' } : { border: '1px solid var(--ist-w12)' }}>
                        {ok && <CheckCircle2 size={12} strokeWidth={2} />}
                      </div>
                      <span className={`text-sm ${ok ? 'line-through' : ''}`} style={{ color: ok ? '#8495A3' : '#C7D3DD' }}>{label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm flex items-center gap-2" style={{ color: '#56636F' }}>
                  <Lock size={14} strokeWidth={2} /> Completa la fase precedente per sbloccare
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ── Compiti ───────────────────────────────────────────────── */

const CMP_BADGE: Record<string, { label: string; css: CSSProperties }> = {
  assigned: { label: 'Da fare', css: { color: '#7CBBD0', background: 'rgba(124,187,208,0.14)', border: '1px solid rgba(124,187,208,0.24)' } },
  reviewed: { label: 'Rivisto', css: { color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.24)' } },
  submitted: { label: 'Consegnato', css: { color: '#F6C85F', background: 'rgba(246,200,95,0.14)', border: '1px solid rgba(246,200,95,0.24)' } },
}
const DECOY_ASSIGNMENTS = [
  { title: 'Analizza 3 setup sul grafico H1', coach: 'Coach Marco', date: '18 giu 2026', status: 'reviewed', desc: 'Individua tre configurazioni valide e allega gli screenshot con le annotazioni.', feedback: 'Buona lettura della struttura. Attenzione allo stop nel secondo setup.' },
  { title: 'Journal della settimana + emozioni', coach: 'Coach Marco', date: '24 giu 2026', status: 'submitted', desc: 'Compila il diario per 5 sessioni e annota lo stato emotivo prima di ogni trade.' },
  { title: 'Piano operativo per il breakout', coach: 'Coach Marco', date: '29 giu 2026', status: 'assigned', desc: 'Definisci ingressi, target e gestione del rischio sul modello di breakout.' },
]

export function DecoyCompiti() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Compiti" subtitle="Esercizi assegnati dal tuo coach" />
      <div className="space-y-3">
        {DECOY_ASSIGNMENTS.map((a) => {
          const st = CMP_BADGE[a.status]
          return (
            <Card key={a.title} className="p-5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="font-semibold text-white text-sm">{a.title}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={st.css}>{st.label}</span>
              </div>
              <p className="text-xs mb-2" style={{ color: '#8495A3' }}>Da {a.coach} · {a.date}</p>
              <p className="text-sm" style={{ color: '#C7D3DD' }}>{a.desc}</p>
              {a.feedback && (
                <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 size={13} strokeWidth={2} style={{ color: '#46D39A' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--ist-text)' }}>Feedback del coach</span>
                  </div>
                  <p className="text-sm" style={{ color: '#C7D3DD' }}>{a.feedback}</p>
                </div>
              )}
              <button className="mt-4 px-4 py-2 text-xs font-semibold rounded-full inline-flex items-center gap-2"
                style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-border)', color: 'var(--ist-text)' }}>
                <ImagePlus size={13} strokeWidth={2} /> Consegna
              </button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ── Mental Coach ──────────────────────────────────────────── */

const DECOY_MATERIALS = [
  { icon: '🎧', title: 'Meditazione pre-market (10 min)', type: 'Audio' },
  { icon: '📄', title: 'Guida: gestire il tilt dopo una perdita', type: 'PDF' },
  { icon: '🎬', title: 'Video: routine mentale del trader', type: 'Video' },
]
const DECOY_CHECKLIST = [
  ['Respirazione 4-7-8 prima della sessione', true],
  ['Rileggere le regole di rischio', true],
  ['Nessun trade sotto stress emotivo', false],
  ['Chiudere la piattaforma dopo 2 stop', false],
] as const

export function DecoyMentalCoach() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader title="Area Mental Coach" subtitle="Materiali e checklist per il tuo percorso mentale" />
        <span className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold flex-shrink-0 text-white"
          style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}>
          <MessageCircle size={15} strokeWidth={2} /> Scrivi
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {[{ n: 1, sub: 'Valutazione iniziale', done: true, date: 'Completata · 3 giu 2026' },
          { n: 2, sub: 'Follow-up e strategie', done: false, date: 'Programmata · 15 lug 2026' }].map((s) => (
          <Card key={s.n} className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                style={s.done ? { background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.24)' } : { background: 'var(--ist-w6)', border: '1px solid var(--ist-w10)' }}>📅</div>
              <div>
                <p className="font-semibold text-white">Sessione {s.n}</p>
                <p className="text-xs" style={{ color: '#8495A3' }}>{s.sub}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: s.done ? '#46D39A' : '#5A9AB1' }} />
              <span className="text-sm" style={{ color: s.done ? '#46D39A' : '#7CBBD0' }}>{s.date}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Materiali utili</h3>
        <div className="space-y-3">
          {DECOY_MATERIALS.map((m) => (
            <div key={m.title} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}>{m.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--ist-text)' }}>{m.title}</p>
                <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>{m.type}</p>
              </div>
              <span className="flex items-center gap-1 text-xs font-medium flex-shrink-0" style={{ color: 'var(--ist-accent-text)' }}>Apri <ExternalLink size={11} strokeWidth={2} /></span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Checklist</h3>
        <div className="space-y-1">
          {DECOY_CHECKLIST.map(([label, done]) => (
            <div key={label as string} className="w-full flex items-center gap-3 py-2">
              <span style={{ color: done ? '#46D39A' : 'var(--ist-text-muted)', flexShrink: 0 }}>
                {done ? <CheckSquare size={18} strokeWidth={2} /> : <Square size={18} strokeWidth={2} />}
              </span>
              <span className={`text-sm ${done ? 'line-through' : ''}`} style={{ color: done ? 'var(--ist-text-dim)' : 'var(--ist-text)' }}>{label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ── Live & Replay ─────────────────────────────────────────── */

const DECOY_REPLAYS = [
  { title: 'Analisi di mercato — settimana 24', host: 'Coach Marco', meta: '22 giu 2026', dur: '58 min', accent: '#7CBBD0' },
  { title: 'Psicologia: uscire dalle perdite', host: 'Mental Coach Sara', meta: '15 giu 2026', dur: '41 min', accent: '#B48CE0' },
  { title: 'Live Q&A — gestione del rischio', host: 'Coach Marco', meta: '8 giu 2026', dur: '1h 12min', accent: '#7CBBD0' },
]

export function DecoyLive() {
  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="Live & Replay" subtitle="Sessioni in diretta e registrazioni" />

      <div className="w-full text-left mb-8 rounded-3xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D2A3F 50%, #071420 100%)', border: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #FF5050, #FF8A50)' }} />
        <div className="relative p-6 lg:p-7">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.28)' }}>
              <Radio size={20} strokeWidth={2} style={{ color: '#FF5050' }} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full mb-2" style={{ background: 'rgba(255,80,80,0.18)', color: '#FF5050', border: '1px solid rgba(255,80,80,0.30)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5050]" /> LIVE ORA
              </span>
              <h2 className="text-lg lg:text-xl font-bold text-white mb-1 leading-tight">Sessione operativa in diretta</h2>
              <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>Coach Marco · Coach</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.50)' }}>Analizziamo il mercato in tempo reale e rispondiamo alle domande in chat.</p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--ist-text-dim)' }}>Replay disponibili</h2>
      <div className="space-y-2.5">
        {DECOY_REPLAYS.map((r) => (
          <Card key={r.title} className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${r.accent}12`, border: `1px solid ${r.accent}22` }}>
              <Radio size={17} strokeWidth={2} style={{ color: r.accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--ist-text)' }}>{r.title}</p>
              <p className="text-xs mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>{r.host} · {r.meta}</p>
              <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>
                <span className="flex items-center gap-1"><Clock size={11} strokeWidth={2} /> {r.dur}</span>
              </div>
            </div>
            <ChevronRight size={15} strokeWidth={2} className="flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }} />
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ── Calendario ────────────────────────────────────────────── */

const DECOY_EVENTS = [
  { title: 'Live analisi di mercato', date: 'Lun 6 lug · 18:00', accent: '#7CBBD0' },
  { title: 'Sessione mental coach di gruppo', date: 'Gio 9 lug · 20:30', accent: '#B48CE0' },
  { title: 'Q&A settimanale con il coach', date: 'Ven 10 lug · 19:00', accent: '#7CBBD0' },
]
const DECOY_MARKED = new Set([6, 9, 10, 17, 24])

export function DecoyCalendario() {
  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="Calendario" subtitle="Le live in programma" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        <Card className="p-5 h-fit">
          <p className="text-sm font-semibold text-white mb-4 text-center">Luglio 2026</p>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
              <span key={i} className="text-[10px] font-bold py-1" style={{ color: 'var(--ist-text-dim)' }}>{d}</span>
            ))}
            {Array.from({ length: 2 }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: 31 }).map((_, i) => {
              const day = i + 1
              const marked = DECOY_MARKED.has(day)
              return (
                <span key={day} className="text-xs py-1.5 rounded-lg flex items-center justify-center"
                  style={marked ? { background: 'rgba(90,154,177,0.18)', color: '#7CBBD0', fontWeight: 700 } : { color: 'var(--ist-text-muted)' }}>{day}</span>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 text-[11px]" style={{ borderTop: '1px solid var(--ist-w7)', color: 'var(--ist-text-dim)' }}>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF5050' }} /> In diretta</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#7CBBD0' }} /> In programma</span>
          </div>
        </Card>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--ist-text-dim)' }}>Prossimi appuntamenti</h2>
          <div className="space-y-2.5">
            {DECOY_EVENTS.map((e) => (
              <Card key={e.title} className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${e.accent}12`, border: `1px solid ${e.accent}22` }}>
                  <Radio size={16} strokeWidth={2} style={{ color: e.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--ist-text)' }}>{e.title}</p>
                  <p className="text-xs flex items-center gap-1" style={{ color: 'var(--ist-text-muted)' }}><Clock size={11} strokeWidth={2} /> {e.date}</p>
                </div>
                <ChevronRight size={15} strokeWidth={2} className="flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }} />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Diario ────────────────────────────────────────────────── */

const DECOY_DIARY = [
  { emotion: '😊', date: '29 giu 2026', result: '+€240', positive: true, trades: 4, notes: 'Rispettato il piano, ingressi puliti sui livelli. Buona gestione emotiva.' },
  { emotion: '😐', date: '27 giu 2026', result: '−€80', positive: false, trades: 3, notes: 'Entrato in anticipo su un breakout. Da rivedere il timing di ingresso.' },
  { emotion: '😤', date: '25 giu 2026', result: '+€60', positive: true, trades: 6, notes: 'Troppi trade, un po\' di overtrading nel pomeriggio. Chiuso comunque in verde.' },
]

export function DecoyDiario() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Diario di Trading" subtitle="Documenta ogni sessione per crescere come trader"
        action={<span className="px-5 py-2.5 text-white text-sm font-bold rounded-full" style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)' }}>+ Nuova voce</span>} />
      <div className="space-y-4">
        {DECOY_DIARY.map((d) => (
          <Card key={d.date} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{d.emotion}</span>
                <div>
                  <p className="text-sm" style={{ color: '#8495A3' }}>{d.date}</p>
                  <p className="text-lg font-bold" style={{ color: d.positive ? '#46D39A' : '#FF6B7A' }}>{d.result}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-xl font-medium" style={{ background: 'var(--ist-w7)', color: '#8495A3' }}>{d.trades} trade</span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#FF6B7A' }}><Trash2 size={14} strokeWidth={2} /></span>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#C7D3DD' }}>{d.notes}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ── Journal ───────────────────────────────────────────────── */

export function DecoyJournal() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Protocol Data Journal" subtitle="Strumento esterno per il tracking delle performance" />
      <Card className="p-8 text-center" premium>
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(90,154,177,0.16)', border: '1px solid rgba(124,187,208,0.28)' }}>
          <ExternalLink size={28} strokeWidth={1.5} className="text-ist-300" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Protocol Data Journal</h2>
        <p className="text-sm leading-relaxed mb-6 max-w-sm mx-auto" style={{ color: '#8495A3' }}>
          Il Protocol Data Journal è uno strumento esterno per documentare e analizzare le tue performance di trading in modo approfondito.
        </p>
        <span className="inline-flex items-center gap-2 px-6 py-3 text-white font-bold text-sm rounded-full" style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)' }}>
          Apri Protocol Data Journal <ExternalLink size={14} strokeWidth={2} />
        </span>
      </Card>
    </div>
  )
}
