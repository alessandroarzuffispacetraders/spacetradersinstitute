import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

// Durate dell'animazione di ingresso dopo il login.
const HOLD_MS = 2000   // logo pienamente visibile
const FADE_MS = 650    // dissolvenza finale che rivela l'app

interface Star {
  top: number
  left: number
  size: number
  delay: number
  duration: number
}

// Blob "nebulosa": sfocati, animati, nei colori del logo.
const NEBULAS = [
  { top: '12%', left: '14%', size: 420, color: 'rgba(91,168,196,0.55)', anim: 'istNebulaDrift', dur: 14 },
  { top: '58%', left: '62%', size: 480, color: 'rgba(24,61,82,0.75)', anim: 'istNebulaDrift2', dur: 18 },
  { top: '68%', left: '10%', size: 360, color: 'rgba(40,102,128,0.5)', anim: 'istNebulaDrift', dur: 16 },
  { top: '6%', left: '66%', size: 340, color: 'rgba(124,187,208,0.4)', anim: 'istNebulaDrift2', dur: 20 },
]

export default function LoginTransition() {
  const { justLoggedIn, clearJustLoggedIn } = useAuth()
  const [leaving, setLeaving] = useState(false)

  // Campo stellare generato una volta sola.
  const stars = useMemo<Star[]>(() => {
    const arr: Star[] = []
    for (let i = 0; i < 70; i++) {
      arr.push({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 3,
        duration: Math.random() * 2.5 + 1.8,
      })
    }
    return arr
  }, [])

  useEffect(() => {
    if (!justLoggedIn) return
    setLeaving(false)
    const t1 = setTimeout(() => setLeaving(true), HOLD_MS)
    const t2 = setTimeout(() => clearJustLoggedIn(), HOLD_MS + FADE_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [justLoggedIn, clearJustLoggedIn])

  if (!justLoggedIn) return null

  return (
    <div
      data-inverted="true"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 38%, #0b1b2b 0%, #060c16 55%, #02040a 100%)',
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* Nebulose sfocate */}
      {NEBULAS.map((n, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            top: n.top,
            left: n.left,
            width: n.size,
            height: n.size,
            background: `radial-gradient(circle, ${n.color} 0%, transparent 70%)`,
            filter: 'blur(70px)',
            mixBlendMode: 'screen',
            animation: `${n.anim} ${n.dur}s ease-in-out infinite`,
          }}
        />
      ))}

      {/* Campo stellare */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ animation: 'istStarfieldFloat 20s ease-in-out infinite alternate' }}
      >
        {stars.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              background: '#ffffff',
              boxShadow: '0 0 4px rgba(255,255,255,0.8)',
              animation: `istTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Vignettatura per profondità */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(2,4,10,0.85) 100%)' }}
      />

      {/* Logo bianco al centro con glow + anello */}
      <div className="relative flex items-center justify-center" style={{ animation: 'istLogoIn 0.9s cubic-bezier(0.22,1,0.36,1) both' }}>
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 240,
            height: 240,
            border: '1px solid rgba(124,187,208,0.5)',
            animation: 'istRingPulse 2.4s ease-out 0.3s infinite',
          }}
        />
        <img
          src="/logo-white.png"
          alt=""
          width={148}
          height={148}
          draggable={false}
          style={{
            width: 148,
            height: 148,
            objectFit: 'contain',
            animation: 'istLogoGlow 2.6s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  )
}
