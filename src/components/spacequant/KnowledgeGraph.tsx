import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import type { GraphNode, GraphEdge } from '../../lib/spacequant'

// Palette categoriale validata (dataviz skill, references/palette.md) — 8 slot
// fissi, uno per cartella del vault. Il grafo mostra tutte le 8 categorie
// insieme (caso "scatter/pairs all"): alcune coppie non superano da sole i
// controlli di distinguibilità CVD, per questo la legenda resta SEMPRE visibile
// (colore + testo, mai solo colore) e l'hover isola nodo+vicini invece di
// affidarsi alla sola tonalità per riconoscere una categoria.
const FOLDER_ORDER = ['Capire', 'Come fare', 'Concetti', 'Glossario', 'Metriche', 'Pagine', 'Problemi', 'Indice']
const LIGHT_HEX = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const DARK_HEX = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

function folderColor(folder: string, theme: 'light' | 'dark'): string {
  const idx = FOLDER_ORDER.indexOf(folder)
  const arr = theme === 'dark' ? DARK_HEX : LIGHT_HEX
  return idx >= 0 ? arr[idx] : arr[arr.length - 1]
}

function nodeRadius(grado: number): number {
  return 4 + Math.sqrt(grado) * 2
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
  const themeRef = useRef(theme)
  themeRef.current = theme

  // Drag/pan state (mutabile, non serve un re-render ad ogni pixel)
  const dragRef = useRef<{ mode: 'node' | 'pan' | 'pinch'; nodeId?: string; lastX: number; lastY: number; moved: boolean; pinchDist?: number } | null>(null)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodi, archi])

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
  }, [size])

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

    ctx.clearRect(0, 0, w, h)

    const toScreen = (x: number, y: number) => [x * view.scale + view.tx, y * view.scale + view.ty]

    // Archi
    for (const [i, j] of edgesIdxRef.current) {
      const a = simRef.current[i], b = simRef.current[j]
      if (!a || !b) continue
      const dim = hovered && a.id !== hovered && b.id !== hovered
      const [ax, ay] = toScreen(a.x, a.y)
      const [bx, by] = toScreen(b.x, b.y)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.strokeStyle = theme === 'dark'
        ? (dim ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.16)')
        : (dim ? 'rgba(11,11,11,0.05)' : 'rgba(11,11,11,0.14)')
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Nodi
    const zoomedIn = view.scale > 1.6
    for (const n of simRef.current) {
      const isHovered = n.id === hovered
      const isNeighbor = !!activeNeighbors?.has(n.id)
      const dim = hovered && !isHovered && !isNeighbor
      const [x, y] = toScreen(n.x, n.y)
      const r = nodeRadius(n.grado) * Math.min(1.4, Math.max(0.7, view.scale))

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = folderColor(n.cartella, theme)
      ctx.globalAlpha = dim ? 0.25 : 1
      ctx.fill()
      if (isHovered) {
        ctx.lineWidth = 2
        ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#0b0b0b'
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // Etichette: sempre sui nodi ad alto grado, tutte quando si è ingranditi.
      if (isHovered || zoomedIn || n.grado >= 10) {
        ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif'
        ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.92)' : 'rgba(11,11,11,0.88)'
        ctx.globalAlpha = dim ? 0.3 : 1
        ctx.fillText(n.id, x + r + 4, y + 4)
        ctx.globalAlpha = 1
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

  const startLoop = useCallback(() => {
    quietFramesRef.current = 0
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    draw() // ridisegna subito su resize/cambio tema anche a simulazione ferma
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
      {/* Legenda — sempre visibile, colore + testo (mai solo colore): alcune
          coppie della palette non sono distinguibili in isolamento da chi ha
          daltonismo, il testo è la fonte di verità per l'identità categoria. */}
      <div
        className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-x-3 gap-y-1.5 px-3 py-2 rounded-xl text-[11px]"
        style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-border)', color: 'var(--ist-text-dim)' }}
      >
        {FOLDER_ORDER.map(folder => (
          <span key={folder} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: folderColor(folder, theme) }} />
            {folder}
          </span>
        ))}
      </div>
    </div>
  )
}
