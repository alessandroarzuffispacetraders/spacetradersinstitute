// Parse whatever an admin pastes (full URL, player URL, or bare id) into a
// Vimeo id (+ optional privacy hash for unlisted videos), and build the embed
// src for the iframe player.

export interface VimeoRef { id: string; hash?: string }

// Tollerante: accetta id nudo, URL vimeo.com/<id>[/<hash>], player URL con ?h=,
// il link "share" con parametri, e anche il codice <iframe> dell'embed incollato
// per intero (estrae id + hash di privacy da qualunque stringa lo contenga).
export function parseVimeo(input: string | null | undefined): VimeoRef | null {
  if (!input) return null
  const s = input.trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return { id: s }

  // ID: da player.vimeo.com/video/<id> oppure vimeo.com/<id> (anche dentro un iframe).
  const idMatch = s.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i)
  if (!idMatch) return null
  const id = idMatch[1]

  // Hash di privacy: da ?h=<hash> oppure dal path /<id>/<hash>.
  let hash: string | undefined
  const hParam = s.match(/[?&]h=([0-9a-zA-Z]+)/i)
  if (hParam) {
    hash = hParam[1]
  } else {
    const pathHash = s.match(new RegExp(`vimeo\\.com\\/(?:video\\/)?${id}\\/([0-9a-zA-Z]+)`, 'i'))
    if (pathHash) hash = pathHash[1]
  }
  return { id, hash }
}

function videoUrlOf(ref: VimeoRef): string {
  return ref.hash ? `https://vimeo.com/${ref.id}/${ref.hash}` : `https://vimeo.com/${ref.id}`
}

// Durata via oEmbed pubblico: veloce, ma FALLISCE per i video con privacy
// ristretta (unlisted "hide from Vimeo", embed per dominio, ecc.).
async function durationViaOembed(url: string): Promise<number | null> {
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const data = await res.json()
    const secs = Number((data as { duration?: unknown }).duration)
    return Number.isFinite(secs) && secs > 0 ? Math.round(secs) : null
  } catch {
    return null
  }
}

// Durata via SDK @vimeo/player: carica un player NASCOSTO e legge getDuration().
// Funziona per QUALSIASI video embeddabile (cioè esattamente quelli che l'app
// riproduce), anche quando l'oEmbed è bloccato dalla privacy. Import dinamico
// così l'SDK si carica solo quando serve il rilevamento.
async function durationViaSDK(url: string): Promise<number | null> {
  try {
    const { default: Player } = await import('@vimeo/player')
    return await new Promise<number | null>(resolve => {
      const holder = document.createElement('div')
      holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:180px;opacity:0;pointer-events:none'
      document.body.appendChild(holder)
      const player = new Player(holder, { url: url as `https://vimeo.com/${string}` })
      let done = false
      const finish = (v: number | null) => {
        if (done) return
        done = true
        clearTimeout(timer)
        player.destroy().catch(() => {})
        holder.remove()
        resolve(v)
      }
      const timer = setTimeout(() => finish(null), 9000)
      player.getDuration()
        .then(d => finish(Number.isFinite(d) && d > 0 ? Math.round(d) : null))
        .catch(() => finish(null))
    })
  } catch {
    return null
  }
}

// Legge la DURATA del video (in secondi) così l'admin non deve inserirla a mano.
// Prima prova l'oEmbed (veloce); se fallisce (video a privacy ristretta) ripiega
// sull'SDK, che funziona per ogni video embeddabile. Ritorna null solo se davvero
// non recuperabile → in quel caso resta l'inserimento manuale.
export async function fetchVimeoDuration(input: string): Promise<number | null> {
  const ref = parseVimeo(input)
  if (!ref) return null
  const url = videoUrlOf(ref)
  return (await durationViaOembed(url)) ?? (await durationViaSDK(url))
}

export function vimeoEmbedSrc(input: string, opts?: { autoplay?: boolean }): string | null {
  const ref = parseVimeo(input)
  if (!ref) return null
  const params = new URLSearchParams()
  if (ref.hash) params.set('h', ref.hash)
  // Clean chrome + privacy-friendly defaults.
  params.set('title', '0')
  params.set('byline', '0')
  params.set('portrait', '0')
  params.set('dnt', '1')
  if (opts?.autoplay) params.set('autoplay', '1')
  return `https://player.vimeo.com/video/${ref.id}?${params.toString()}`
}

// ─── Miniature (copertine stile "catalogo") ─────────────────────────────────────
// L'oEmbed pubblico restituisce thumbnail_url. Cache in memoria + localStorage
// (7 giorni se trovata, 1 giorno se assente) e coda con max 4 richieste in
// parallelo: una pagina con 40 lezioni non spara 40 fetch insieme e le visite
// successive sono istantanee. Se Vimeo la nega (privacy per dominio, app
// nativa fuori dominio) → null, e la UI ripiega su copertina categoria /
// copertina generata dal colore.

const THUMB_LS_KEY = 'ist-vthumb-v1'
const THUMB_HIT_TTL = 7 * 24 * 3600_000
const THUMB_MISS_TTL = 24 * 3600_000
const THUMB_MAX_PARALLEL = 4

type ThumbEntry = { u: string | null; t: number }
let thumbStore: Record<string, ThumbEntry> | null = null
const thumbInflight = new Map<string, Promise<string | null>>()
let thumbActive = 0
const thumbQueue: Array<() => void> = []

function getThumbStore(): Record<string, ThumbEntry> {
  if (!thumbStore) {
    try { thumbStore = JSON.parse(localStorage.getItem(THUMB_LS_KEY) || '{}') as Record<string, ThumbEntry> }
    catch { thumbStore = {} }
  }
  return thumbStore
}

function persistThumbStore() {
  try { localStorage.setItem(THUMB_LS_KEY, JSON.stringify(thumbStore ?? {})) } catch { /* storage pieno/bloccato */ }
}

function thumbKey(ref: VimeoRef): string {
  return ref.hash ? `${ref.id}:${ref.hash}` : ref.id
}

// Le miniature Vimeo hanno la misura nel nome ("…-d_295x166"): la sostituiamo
// per avere la risoluzione giusta (card piccola vs banner grande).
function sizedThumb(url: string, width: number): string {
  const height = Math.round((width * 9) / 16)
  return url.replace(/_\d+x\d+(?=[^/]*$)/, `_${width}x${height}`)
}

function runThumbJob<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      thumbActive++
      job().then(resolve, reject).finally(() => {
        thumbActive--
        thumbQueue.shift()?.()
      })
    }
    if (thumbActive < THUMB_MAX_PARALLEL) run()
    else thumbQueue.push(run)
  })
}

// Valore già noto senza rete: string = trovata, null = Vimeo l'ha negata,
// undefined = mai chiesta (o scaduta).
export function cachedVimeoThumbnail(input: string | null | undefined, width = 640): string | null | undefined {
  const ref = parseVimeo(input)
  if (!ref) return null
  const entry = getThumbStore()[thumbKey(ref)]
  if (!entry) return undefined
  const ttl = entry.u ? THUMB_HIT_TTL : THUMB_MISS_TTL
  if (Date.now() - entry.t > ttl) return undefined
  return entry.u ? sizedThumb(entry.u, width) : null
}

export async function fetchVimeoThumbnail(input: string | null | undefined, width = 640): Promise<string | null> {
  const ref = parseVimeo(input)
  if (!ref) return null
  const cached = cachedVimeoThumbnail(input, width)
  if (cached !== undefined) return cached

  const key = thumbKey(ref)
  let pending = thumbInflight.get(key)
  if (!pending) {
    pending = runThumbJob(async () => {
      try {
        const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrlOf(ref))}`)
        if (!res.ok) return null
        const data = await res.json() as { thumbnail_url?: unknown }
        return typeof data.thumbnail_url === 'string' && data.thumbnail_url ? data.thumbnail_url : null
      } catch {
        return null
      }
    }).then(url => {
      getThumbStore()[key] = { u: url, t: Date.now() }
      persistThumbStore()
      thumbInflight.delete(key)
      return url
    })
    thumbInflight.set(key, pending)
  }
  const url = await pending
  return url ? sizedThumb(url, width) : null
}
