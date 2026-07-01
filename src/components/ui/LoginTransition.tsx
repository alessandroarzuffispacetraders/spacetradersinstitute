import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

// Durate dell'animazione di ingresso dopo il login.
const HOLD_MS = 3700   // scena visibile
const FADE_MS = 950    // dissolvenza finale che rivela l'app
const TOTAL_MS = HOLD_MS + FADE_MS

// Blob di colore, sgargianti e "spaziali", molto sfocati. Stanno sul PERIMETRO
// (i colori arrivano dai lati) e si muovono/cambiano forma (keyframe in index.css).
// Solo i loro bordi morbidi sfiorano il centro → rivelano il logo bianco appena.
// `size` è il diametro desktop di riferimento; reso responsive con clamp+vw.
const BLOBS = [
  { color: '#7c3aed', size: 620, top: '34%', left: '4%',   anim: 'istBlobA', dur: 9,  delay: -1 },  // viola   — sx alto
  { color: '#06b6d4', size: 560, top: '26%', left: '96%',  anim: 'istBlobC', dur: 11, delay: -4 },  // ciano   — dx alto
  { color: '#ec4899', size: 600, top: '74%', left: '90%',  anim: 'istBlobB', dur: 10, delay: -2 },  // magenta — dx basso
  { color: '#2563eb', size: 640, top: '72%', left: '8%',   anim: 'istBlobD', dur: 12, delay: -6 },  // blu     — sx basso
  { color: '#14b8a6', size: 460, top: '5%',  left: '52%',  anim: 'istBlobA', dur: 8,  delay: -3 },  // teal    — alto
  { color: '#f59e0b', size: 400, top: '96%', left: '44%',  anim: 'istBlobD', dur: 13, delay: -5 },  // ambra   — basso
  { color: '#4f46e5', size: 520, top: '50%', left: '99%',  anim: 'istBlobC', dur: 10, delay: -7 },  // indaco  — dx mid
]

const blobDiameter = (size: number) => `clamp(220px, 60vw, ${size}px)`

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
      {/* Strato dei colori: multiply su bianco → tinte piene che si mescolano ai lati */}
      <div className="absolute inset-0" style={{ filter: 'saturate(1.15)' }}>
        {BLOBS.map((b, i) => {
          const d = blobDiameter(b.size)
          return (
            // Wrapper: centra il blob sul punto (top,left); responsive.
            <div
              key={i}
              className="absolute"
              style={{ top: b.top, left: b.left, width: d, height: d, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className="w-full h-full"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${b.color} 0%, ${b.color}cc 38%, transparent 72%)`,
                  filter: 'blur(70px)',
                  mixBlendMode: 'multiply',
                  willChange: 'transform, border-radius',
                  animation: `${b.anim} ${b.dur}s ease-in-out ${b.delay}s infinite`,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Velo bianco centrale: tiene il centro pulito così il logo si rivela solo appena */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.6) 16%, transparent 42%)',
        }}
      />

      {/* Logo bianco al centro: opaco, rivelato appena dai colori che gli passano dietro */}
      <img
        src="/logo-white.png"
        alt=""
        width={168}
        height={168}
        draggable={false}
        className="relative"
        style={{
          width: 'clamp(120px, 34vw, 168px)',
          height: 'clamp(120px, 34vw, 168px)',
          objectFit: 'contain',
          animation: `istLoginLogo ${(TOTAL_MS / 1000).toFixed(2)}s ease-out both`,
        }}
      />
    </div>
  )
}
