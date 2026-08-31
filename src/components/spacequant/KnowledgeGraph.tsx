import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import type { GraphNode, GraphEdge } from '../../lib/spacequant'

// Monocromatico, in linea coi token dell'app (niente colore per cartella:
// richiesta esplicita, il grafo deve restare "leggero" come in Obsidian).
const INK = {
  dark:  { dot: '255,255,255', line: 'rgba(255,255,255,0.055)', lineHover: 'rgba(255,255,255,0.4)', ring: '#ffffff' },
  light: { dot: '15,25,35',    line: 'rgba(15,25,35,0.07)',     lineHover: 'rgba(15,25,35,0.4)',    ring: '#0b0b0b' },
}

function nodeRadius(grado: number): number {
  return 1.5 + Math.sqrt(grado) * 1.1
}

interface SimNode extends GraphNode {
  x: number; y: number
  vx: number; vy: number
  fx: number | null; fy: number | null // posizione fissa mentre l'utente trascina
}

interface View { scale: number; tx: number; ty: number }

const REPULSIONE = 1200
const MOLLA = 0.02
const RIPOSO = 90
const GRAVITA = 0.002
const ATTRITO = 0.85
const QUIETE_ENERGIA = 0.02
const QUIETE_FRAME = 180 // ~3s a 60fps

interface Props {
  nodi: GraphNode[]
  archi: GraphEdge[]
  onNodeClick: (titolo: string) => void
}

export default function KnowledgeGraph({ nodi, archi, onNodeClick }: Props) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const simRef = useRef<SimNode[]>([])
  const edgesIdxRef = useRef<[number, number][]>([])
  const neighborsRef = useRef<Map<string, Set<string>>>(new Map())
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 })
  const hoveredRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const quietFramesRef = useRef(0)

  // Drag/pan state (mutabile, non serve un re-render ad ogni pixel)
  const dragRef = useRef<{ mode: 'node' | 'pan' | 'pinch'; nodeId?: string; lastX: number; lastY: number; moved: boolean; pinchDist?: number } | null>(null)

  // ── Passo di simulazione (repulsione + molle + gravità + attrito) ────────
  const step = useCallback(() => {
    const nodes = simRef.current
    for (const n of nodes) { (n as any).fx_force = 0; (n as any).fy_force = 0 }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const d2 = dx * dx + dy * dy || 0.01
        const f = REPULSIONE / d2
        const d = Math.sqrt(d2)
        ;(a as any).fx_force -= (f * dx) / d; (a as any).fy_force -= (f * dy) / d
        ;(b as any).fx_force += (f * dx) / d; (b as any).fy_force += (f * dy) / d
      }
    }

    for (const [i, j] of edgesIdxRef.current) {
      const a = nodes[i], b = nodes[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 0.01
      const f = MOLLA * (d - RIPOSO)
      ;(a as any).fx_force += (f * dx) / d; (a as any).fy_force += (f * dy) / d
      ;(b as any).fx_force -= (f * dx) / d; (b as any).fy_force -= (f * dy) / d
    }

    let energia = 0
    for (const n of nodes) {
      ;(n as any).fx_force += -n.x * GRAVITA
      ;(n as any).fy_force += -n.y * GRAVITA
      if (n.fx !== null && n.fy !== null) { n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0; continue }
      n.vx = (n.vx + (n as any).fx_force) * ATTRITO
      n.vy = (n.vy + (n as any).fy_force) * ATTRITO
      n.x += n.vx; n.y += n.vy
      energia += n.vx * n.vx + n.vy * n.vy
    }
    return energia
  }, [])

  // ── Disegno ────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const { w, h } = size
    const view = viewRef.current
    const hovered = hoveredRef.current
    const activeNeighbors = hovered ? neighborsRef.current.get(hovered) : null
    const ink = INK[theme]

    ctx.clearRect(0, 0, w, h)

    const toScreen = (x: number, y: number) => [x * view.scale + view.tx, y * view.scale + view.ty]

    // Archi — bassissima opacità di base (come in Obsidian: quasi invisibili
    // finché non tocchi un nodo), si accendono solo per il nodo in hover.
    for (const [i, j] of edgesIdxRef.current) {
      const a = simRef.current[i], b = simRef.current[j]
      if (!a || !b) continue
      const touchesHover = hovered && (a.id === hovered || b.id === hovered)
      const [ax, ay] = toScreen(a.x, a.y)
      const [bx, by] = toScreen(b.x, b.y)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.strokeStyle = touchesHover ? ink.lineHover : ink.line
      ctx.lineWidth = touchesHover ? 1 : 0.6
      ctx.stroke()
    }

    // Nodi — piccoli e monocromatici, più opachi quanto più sono connessi.
    const zoomedIn = view.scale > 1.6
    for (const n of simRef.current) {
      const isHovered = n.id === hovered
      const isNeighbor = !!activeNeighbors?.has(n.id)
      const dim = hovered && !isHovered && !isNeighbor
      const [x, y] = toScreen(n.x, n.y)
      const r = nodeRadius(n.grado) * Math.min(1.4, Math.max(0.7, view.scale))
      const baseAlpha = Math.min(1, 0.32 + Math.sqrt(n.grado) * 0.1)

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${ink.dot},${dim ? baseAlpha * 0.25 : baseAlpha})`
      ctx.fill()
      if (isHovered) {
        ctx.lineWidth = 1.5
        ctx.strokeStyle = ink.ring
        ctx.stroke()
      }

      // Etichette: sempre sui nodi ad alto grado, tutte quando si è ingranditi.
      if (isHovered || zoomedIn || n.grado >= 10) {
        ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif'
        ctx.fillStyle = `rgba(${ink.dot},${dim ? 0.25 : 0.85})`
        ctx.fillText(n.id, x + r + 4, y + 4)
      }
    }
  }, [size, theme])

  const loop = useCallback(() => {
    const energia = step()
    draw()
    if (energia < QUIETE_ENERGIA) {
      quietFramesRef.current++
      if (quietFramesRef.current > QUIETE_FRAME) { rafRef.current = null; return } // ferma il loop: niente rAF perpetuo
    } else {
      quietFramesRef.current = 0
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [step, draw])

  // IMPORTANTE: deve dipendere da `loop` (che a sua volta dipende da `draw`,
  // che dipende da size/theme). Con deps vuote questa funzione resta legata
  // per sempre al primissimo `draw` (creato quando size era ancora {w:0,h:0}):
  // clearRect(0,0,0,0) non pulisce nulla → i nodi trascinati lasciavano una
  // scia, perché ogni riavvio del loop durante il drag ridisegnava sopra il
  // frame precedente senza mai cancellarlo.
  const startLoop = useCallback(() => {
    quietFramesRef.current = 0
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(loop)
  }, [loop])

  // ── Inizializza la simulazione quando cambiano i dati ─────────────────────
  useEffect(() => {
    const n = nodi.length
    const raggioIniziale = Math.max(120, Math.sqrt(n) * 40)
    simRef.current = nodi.map((node, i) => {
      const angolo = (i / Math.max(1, n)) * Math.PI * 2
      return {
        ...node,
        x: Math.cos(angolo) * raggioIniziale,
        y: Math.sin(angolo) * raggioIniziale,
        vx: 0, vy: 0, fx: null, fy: null,
      }
    })
    const indexById = new Map(nodi.map((n, i) => [n.id, i]))
    edgesIdxRef.current = archi
      .map(e => [indexById.get(e.da), indexById.get(e.a)] as [number | undefined, number | undefined])
      .filter((pair): pair is [number, number] => pair[0] !== undefined && pair[1] !== undefined)

    const neighbors = new Map<string, Set<string>>()
    for (const e of archi) {
      if (!neighbors.has(e.da)) neighbors.set(e.da, new Set())
      if (!neighbors.has(e.a)) neighbors.set(e.a, new Set())
      neighbors.get(e.da)!.add(e.a)
      neighbors.get(e.a)!.add(e.da)
    }
    neighborsRef.current = neighbors

    quietFramesRef.current = 0
    startLoop()
  }, [nodi, archi, startLoop])

  // ── Ridimensionamento del canvas (ResizeObserver + devicePixelRatio) ──────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
      if (viewRef.current.tx === 0 && viewRef.current.ty === 0) {
        viewRef.current = { scale: 1, tx: width / 2, ty: height / 2 }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    canvas.style.width = `${size.w}px`
    canvas.style.height = `${size.h}px`
    const ctx = canvas.getContext('2d')
    ctx?.scale(dpr, dpr)
    draw() // ridisegna subito col nuovo canvas: la simulazione potrebbe essere ferma
  }, [size, draw])

  useEffect(() => {
    draw() // ridisegna subito su cambio tema anche a simulazione ferma
  }, [draw])

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }, [])

  // ── Hit-test: nodo più vicino al punto (coordinate CSS del canvas) ────────
  const hitTest = useCallback((clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const px = clientX - rect.left, py = clientY - rect.top
    const view = viewRef.current
    const simX = (px - view.tx) / view.scale
    const simY = (py - view.ty) / view.scale
    let best: SimNode | null = null
    let bestD = Infinity
    for (const n of simRef.current) {
      const r = nodeRadius(n.grado) + 6 / view.scale // margine di tolleranza al tocco
      const d = Math.hypot(n.x - simX, n.y - simY)
      if (d <= r && d < bestD) { best = n; bestD = d }
    }
    return best
  }, [])

  // ── Interazione mouse ──────────────────────────────────────────────────────
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current?.mode === 'node') {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const view = viewRef.current
      const simX = (e.clientX - rect.left - view.tx) / view.scale
      const simY = (e.clientY - rect.top - view.ty) / view.scale
      const node = simRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node) { node.fx = simX; node.fy = simY }
      dragRef.current.moved = true
      startLoop()
      return
    }
    if (dragRef.current?.mode === 'pan') {
      const dx = e.clientX - dragRef.current.lastX, dy = e.clientY - dragRef.current.lastY
      viewRef.current = { ...viewRef.current, tx: viewRef.current.tx + dx, ty: viewRef.current.ty + dy }
      dragRef.current.lastX = e.clientX; dragRef.current.lastY = e.clientY
      dragRef.current.moved = true
      draw()
      return
    }
    const hit = hitTest(e.clientX, e.clientY)
    const id = hit?.id ?? null
    if (id !== hoveredRef.current) { hoveredRef.current = id; draw() }
  }

  const onMouseDown = (e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY)
    if (hit) {
      hit.fx = hit.x; hit.fy = hit.y
      dragRef.current = { mode: 'node', nodeId: hit.id, lastX: e.clientX, lastY: e.clientY, moved: false }
    } else {
      dragRef.current = { mode: 'pan', lastX: e.clientX, lastY: e.clientY, moved: false }
    }
  }

  const onMouseUp = () => {
    if (dragRef.current?.mode === 'node') {
      const node = simRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node && !dragRef.current.moved) onNodeClick(node.id) // click senza trascinare = domanda
      if (node) { node.fx = null; node.fy = null }
      startLoop()
    }
    dragRef.current = null
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const view = viewRef.current
    const newScale = Math.min(4, Math.max(0.3, view.scale * factor))
    viewRef.current = { ...view, scale: newScale }
    draw()
  }

  // ── Interazione touch (drag + pinch) ──────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]]
      dragRef.current = { mode: 'pinch', lastX: 0, lastY: 0, moved: false, pinchDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) }
      return
    }
    const t = e.touches[0]
    const hit = hitTest(t.clientX, t.clientY)
    if (hit) {
      hit.fx = hit.x; hit.fy = hit.y
      dragRef.current = { mode: 'node', nodeId: hit.id, lastX: t.clientX, lastY: t.clientY, moved: false }
    } else {
      dragRef.current = { mode: 'pan', lastX: t.clientX, lastY: t.clientY, moved: false }
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (dragRef.current?.mode === 'pinch' && e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const ratio = dist / (dragRef.current.pinchDist || dist)
      const view = viewRef.current
      viewRef.current = { ...view, scale: Math.min(4, Math.max(0.3, view.scale * ratio)) }
      dragRef.current.pinchDist = dist
      draw()
      return
    }
    const t = e.touches[0]
    if (!t) return
    if (dragRef.current?.mode === 'node') {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const view = viewRef.current
      const simX = (t.clientX - rect.left - view.tx) / view.scale
      const simY = (t.clientY - rect.top - view.ty) / view.scale
      const node = simRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node) { node.fx = simX; node.fy = simY }
      dragRef.current.moved = true
      startLoop()
    } else if (dragRef.current?.mode === 'pan') {
      const dx = t.clientX - dragRef.current.lastX, dy = t.clientY - dragRef.current.lastY
      viewRef.current = { ...viewRef.current, tx: viewRef.current.tx + dx, ty: viewRef.current.ty + dy }
      dragRef.current.lastX = t.clientX; dragRef.current.lastY = t.clientY
      dragRef.current.moved = true
      draw()
    }
  }

  const onTouchEnd = () => {
    if (dragRef.current?.mode === 'node') {
      const node = simRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node && !dragRef.current.moved) onNodeClick(node.id) // tap senza trascinare = domanda
      if (node) { node.fx = null; node.fy = null }
      startLoop()
    }
    dragRef.current = null
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none"
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
    </div>
  )
}
