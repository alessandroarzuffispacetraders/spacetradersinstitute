import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Undo2, Eraser, X } from 'lucide-react'
import { downloadExerciseBlob } from '../../lib/assignments'
import { useBackInterceptor } from '../../lib/androidBack'

const COLORS = ['#FF3B3B', '#3B82F6', '#46D39A', '#F6C85F', '#FFFFFF', '#111111']
const WIDTHS = [3, 6, 12]
const MAX_SIDE = 1600 // cap exported image's longest side

interface Stroke { color: string; width: number; points: { x: number; y: number }[] }

// Freehand annotation over a student image. Loads the bytes as a blob (so the
// canvas isn't tainted), lets the coach draw, and exports a flattened PNG.
export default function ImageAnnotator({ objectKey, onSave, onClose }: {
  objectKey: string
  onSave: (blob: Blob) => Promise<void>
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef<Stroke | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(WIDTHS[1])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [, force] = useState(0) // re-render after ref-based stroke changes

  // Montato solo quando aperto → il tasto indietro Android lo chiude.
  useBackInterceptor(onClose, true)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current, img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const all = drawingRef.current ? [...strokesRef.current, drawingRef.current] : strokesRef.current
    for (const s of all) {
      if (s.points.length === 0) continue
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
      ctx.stroke()
      if (s.points.length === 1) {
        ctx.fillStyle = s.color
        ctx.beginPath(); ctx.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2); ctx.fill()
      }
    }
  }, [])

  useEffect(() => {
    let alive = true
    let url: string | null = null
    ;(async () => {
      const blob = await downloadExerciseBlob(objectKey)
      if (!alive) return
      if (!blob) { setLoading(false); return }
      url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        if (!alive) return
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = canvasRef.current!
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
        imgRef.current = img
        redraw()
        setLoading(false)
      }
      img.src = url
    })()
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [objectKey, redraw])

  const toPoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const onDown = (e: React.PointerEvent) => {
    if (loading) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drawingRef.current = { color, width, points: [toPoint(e)] }
    redraw()
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return
    drawingRef.current.points.push(toPoint(e))
    redraw()
  }
  const onUp = () => {
    if (!drawingRef.current) return
    strokesRef.current = [...strokesRef.current, drawingRef.current]
    drawingRef.current = null
    redraw(); force(n => n + 1)
  }

  const undo = () => { strokesRef.current = strokesRef.current.slice(0, -1); redraw(); force(n => n + 1) }
  const clear = () => { strokesRef.current = []; redraw(); force(n => n + 1) }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas || saving) return
    setSaving(true)
    canvas.toBlob(async (blob) => {
      if (blob) await onSave(blob)
      setSaving(false)
      onClose()
    }, 'image/png')
  }

  const hasStrokes = strokesRef.current.length > 0

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col" style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--ist-border)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>Annota immagine</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/[0.06]" style={{ color: 'var(--ist-text-dim)' }}>
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap" style={{ borderBottom: '1px solid var(--ist-border)' }}>
          <div className="flex items-center gap-1.5">
            {COLORS.map(c => (
              <button
                key={c} onClick={() => setColor(c)} title="Colore"
                className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                style={{ background: c, border: color === c ? '2px solid var(--ist-accent-text)' : '2px solid var(--ist-border)' }}
              />
            ))}
          </div>
          <div className="w-px h-5" style={{ background: 'var(--ist-border)' }} />
          <div className="flex items-center gap-1.5">
            {WIDTHS.map(w => (
              <button
                key={w} onClick={() => setWidth(w)} title="Spessore"
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: width === w ? 'var(--ist-w10)' : 'transparent', border: '1px solid var(--ist-border)' }}
              >
                <span className="rounded-full block" style={{ width: w, height: w, background: 'var(--ist-text)' }} />
              </button>
            ))}
          </div>
          <div className="w-px h-5" style={{ background: 'var(--ist-border)' }} />
          <button onClick={undo} disabled={!hasStrokes} className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-30" style={{ border: '1px solid var(--ist-border)', color: 'var(--ist-text-muted)' }}>
            <Undo2 size={13} strokeWidth={2} /> Annulla
          </button>
          <button onClick={clear} disabled={!hasStrokes} className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-30" style={{ border: '1px solid var(--ist-border)', color: 'var(--ist-text-muted)' }}>
            <Eraser size={13} strokeWidth={2} /> Cancella
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4" style={{ background: '#0b0d14', minHeight: 220 }}>
          {loading && <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />}
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="touch-none"
            style={{ maxWidth: '100%', maxHeight: '60vh', display: loading ? 'none' : 'block', cursor: 'crosshair', borderRadius: 8 }}
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-3" style={{ borderTop: '1px solid var(--ist-border)' }}>
          <button
            onClick={save} disabled={saving || loading}
            className="px-5 py-2.5 text-white text-sm font-bold rounded-full disabled:opacity-50 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Invia immagine annotata
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-full" style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}
