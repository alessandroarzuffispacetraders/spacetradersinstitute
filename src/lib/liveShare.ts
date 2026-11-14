import { supabase } from './supabase'
import { LiveEvent, LiveAudience } from './live'
import { notifyBroadcast } from './push'

// ─── Immagine da condividere sui social ───────────────────────────────────────
// Composta nel browser (canvas): copertina scura della live + data, ora,
// titolo e conduttore. Lo storage di Supabase manda gli header CORS, quindi il
// canvas resta esportabile.

export type ShareFormat = 'post' | 'story' | 'wide'
export const SHARE_FORMATS: { id: ShareFormat; label: string; hint: string; w: number; h: number }[] = [
  { id: 'post', label: 'Post', hint: '1:1 · Instagram, LinkedIn', w: 1080, h: 1080 },
  { id: 'story', label: 'Storia', hint: '9:16 · Storie, WhatsApp', w: 1080, h: 1920 },
  { id: 'wide', label: 'Orizzontale', hint: '16:9 · YouTube, X, Telegram', w: 1920, h: 1080 },
]

const FONT = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('immagine non caricata'))
    img.src = url
  })
}

// Disegna l'immagine a riempimento (come object-fit: cover) con il punto
// focale fx/fy (0..1): le copertine hanno il soggetto a destra.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, fx = 0.62, fy = 0.45) {
  const s = Math.max(w / img.width, h / img.height)
  const sw = w / s, sh = h / s
  const sx = Math.min(Math.max(img.width * fx - sw / 2, 0), img.width - sw)
  const sy = Math.min(Math.max(img.height * fy - sh / 2, 0), img.height - sh)
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let line = ''
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t
  }
  if (line) lines.push(line)
  return lines
}

export function shareDateLabel(e: LiveEvent): { day: string; time: string } {
  if (!e.startsAt) return { day: e.status === 'replay' ? 'Replay' : 'Data da definire', time: '' }
  const d = new Date(e.startsAt)
  const day = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return { day: day.charAt(0).toUpperCase() + day.slice(1), time }
}

export async function composeShareImage(e: LiveEvent, format: ShareFormat): Promise<Blob> {
  const f = SHARE_FORMATS.find(x => x.id === format)!
  const { w: W, h: H } = f
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  try { await document.fonts?.ready } catch { /* ignore */ }

  ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H)
  const img = e.coverUrl ? await loadImage(e.coverUrl).catch(() => null) : null

  // Zona immagine + velo per il testo
  const story = format === 'story'
  let textLeft: number, textW: number, topLimit: number
  if (format === 'wide') {
    if (img) drawCover(ctx, img, 0, 0, W, H, 0.6)
    const g = ctx.createLinearGradient(0, 0, W * 0.75, 0)
    g.addColorStop(0, 'rgba(5,7,13,0.96)'); g.addColorStop(0.55, 'rgba(5,7,13,0.7)'); g.addColorStop(1, 'rgba(5,7,13,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    textLeft = 110; textW = W * 0.5; topLimit = H * 0.12
  } else if (format === 'post') {
    if (img) drawCover(ctx, img, 0, 0, W, H * 0.78, 0.66, 0.42)
    const g = ctx.createLinearGradient(0, H * 0.25, 0, H)
    g.addColorStop(0, 'rgba(5,7,13,0)'); g.addColorStop(0.42, 'rgba(5,7,13,0.86)'); g.addColorStop(1, 'rgba(5,7,13,1)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    textLeft = 80; textW = W - 160; topLimit = H * 0.36
  } else {
    if (img) drawCover(ctx, img, 0, 0, W, H * 0.6, 0.66, 0.45)
    const g = ctx.createLinearGradient(0, H * 0.25, 0, H * 0.66)
    g.addColorStop(0, 'rgba(5,7,13,0)'); g.addColorStop(1, 'rgba(5,7,13,1)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    textLeft = 90; textW = W - 180; topLimit = H * 0.5
  }

  const isReplay = e.status === 'replay'
  const tag = isReplay ? 'REPLAY' : 'LIVE'
  const tagSize = story ? 34 : 28, tagH = tagSize * 1.7
  const dateSize = story ? 44 : 36
  const hostSize = story ? 40 : 32
  const brandSize = story ? 30 : 24
  const brandY = H - (story ? 110 : 70)
  const bottomLimit = brandY - (story ? 100 : 76)
  const { day, time } = shareDateLabel(e)

  // Blocco di testo: il titolo più grande che ci sta (righe e altezza)
  const maxLines = format === 'wide' ? 3 : 4
  const blockH = (size: number, n: number) => tagH + dateSize * 1.7 + size * 0.35 + n * size * 1.06 + (e.host ? hostSize * 1.9 : 0)
  let tSize = story ? 104 : format === 'post' ? 84 : 80, lines: string[] = []
  for (; tSize >= 40; tSize -= 4) {
    ctx.font = `800 ${tSize}px ${FONT}`; lines = wrap(ctx, e.title, textW)
    if (lines.length <= maxLines && blockH(tSize, lines.length) <= bottomLimit - topLimit) break
  }
  if (lines.length > maxLines) lines = lines.slice(0, maxLines)
  const h = blockH(tSize, lines.length)
  const top = format === 'wide' ? Math.max(topLimit, (topLimit + bottomLimit - h) / 2) : Math.max(topLimit, bottomLimit - h)

  // Etichetta LIVE / REPLAY
  ctx.font = `800 ${tagSize}px ${FONT}`
  const tw = ctx.measureText(tag).width + tagSize * 1.6
  ctx.fillStyle = isReplay ? '#2F7DFF' : '#E5484D'
  ctx.beginPath(); ctx.roundRect(textLeft, top, tw, tagH, 12); ctx.fill()
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'
  ctx.fillText(tag, textLeft + tagSize * 0.8, top + tagH / 2 + 1)

  // Data e ora
  ctx.font = `700 ${dateSize}px ${FONT}`; ctx.fillStyle = '#7CBBD0'; ctx.textBaseline = 'alphabetic'
  let y = top + tagH + dateSize * 1.7
  ctx.fillText(time ? `${day} · ${time}` : day, textLeft, y)

  // Titolo
  ctx.font = `800 ${tSize}px ${FONT}`; ctx.fillStyle = '#ffffff'
  y += tSize * 0.35
  for (const line of lines) { y += tSize * 1.06; ctx.fillText(line, textLeft, y) }

  // Conduttore
  if (e.host) {
    ctx.font = `500 ${hostSize}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.72)'
    y += hostSize * 1.9; ctx.fillText(`con ${e.host}`, textLeft, y)
  }

  // Firma
  ctx.font = `800 ${brandSize}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText('SPACE TRADERS INSTITUTE', textLeft, brandY)
  ctx.font = `500 ${brandSize * 0.8}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText(isReplay ? "Guarda il replay nell'app IST" : "Entra dalla sezione Live dell'app IST", textLeft, brandY + brandSize * 1.5)

  return await new Promise<Blob>((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('export'))), 'image/png'))
}

function fileName(e: LiveEvent, format: ShareFormat) {
  const slug = e.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40)
  return `ist-live-${slug || 'evento'}-${format}.png`
}

// Su telefono apre la condivisione di sistema (Instagram, WhatsApp…) se il
// browser la supporta con i file; altrimenti scarica il file.
export async function saveShareImage(e: LiveEvent, format: ShareFormat, preferShare = false): Promise<'shared' | 'downloaded'> {
  const blob = await composeShareImage(e, format)
  const name = fileName(e, format)
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
  if (preferShare && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: e.title }); return 'shared' } catch { /* annullato: scarica */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}

// ─── Broadcast in chat privata + annuncio ─────────────────────────────────────

export const AUDIENCE_LABEL: Record<LiveAudience, string> = {
  all: 'tutti gli studenti',
  full: 'gli studenti abbonati',
  free: 'gli utenti gratuiti',
}

// Quanti studenti attivi riceveranno il messaggio (stessa regola della RPC).
export async function countAudience(audience: LiveAudience): Promise<number | null> {
  let q = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'active')
  if (audience === 'free') q = q.eq('tier', 'free')
  if (audience === 'full') q = q.or('tier.is.null,tier.neq.free')
  const { count, error } = await q
  return error ? null : count ?? 0
}

export function defaultInviteMessage(e: LiveEvent): string {
  const { day, time } = shareDateLabel(e)
  if (e.status === 'replay') return `È disponibile il replay di «${e.title}». Lo trovi qui sotto 👇`
  return `Ciao! ${day}${time ? ` alle ${time}` : ''} ci vediamo in live: «${e.title}». Tocca la scheda qui sotto per entrare 👇`
}

export async function broadcastLiveInvite(liveId: string, message: string): Promise<{ ok: boolean; sent: number; error?: string }> {
  const { data, error } = await supabase.rpc('broadcast_live_invite', { p_live_id: liveId, p_message: message })
  if (error) {
    const missing = /broadcast_live_invite|PGRST202|42883/.test(`${error.code} ${error.message}`)
    return { ok: false, sent: 0, error: missing ? "Manca l'aggiornamento del database (phase_live_share.sql)." : error.message }
  }
  return { ok: true, sent: Number(data) || 0 }
}

export async function notifyLiveBroadcast(e: LiveEvent, message: string) {
  const title = e.status === 'replay' ? `🎬 Replay: ${e.title}` : `📅 Live: ${e.title}`
  return notifyBroadcast(title, message.trim().slice(0, 160), `/student/live/${e.id}`, e.audience)
}

export async function bachecaChannels(): Promise<{ id: string; name: string; free?: boolean }[]> {
  const { data } = await supabase.from('channels').select('id, name, free, position').eq('type', 'bacheca').order('position')
  return ((data ?? []) as { id: string; name: string; free?: boolean }[])
}
