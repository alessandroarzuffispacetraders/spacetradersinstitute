import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

// Durate dell'animazione di ingresso dopo il login.
const HOLD_MS = 3700   // scena visibile
const FADE_MS = 950    // dissolvenza finale che rivela l'app
const TOTAL_MS = HOLD_MS + FADE_MS

// Blob di colore: sgargianti e "spaziali", molto sfocati. Si muovono e cambiano
// forma (keyframe in index.css) passando dietro al logo bianco e rivelandolo.
// Posizionati attorno al centro così il logo è quasi sempre "svelato" da un colore.
const BLOBS = [
  { color: '#7c3aed', size: 620, top: '30%', left: '28%', anim: 'istBlobA', dur: 9,  delay: -1 },  // viola
  { color: '#06b6d4', size: 560, top: '26%', left: '58%', anim: 'istBlobC', dur: 11, delay: -4 },  // ciano
  { color: '#ec4899', size: 600, top: '58%', left: '54%', anim: 'istBlobB', dur: 10, delay: -2 },  // magenta
  { color: '#2563eb', size: 640, top: '54%', left: '30%', anim: 'istBlobD', dur: 12, delay: -6 },  // blu
  { color: '#14b8a6', size: 480, top: '40%', left: '46%', anim: 'istBlobA', dur: 8,  delay: -3 },  // teal
  { color: '#f59e0b', size: 420, top: '46%', left: '66%', anim: 'istBlobD', dur: 13, delay: -5 },  // ambra
  { color: '#4f46e5', size: 500, top: '52%', left: '44%', anim: 'istBlobC', dur: 10, delay: -7 },  // indaco
]

export default function LoginTransition() {
  const { justLoggedIn, clearJustLoggedIn } = useAuth()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!justLoggedIn) return
    setLeaving(false)
    const t1 = setTimeout(() => setLeaving(true), HOLD_MS)
    const t2 = setTimeout(() => clearJustLoggedIn(), TOTAL_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [justLoggedIn, clearJustLoggedIn])

  if (!justLoggedIn) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background: '#ffffff',
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* Strato dei colori: multiply su bianco → tinte piene che si mescolano */}
      <div className="absolute inset-0" style={{ filter: 'saturate(1.15)' }}>
        {BLOBS.map((b, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              marginTop: -b.size / 2,
              marginLeft: -b.size / 2,
              background: `radial-gradient(circle at 50% 50%, ${b.color} 0%, ${b.color}cc 38%, transparent 72%)`,
              filter: 'blur(72px)',
              mixBlendMode: 'multiply',
              willChange: 'transform, border-radius',
              animation: `${b.anim} ${b.dur}s ease-in-out ${b.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Alone bianco ai bordi per mantenere lo sfondo pulito e ariose */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 52%, rgba(255,255,255,0.85) 100%)' }}
      />

      {/* Logo bianco al centro: opaco, rivelato dai colori che gli passano dietro */}
      <img
        src="/logo-white.png"
        alt=""
        width={168}
        height={168}
        draggable={false}
        className="relative"
        style={{
          width: 168,
          height: 168,
          objectFit: 'contain',
          animation: `istLoginLogo ${(TOTAL_MS / 1000).toFixed(2)}s ease-out both`,
        }}
      />
    </div>
  )
}
