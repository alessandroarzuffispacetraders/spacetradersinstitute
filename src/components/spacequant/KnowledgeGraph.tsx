import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import type { GraphNode, GraphEdge } from '../../lib/spacequant'

// Monocromatico, in linea coi token dell'app (niente colore per cartella:
// richiesta esplicita, il grafo deve restare "leggero" come in Obsidian).
const INK = {
  dark:  { dot: '255,255,255', line: 'rgba(255,255,255,0.09)', lineHover: 'rgba(255,255,255,0.4)', ring: '#ffffff' },
  light: { dot: '15,25,35',    line: 'rgba(15,25,35,0.11)',    lineHover: 'rgba(15,25,35,0.4)',    ring: '#0b0b0b' },
}

function nodeRadius(grado: number): number {
  return 1.5 + Math.sqrt(grado) * 1.1
}

interface SimNode extends GraphNode {
  x: number; y: number
}

interface View { scale: number; tx: number; ty: number }

// Layout iniziale: una vera passata fisica (non solo geometrica), calcolata
// TUTTA IN UN COLPO SOLO prima del primo disegno — nessuna animazione
// visibile, i nodi ci sono già assestati fin dal primo frame. È quello che dà
// la forma "meno cerchio perfetto" (i collegamenti reali tirano i nodi
// collegati più vicini, creando rigonfiamenti) invece del disco geometrico
// puro di prima. Costanti già note come stabili per ~150-200 nodi.
const REPULSIONE = 220
const MOLLA = 0.02
const RIPOSO = 40
const GRAVITA = 0.003
const ATTRITO = 0.80
const MAX_VELOCITA = 3 // solo per il precalcolo offline, non per l'animazione a schermo
const LAYOUT_ITERAZIONI = 260

function calcolaLayout(nodi: GraphNode[], archi: GraphEdge[], boundary: number): SimNode[] {
  const n = Math.max(1, nodi.length)
  const angoloAureo = Math.PI * (3 - Math.sqrt(5))
  const raggioDisco = boundary * 0.9
  const nodes: (SimNode & { vx: number; vy: number })[] = nodi.map((node, i) => {
    const r = raggioDisco * Math.sqrt((i + 0.5) / n)
    const angolo = i * angoloAureo
    return { ...node, x: Math.cos(angolo) * r, y: Math.sin(angolo) * r, vx: 0, vy: 0 }
  })
  const indexById = new Map(nodi.map((n, i) => [n.id, i]))
  const edgesIdx = archi
    .map(e => [indexById.get(e.da), indexById.get(e.a)] as [number | undefined, number | undefined])
    .filter((p): p is [number, number] => p[0] !== undefined && p[1] !== undefined)

  const fx = new Float64Array(nodes.length)
  const fy = new Float64Array(nodes.length)

  for (let iter = 0; iter < LAYOUT_ITERAZIONI; iter++) {
    fx.fill(0); fy.fill(0)

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const d2 = dx * dx + dy * dy || 0.01
        const f = REPULSIONE / d2
        const d = Math.sqrt(d2)
        fx[i] -= (f * dx) / d; fy[i] -= (f * dy) / d
        fx[j] += (f * dx) / d; fy[j] += (f * dy) / d
      }
    }

    for (const [i, j] of edgesIdx) {
      const a = nodes[i], b = nodes[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 0.01
      const f = MOLLA * (d - RIPOSO)
      fx[i] += (f * dx) / d; fy[i] += (f * dy) / d
      fx[j] -= (f * dx) / d; fy[j] -= (f * dy) / d
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      let fxi = fx[i] - n.x * GRAVITA
      let fyi = fy[i] - n.y * GRAVITA
      const dist = Math.hypot(n.x, n.y)
      if (dist > boundary) {
        const richiamo = (dist - boundary) * 0.05
        fxi -= (n.x / dist) * richiamo
        fyi -= (n.y / dist) * richiamo
      }
      n.vx = (n.vx + fxi) * ATTRITO
      n.vy = (n.vy + fyi) * ATTRITO
      const v = Math.hypot(n.vx, n.vy)
      if (v > MAX_VELOCITA) { n.vx = (n.vx / v) * MAX_VELOCITA; n.vy = (n.vy / v) * MAX_VELOCITA }
      if (!Number.isFinite(n.vx) || !Number.isFinite(n.vy)) { n.vx = 0; n.vy = 0 }
      n.x += n.vx; n.y += n.vy
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) { n.x = 0; n.y = 0 }
    }
  }

  return nodes.map((n): SimNode => ({ id: n.id, cartella: n.cartella, grado: n.grado, x: n.x, y: n.y }))
}

// ── Animazione "a tocco": leggerissima, sempre a durata fissa e mai a catena ──
// Ogni tanto un nodo scelto a caso si sposta di poco e RESTA lì (nessun
// ritorno alla posizione di partenza): chi gli sta vicino sullo SCHERMO (non
// chi è collegato nel grafo — è un effetto di spostamento fisico, come un
// girino che sposta l'acqua attorno a sé) viene trascinato in proporzione
// alla distanza, con una piccola variazione individuale di angolo/ampiezza
// così l'effetto non sembri meccanico. Durata fissa (nessuna soglia di
// energia): evita la classe di bug già vista (un loop continuo che può
// restare agganciato a una versione vecchia del disegno). Tocca solo i nodi
// entro un raggio limitato, mai tutti e 160.
const RIPPLE_DURATA_MS = 1400
const RIPPLE_RAGGIO = 75 // distanza sullo schermo entro cui si sente lo spostamento

function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3) }

// Sposta di (dx,dy) i nodi entro RIPPLE_RAGGIO da (originX,originY), con
// un'attenuazione che decresce dolcemente con la distanza — è la "spinta"
// che uno spostamento (automatico o un trascinamento manuale) esercita sui
// nodi spazialmente vicini, indipendentemente da eventuali collegamenti nel
// grafo. Usata sia dal "tocco" automatico sia dal trascinamento, così i due
// si comportano allo stesso identico modo.
function applicaSpostamentoVicini(nodes: SimNode[], originX: number, originY: number, dx: number, dy: number, escludi: SimNode) {
  if (dx === 0 && dy === 0) return
  for (const n of nodes) {
    if (n === escludi) continue
    const d = Math.hypot(n.x - originX, n.y - originY)
    if (d > RIPPLE_RAGGIO) continue
    const falloff = Math.pow(1 - d / RIPPLE_RAGGIO, 1.5)
    n.x += dx * falloff
    n.y += dy * falloff
  }
}

interface RippleState { node: SimNode; ox: number; oy: number; tx: number; ty: number; start: number }

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
  const sizeRef = useRef(size)
  sizeRef.current = size

  const simRef = useRef<SimNode[]>([])
  const edgesIdxRef = useRef<[number, number][]>([])
  const neighborsRef = useRef<Map<string, Set<string>>>(new Map())
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 })
  const hoveredRef = useRef<string | null>(null)
  const boundaryRef = useRef(260)
  const rippleRef = useRef<RippleState | null>(null)
  const rippleTimerRef = useRef<number | null>(null)

  const dragRef = useRef<{ mode: 'node' | 'pan' | 'pinch'; nodeId?: string; lastX: number; lastY: number; moved: boolean; pinchDist?: number } | null>(null)

  // ── Disegno — dipende SOLO dal tema: la dimensione si legge da un ref, mai
  // da una chiusura che può restare agganciata a una misura superata. ────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const { w, h } = sizeRef.current
    const view = viewRef.current
    const hovered = hoveredRef.current
    const activeNeighbors = hovered ? neighborsRef.current.get(hovered) : null
    const ink = INK[theme]

    ctx.clearRect(0, 0, w, h)

    const toScreen = (x: number, y: number) => [x * view.scale + view.tx, y * view.scale + view.ty]

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

    const zoomedIn = view.scale > 1.6
    for (const n of simRef.current) {
      const isHovered = n.id === hovered
      const isNeighbor = !!activeNeighbors?.has(n.id)
      const dim = hovered && !isHovered && !isNeighbor
      const [x, y] = toScreen(n.x, n.y)
      // Il raggio segue lo zoom molto debolmente (mai proporzionale 1:1 come
      // prima): i pallini devono restare piccoli sia molto de-zoommati sia
      // molto ingranditi, non gonfiarsi o rimpicciolirsi con lo zoom.
      const r = nodeRadius(n.grado) * Math.min(1.15, Math.max(0.45, 0.5 + view.scale * 0.4))
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

      if (isHovered || zoomedIn || n.grado >= 10) {
        ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif'
        ctx.fillStyle = `rgba(${ink.dot},${dim ? 0.25 : 0.85})`
        ctx.fillText(n.id, x + r + 4, y + 4)
      }
    }
  }, [theme])

  // drawRef: usato dal ciclo del "tocco" così l'animazione chiama sempre la
  // versione più fresca di draw, mai una chiusura catturata all'avvio.
  const drawRef = useRef(draw)
  drawRef.current = draw

  // ── Ciclo del "tocco": il nodo scelto avanza (con decelerazione) verso una
  // meta vicina; ad ogni fotogramma lo spostamento INCREMENTALE di quel
  // passo si propaga ai nodi spazialmente vicini — lo stesso identico
  // meccanismo usato per il trascinamento manuale (vedi applicaSpostamento-
  // Vicini più sotto), quindi il "tocco" automatico e il trascinamento
  // dell'utente si comportano allo stesso modo, come richiesto. Alla fine
  // dell'animazione tutto resta esattamente dov'è arrivato: nessun ritorno.
  const rippleTick = useCallback(() => {
    const r = rippleRef.current
    if (!r) return
    const t = Math.min(1, (performance.now() - r.start) / RIPPLE_DURATA_MS)
    const k = easeOutCubic(t)
    const targetX = r.ox + (r.tx - r.ox) * k
    const targetY = r.oy + (r.ty - r.oy) * k
    const dx = targetX - r.node.x, dy = targetY - r.node.y
    applicaSpostamentoVicini(simRef.current, r.node.x, r.node.y, dx, dy, r.node)
    r.node.x = targetX
    r.node.y = targetY
    drawRef.current()
    if (t < 1) {
      requestAnimationFrame(rippleTick)
    } else {
      rippleRef.current = null
    }
  }, [])

  const startRipple = useCallback(() => {
    const nodes = simRef.current
    if (nodes.length < 2 || rippleRef.current) return
    const origin = nodes[Math.floor(Math.random() * nodes.length)]

    const angolo = Math.random() * Math.PI * 2
    const ampiezza = 10 + Math.random() * 14 // spostamento piccolo ma permanente
    let tx = origin.x + Math.cos(angolo) * ampiezza
    let ty = origin.y + Math.sin(angolo) * ampiezza
    // Resta entro il cerchio di contenimento, altrimenti nel tempo (molti
    // "tocchi" permanenti) il layout potrebbe derivare fuori dall'area visibile.
    const distCentro = Math.hypot(tx, ty)
    if (distCentro > boundaryRef.current) {
      const scale = boundaryRef.current / distCentro
      tx *= scale; ty *= scale
    }

    rippleRef.current = { node: origin, ox: origin.x, oy: origin.y, tx, ty, start: performance.now() }
    requestAnimationFrame(rippleTick)
  }, [rippleTick])

  // Programma il prossimo "tocco" a un intervallo casuale — mai un ritmo
  // meccanico, mai più di un'animazione alla volta.
  useEffect(() => {
    const programma = () => {
      const attesa = 2200 + Math.random() * 3800
      rippleTimerRef.current = window.setTimeout(() => { startRipple(); programma() }, attesa)
    }
    programma()
    return () => { if (rippleTimerRef.current !== null) clearTimeout(rippleTimerRef.current) }
  }, [startRipple])

  // ── Calcola il layout (fisica una tantum, non un'animazione) quando i dati
  // cambiano, poi disegna il risultato già assestato. ───────────────────────
  useEffect(() => {
    rippleRef.current = null // un cambio dati interrompe un eventuale tocco in corso
    simRef.current = calcolaLayout(nodi, archi, boundaryRef.current)

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

    draw()
  }, [nodi, archi, draw])

  // ── Ridimensionamento del canvas (ResizeObserver + devicePixelRatio) ──────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
      if (Math.min(width, height) > 40) boundaryRef.current = Math.min(width, height) * 0.4
      if (viewRef.current.tx === 0 && viewRef.current.ty === 0) {
        viewRef.current = { scale: 1.7, tx: width / 2, ty: height / 2 } // zoom di default più ravvicinato
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
    draw()
  }, [size, draw])

  useEffect(() => { draw() }, [draw])

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
      const r = nodeRadius(n.grado) + 6 / view.scale
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
      const node = simRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node) {
        const nuovaX = (e.clientX - rect.left - view.tx) / view.scale
        const nuovaY = (e.clientY - rect.top - view.ty) / view.scale
        // Trascinare un nodo spinge quelli spazialmente vicini, come lo
        // spostamento automatico "a tocco" — stesso identico meccanismo.
        applicaSpostamentoVicini(simRef.current, node.x, node.y, nuovaX - node.x, nuovaY - node.y, node)
        node.x = nuovaX; node.y = nuovaY
      }
      dragRef.current.moved = true
      draw()
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
      rippleRef.current = null // non far competere il tocco con il trascinamento manuale
      dragRef.current = { mode: 'node', nodeId: hit.id, lastX: e.clientX, lastY: e.clientY, moved: false }
    } else {
      dragRef.current = { mode: 'pan', lastX: e.clientX, lastY: e.clientY, moved: false }
    }
  }

  const onMouseUp = () => {
    if (dragRef.current?.mode === 'node' && !dragRef.current.moved) {
      onNodeClick(dragRef.current.nodeId!) // click senza trascinare = domanda
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
      rippleRef.current = null
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
      const node = simRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node) {
        const nuovaX = (t.clientX - rect.left - view.tx) / view.scale
        const nuovaY = (t.clientY - rect.top - view.ty) / view.scale
        applicaSpostamentoVicini(simRef.current, node.x, node.y, nuovaX - node.x, nuovaY - node.y, node)
        node.x = nuovaX; node.y = nuovaY
      }
      dragRef.current.moved = true
      draw()
    } else if (dragRef.current?.mode === 'pan') {
      const dx = t.clientX - dragRef.current.lastX, dy = t.clientY - dragRef.current.lastY
      viewRef.current = { ...viewRef.current, tx: viewRef.current.tx + dx, ty: viewRef.current.ty + dy }
      dragRef.current.lastX = t.clientX; dragRef.current.lastY = t.clientY
      dragRef.current.moved = true
      draw()
    }
  }

  const onTouchEnd = () => {
    if (dragRef.current?.mode === 'node' && !dragRef.current.moved) {
      onNodeClick(dragRef.current.nodeId!) // tap senza trascinare = domanda
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
