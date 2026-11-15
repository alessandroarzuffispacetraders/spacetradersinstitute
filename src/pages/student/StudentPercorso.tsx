import { useState, createContext, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Loader2, Play, Brain, UserRound, Sparkles, ClipboardCheck, ArrowRight, Trophy, RotateCcw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import { useCinemaMode, useCoverTone } from '../../context/ThemeContext'
import { useJourney, JourneyStep, JourneyPhase, Journey } from '../../lib/journey'
import { Reveal, useCountUp } from '../../components/home/motion'
import WelcomeVideoModal from '../../components/home/WelcomeVideoModal'
import UserAvatar from '../../components/ui/UserAvatar'
import { useVimeoThumb } from '../../lib/useVimeoThumb'

// Dati per le immagini dei passi che non sono video (profilo, benvenuto).
const StepCtx = createContext<{ user: { name: string; avatarUrl?: string; avatarPreset?: string } | null; welcomeUrl: string | null }>({ user: null, welcomeUrl: null })

const KIND_ICON = { profile: UserRound, welcome: Sparkles, videos: Play, session: Brain, task: ClipboardCheck }

// Anello di avanzamento con la percentuale che sale.
function Ring({ pct, size = 150 }: { pct: number; size?: number }) {
  const v = useCountUp(pct, 1300)
  const r = size / 2 - 9, c = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={9} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#jr)" strokeWidth={9} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ filter: 'drop-shadow(0 0 10px rgba(124,187,208,0.55))' }} />
        <defs><linearGradient id="jr" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#46D39A" /><stop offset="100%" stopColor="#7CBBD0" /></linearGradient></defs>
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tabular-nums text-white leading-none">{v}<span className="text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>%</span></span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>completato</span>
      </span>
    </div>
  )
}

// Le 4 fasi come segmenti che si riempiono.
function PhaseBar({ journey }: { journey: Journey }) {
  return (
    <div className="grid grid-cols-4 gap-2 lg:gap-3">
      {journey.phases.map((p, i) => {
        const fill = p.total ? p.done / p.total : 0
        return (
          <div key={p.id} className="min-w-0">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full journey-fill" style={{ width: `${Math.round(fill * 100)}%`, background: p.state === 'completed' ? '#46D39A' : 'linear-gradient(90deg, #46D39A, #7CBBD0)' }} />
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] truncate" style={{ color: p.state === 'active' ? '#fff' : p.state === 'completed' ? '#46D39A' : 'rgba(255,255,255,0.4)' }}>
              {i + 1} · {p.label}
            </p>
            <p className="text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.45)' }}>{p.done}/{p.total}</p>
          </div>
        )
      })}
    </div>
  )
}

function StepImage({ step, className = '' }: { step: JourneyStep; className?: string }) {
  const tone = useCoverTone()
  const { user, welcomeUrl } = useContext(StepCtx)
  const welcomeThumb = useVimeoThumb(step.kind === 'welcome' ? welcomeUrl : null, 960)
  const Icon = KIND_ICON[step.kind]
  const img = step.kind === 'welcome' ? welcomeThumb : tone === 'light' && step.imageLight ? step.imageLight : step.image
  if (img) return <img src={img} alt="" className={`object-cover ${className}`} style={{ objectPosition: step.kind === 'welcome' ? '50% 50%' : '50% 22%' }} />
  if (step.kind === 'profile' && user) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ background: 'radial-gradient(circle at 50% 45%, rgba(124,187,208,0.3), rgba(5,7,13,0.95) 70%)' }}>
        <span className="rounded-full p-[3px]" style={{ background: 'linear-gradient(135deg, #7CBBD0, rgba(255,255,255,0.05))', boxShadow: '0 0 40px rgba(124,187,208,0.35)' }}>
          <span className="block rounded-full overflow-hidden" style={{ background: '#05070d' }}>
            <UserAvatar user={{ name: user.name, avatarUrl: user.avatarUrl, avatarPreset: user.avatarPreset }} size={92} />
          </span>
        </span>
      </div>
    )
  }
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ background: step.kind === 'session' ? 'radial-gradient(circle at 30% 30%, rgba(143,179,255,0.28), rgba(5,7,13,0.9))' : 'radial-gradient(circle at 30% 30%, rgba(124,187,208,0.25), rgba(5,7,13,0.9))' }}>
      <Icon size={34} strokeWidth={1.6} style={{ color: step.kind === 'session' ? '#8FB3FF' : '#7CBBD0' }} />
    </div>
  )
}

// Il passo da fare adesso, in grande.
function NextStep({ journey, onAction }: { journey: Journey; onAction: (s: JourneyStep) => void }) {
  const s = journey.next
  if (!s) {
    return (
      <div className="journey-next rounded-[28px] p-6 lg:p-8 flex items-center gap-5">
        <span className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(246,200,95,0.15)', color: '#F6C85F' }}><Trophy size={30} /></span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#F6C85F' }}>Percorso completato</p>
          <p className="text-2xl font-extrabold text-white">Hai fatto tutto. Complimenti!</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Quando arrivano nuovi contenuti li trovi qui come prossimi passi.</p>
        </div>
      </div>
    )
  }
  const pos = journey.steps.indexOf(s) + 1
  const phaseIdx = journey.phases.findIndex(p => p.id === s.phase)
  return (
    <div className="journey-next rounded-[28px] overflow-hidden flex flex-col md:flex-row">
      <div className="relative md:w-[42%] aspect-video md:aspect-auto md:min-h-[260px] flex-shrink-0">
        <StepImage step={s} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(5,7,13,0) 55%, rgba(10,14,23,0.95) 100%)' }} />
        <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(to top, rgba(10,14,23,1) 0%, rgba(10,14,23,0) 55%)' }} />
      </div>
      <div className="relative flex-1 p-5 lg:p-7 flex flex-col justify-center -mt-10 md:mt-0">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ist-media-accent)' }}>
          <span className="journey-dot" /> Prossimo passo · Fase {phaseIdx + 1} {journey.phases[phaseIdx]?.label} · {pos} di {journey.totalSteps}
        </p>
        <h2 className="mt-2 text-2xl lg:text-[32px] font-extrabold tracking-tight leading-tight text-white" style={{ textWrap: 'balance' }}>{s.title}</h2>
        <p className="mt-2 text-sm lg:text-[15px]" style={{ color: 'rgba(255,255,255,0.72)' }}>{s.detail}</p>
        {s.kind === 'videos' && s.total ? (
          <div className="mt-4 flex items-center gap-3 max-w-md">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div className="h-full rounded-full journey-fill" style={{ width: `${Math.round(s.progress * 100)}%`, background: 'linear-gradient(90deg, #46D39A, #7CBBD0)' }} />
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.7)' }}>{s.doneCount}/{s.total} lezioni</span>
          </div>
        ) : null}
        <div className="mt-5">
          <button onClick={() => onAction(s)} className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[15px] font-bold transition-all active:scale-[0.97] hover:opacity-90" style={{ background: '#fff', color: '#0b0f18' }}>
            {s.kind === 'task' ? <Check size={18} strokeWidth={2.8} /> : s.kind === 'videos' || s.kind === 'welcome' ? <Play size={18} strokeWidth={2.5} fill="currentColor" /> : <ArrowRight size={18} strokeWidth={2.5} />}
            {s.cta}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepRow({ step, index, isNext, onAction, onUndo }: {
  step: JourneyStep; index: number; isNext: boolean
  onAction: (s: JourneyStep) => void; onUndo: (s: JourneyStep) => void
}) {
  const Icon = KIND_ICON[step.kind]
  return (
    <li className={`journey-step relative pl-14 lg:pl-16 ${isNext ? 'is-next' : ''} ${step.done ? 'is-done' : ''}`}>
      <span className="journey-node absolute left-0 top-3 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold">
        {step.done ? <Check size={18} strokeWidth={3} className="journey-check" /> : isNext ? <Icon size={17} strokeWidth={2.2} /> : index}
      </span>
      <div className="journey-card rounded-2xl p-3 lg:p-3.5 flex items-center gap-3.5">
        {step.kind === 'videos' && (
          <div className="relative hidden sm:block w-28 lg:w-32 aspect-video rounded-xl overflow-hidden flex-shrink-0">
            <StepImage step={step} className="absolute inset-0 w-full h-full" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-bold leading-snug ${step.done ? '' : 'text-white'}`} style={step.done ? { color: 'rgba(255,255,255,0.55)' } : undefined}>{step.title}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: step.done ? '#46D39A' : 'rgba(255,255,255,0.6)' }}>{step.status ?? step.detail}</p>
          {step.kind === 'videos' && step.total ? (
            <div className="mt-2 flex items-center gap-2 max-w-xs">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.round(step.progress * 100)}%`, background: step.done ? '#46D39A' : '#7CBBD0' }} />
              </div>
              <span className="text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.5)' }}>{step.doneCount}/{step.total}</span>
            </div>
          ) : null}
        </div>
        {step.kind === 'task' && step.done ? (
          <button onClick={() => onUndo(step)} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }} title="Segna come da fare">
            <RotateCcw size={12} /> Annulla
          </button>
        ) : (
          <button
            onClick={() => onAction(step)}
            className="text-xs font-bold px-3.5 py-2 rounded-xl flex-shrink-0 transition-all active:scale-[0.97]"
            style={isNext ? { background: '#fff', color: '#0b0f18' } : step.done ? { color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)' } : { color: '#fff', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {step.cta}
          </button>
        )}
      </div>
    </li>
  )
}

function PhaseBlock({ phase, index, nextKey, open, onToggle, onAction, onUndo }: {
  phase: JourneyPhase; index: number; nextKey?: string; open: boolean
  onToggle: () => void; onAction: (s: JourneyStep) => void; onUndo: (s: JourneyStep) => void
}) {
  const stateLabel = phase.state === 'completed' ? 'Completata' : phase.state === 'active' ? 'In corso' : 'Da fare'
  const stateStyle = phase.state === 'completed' ? { background: 'rgba(70,211,154,0.14)', color: '#46D39A' }
    : phase.state === 'active' ? { background: 'rgba(124,187,208,0.16)', color: 'var(--ist-media-accent)' }
    : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }
  return (
    <section className={`journey-phase ${phase.state}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-4 text-left py-2">
        <span className="journey-phase-num w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black flex-shrink-0">
          {phase.state === 'completed' ? <Check size={22} strokeWidth={3} /> : index + 1}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-[22px] lg:text-[26px] font-extrabold tracking-tight text-white">{phase.label}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md" style={stateStyle}>{stateLabel}</span>
          </span>
          <span className="block text-xs lg:text-sm truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{phase.tagline} · {phase.done}/{phase.total} passi</span>
        </span>
        <ChevronDown size={20} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'rgba(255,255,255,0.5)' }} />
      </button>
      {open && (
        <ol className="journey-list relative mt-3 space-y-2.5">
          {phase.steps.length === 0 && <li className="pl-14 lg:pl-16 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>I contenuti di questa fase arrivano a breve.</li>}
          {phase.steps.map((s, i) => (
            <StepRow key={s.key} step={s} index={i + 1} isNext={s.key === nextKey} onAction={onAction} onUndo={onUndo} />
          ))}
        </ol>
      )}
    </section>
  )
}

// Percorso: si costruisce da solo con quello che c'è da fare, in ordine, e si
// spunta man mano. In alto il prossimo passo, sotto le 4 fasi.
export default function StudentPercorso() {
  useCinemaMode()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setProfileOpen } = useUI()
  const { journey, loading, setDone, welcomeUrl } = useJourney(user?.id ?? '', {
    hasPhoto: !!(user?.avatarUrl || user?.avatarPreset),
    hasMentalCoach: !!user?.assignedMentalCoachId,
  })
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({})
  const [welcomeOpen, setWelcomeOpen] = useState(false)

  const act = (s: JourneyStep) => {
    const a = s.action
    if (a.type === 'lesson') navigate(`/student/corsi/lezione/${a.lessonId}`)
    else if (a.type === 'section') navigate(`/student/corsi/${a.categoryId}`)
    else if (a.type === 'mental-chat') navigate('/student/chat', { state: user?.assignedMentalCoachId ? { openDm: user.assignedMentalCoachId } : { tab: 'direct' } })
    else if (a.type === 'profile') setProfileOpen(true)
    else if (a.type === 'welcome') { setWelcomeOpen(true); void setDone(s.key, true) }
    else if (a.type === 'self-check') void setDone(s.key, !s.done)
  }

  if (loading) {
    return <div className="cinema-page flex items-center justify-center py-32"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} /></div>
  }

  const isOpen = (p: JourneyPhase) => openPhases[p.id] ?? p.state === 'active'
  const phaseIdx = journey.phases.findIndex(p => p.id === journey.phase)
  const current = journey.phases[phaseIdx]

  return (
    <StepCtx.Provider value={{ user: user ? { name: user.name, avatarUrl: user.avatarUrl, avatarPreset: user.avatarPreset } : null, welcomeUrl: welcomeUrl ?? null }}>
    <div className="cinema-page pb-32 lg:pb-16">
      {/* Testata: dove sei e quanto manca */}
      <section className="journey-hero">
        <div className="cinema-px pt-8 lg:pt-12 pb-8 lg:pb-10 flex flex-col-reverse lg:flex-row lg:items-center gap-6 lg:gap-12">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--ist-media-accent)' }}>Il tuo percorso</p>
            <h1 className="mt-1.5 text-[34px] lg:text-[52px] font-extrabold tracking-tight leading-[1.02] text-white">
              {journey.next ? <>Fase {phaseIdx + 1} · {current?.label}</> : 'Percorso completato'}
            </h1>
            <p className="mt-2 text-sm lg:text-base" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {journey.next ? current?.tagline : 'Hai completato tutti i passi disponibili.'} · <b className="text-white">{journey.doneSteps}</b> di {journey.totalSteps} passi fatti
            </p>
            <div className="mt-6 max-w-3xl"><PhaseBar journey={journey} /></div>
          </div>
          <Ring pct={journey.progress} />
        </div>
      </section>

      <div className="cinema-px flex flex-col gap-8 lg:gap-10">
        <Reveal><NextStep journey={journey} onAction={act} /></Reveal>

        <div className="flex flex-col gap-6 lg:gap-8 max-w-5xl">
          {journey.phases.map((p, i) => (
            <Reveal key={p.id} delay={i * 60}>
              <PhaseBlock
                phase={p} index={i} nextKey={journey.next?.key} open={isOpen(p)}
                onToggle={() => setOpenPhases(o => ({ ...o, [p.id]: !isOpen(p) }))}
                onAction={act} onUndo={s => void setDone(s.key, false)}
              />
            </Reveal>
          ))}
        </div>
      </div>

      {welcomeOpen && welcomeUrl && <WelcomeVideoModal url={welcomeUrl} onClose={() => setWelcomeOpen(false)} />}
    </div>
    </StepCtx.Provider>
  )
}
