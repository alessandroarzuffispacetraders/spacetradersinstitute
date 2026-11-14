import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Check } from 'lucide-react'
import { useCountUp } from './motion'

const PHASES = [
  { label: 'Onboarding', key: 'onboarding' },
  { label: 'Build', key: 'build' },
  { label: 'Test', key: 'test' },
  { label: 'Deploy', key: 'deploy' },
]

// "Il tuo percorso" in una riga: percentuale che sale, le 4 fasi con la
// linea che si riempie fino a quella attuale, streak e badge. Apre il Percorso.
export default function PathStrip({ progress, phase, activeDone, activeTotal, streak, badges }: {
  progress: number
  phase: string
  activeDone: number
  activeTotal: number
  streak: number
  badges: number
}) {
  const navigate = useNavigate()
  const pct = useCountUp(progress)
  const idx = Math.max(0, PHASES.findIndex(p => p.key === phase))
  const [fill, setFill] = useState(0)
  useEffect(() => { const t = window.setTimeout(() => setFill(idx / (PHASES.length - 1)), 120); return () => window.clearTimeout(t) }, [idx])

  return (
    <button
      onClick={() => navigate('/student/percorso')}
      className="home-glass group w-full text-left rounded-3xl px-5 py-4 lg:px-7 lg:py-5 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8 transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-4 lg:w-[250px] flex-shrink-0">
        <span className="text-4xl lg:text-5xl font-black tabular-nums leading-none text-white">{pct}<span className="text-xl lg:text-2xl" style={{ color: 'rgba(255,255,255,0.55)' }}>%</span></span>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ist-media-accent)' }}>Il tuo percorso</span>
          <span className="block text-sm font-semibold text-white truncate">
            Fase {PHASES[idx]?.label}{activeTotal > 0 && <span style={{ color: 'rgba(255,255,255,0.6)' }}> · {activeDone}/{activeTotal} passi</span>}
          </span>
        </span>
      </div>

      {/* Fasi con la linea di avanzamento */}
      <div className="relative flex-1 min-w-0 px-3 pt-1">
        <div className="absolute left-3 right-3 top-[15px] h-[2px] rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <div className="absolute left-3 top-[15px] h-[2px] rounded-full" style={{ width: `calc((100% - 1.5rem) * ${fill})`, background: 'linear-gradient(90deg, #46D39A, var(--ist-media-accent))', transition: 'width 1.1s cubic-bezier(.2,.7,.2,1)', boxShadow: '0 0 12px rgba(124,187,208,0.5)' }} />
        <div className="relative flex justify-between">
          {PHASES.map((p, i) => {
            const done = i < idx, active = i === idx
            return (
              <div key={p.key} className="flex flex-col items-center gap-1.5 w-16">
                <span
                  className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'home-phase-active' : ''}`}
                  style={done ? { background: '#46D39A', color: '#05070d' }
                    : active ? { background: 'var(--ist-media-accent)', color: '#05070d' }
                    : { background: '#151b28', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.14)' }}
                >
                  {done ? <Check size={12} strokeWidth={3.2} /> : i + 1}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: done ? '#46D39A' : active ? '#fff' : 'rgba(255,255,255,0.45)' }}>{p.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {streak > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(70,211,154,0.14)', color: '#46D39A' }}>🔥 {streak} {streak === 1 ? 'giorno' : 'giorni'}</span>
        )}
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(124,187,208,0.14)', color: 'var(--ist-media-accent)' }}>🏆 {badges} badge</span>
        <ChevronRight size={18} strokeWidth={2.2} className="ml-auto lg:ml-1 transition-transform group-hover:translate-x-0.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
      </div>
    </button>
  )
}
