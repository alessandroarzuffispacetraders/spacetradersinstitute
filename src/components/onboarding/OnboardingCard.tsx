import { useEffect, useRef } from 'react'
import { Compass, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useOnboarding } from '../../lib/onboarding'
import { startPlatformTour } from '../../lib/tour'

// Primi passi: resta solo il tour della piattaforma (parte da solo al primo
// accesso). Finché non è completato, in Home c'è questa striscia compatta.
export default function OnboardingCard() {
  const { user } = useAuth()
  const ob = useOnboarding(user?.id ?? '')

  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStarted.current) return
    if (user?.role !== 'student' || ob.loading) return
    if (ob.tutorialDone || ob.tutorialPrompted) return
    autoStarted.current = true
    ob.markTutorialPrompted()
    const t = setTimeout(() => startPlatformTour(() => ob.markTutorialDone()), 700)
    return () => clearTimeout(t)
  }, [user?.role, ob.loading, ob.tutorialDone, ob.tutorialPrompted, ob])

  if (user?.role !== 'student' || ob.loading || ob.allDone) return null

  return (
    <div className="cinema-px">
      <button
        onClick={() => startPlatformTour(() => ob.markTutorialDone())}
        className="home-glass group w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3.5"
      >
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,187,208,0.16)', color: 'var(--ist-media-accent)' }}>
          <Compass size={19} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-white">Fai il tour della piattaforma</span>
          <span className="block text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Due minuti per scoprire dove trovi tutto.</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold flex-shrink-0" style={{ background: '#fff', color: '#0b0f18' }}>
          Avvia <ArrowRight size={13} strokeWidth={2.6} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </div>
  )
}
