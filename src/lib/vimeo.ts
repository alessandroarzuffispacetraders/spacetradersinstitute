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
