import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

// Durate dell'animazione di ingresso dopo il login.
const HOLD_MS = 3700   // scena visibile
const FADE_MS = 950    // dissolvenza finale che rivela l'app
const TOTAL_MS = HOLD_MS + FADE_MS

// Pochi blob (3) MOLTO grandi e sfumati, palette vicina al logo:
// - viola e blu (colori del brand) ai lati, coprono buona parte dello schermo
// - un accento caldo/acceso (arancio) che "stacca"
// - il BLU sta al centro dietro al logo (colore "più vicino") → lo rivela un po' di più.
// `size` = diametro desktop di riferimento; `spread` = vw per il responsive; `blur` px.
const BLOBS = [
  { color: '#7c3aed', size: 1320, spread: 132, blur: 100, top: '40%', left: '-4%',  anim: 'istBlobA', dur: 11, delay: -1 }, // viola — sx
  { color: '#f9683a', size: 1220, spread: 128, blur: 100, top: '62%', left: '104%', anim: 'istBlobD', dur: 13, delay: -5 }, // arancio caldo — dx
  { color: '#1f7fa6', size: 820,  spread: 88,  blur: 82,  top: '48%', left: '50%',  anim: 'istBlobB', dur: 12, delay: -3 }, // blu del logo — centro, dietro al logo
]

const blobDiameter = (size: number, spread: number) =>
  `clamp(${Math.round(size * 0.34)}px, ${spread}vw, ${size}px)`

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
      {/* Strato dei colori: multiply su bianco → tinte piene, grandi e sfumate */}
      <div className="absolute inset-0" style={{ filter: 'saturate(1.12)' }}>
        {BLOBS.map((b, i) => {
          const d = blobDiameter(b.size, b.spread)
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
                  background: `radial-gradient(circle at 50% 50%, ${b.color} 0%, ${b.color}cc 40%, transparent 74%)`,
                  filter: `blur(${b.blur}px)`,
                  mixBlendMode: 'multiply',
                  willChange: 'transform, border-radius',
                  animation: `${b.anim} ${b.dur}s ease-in-out ${b.delay}s infinite`,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Velo bianco centrale LEGGERO: ammorbidisce senza nascondere il logo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 22%, transparent 48%)',
        }}
      />

      {/* Logo bianco al centro: opaco, rivelato dal blu che gli sta dietro */}
      <img
        src="/logo-white.png"
        alt=""
        width={168}
        height={168}
        draggable={false}
        className="relative"
        style={{
          width: 'clamp(124px, 35vw, 172px)',
          height: 'clamp(124px, 35vw, 172px)',
          objectFit: 'contain',
          animation: `istLoginLogo ${(TOTAL_MS / 1000).toFixed(2)}s ease-out both`,
        }}
      />
    </div>
  )
}
