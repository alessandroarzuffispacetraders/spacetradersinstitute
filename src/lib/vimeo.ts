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

// Legge la DURATA del video (in secondi) dall'oEmbed pubblico di Vimeo, così
// l'admin non deve inserirla a mano. Funziona anche per gli unlisted a patto che
// l'input contenga l'hash di privacy (lo passiamo nell'URL: /<id>/<hash>).
// Ritorna null se il video non è raggiungibile (privato/rimosso/hash mancante) o
// se la rete fallisce → in quel caso resta l'inserimento manuale.
export async function fetchVimeoDuration(input: string): Promise<number | null> {
  const ref = parseVimeo(input)
  if (!ref) return null
  const videoUrl = ref.hash ? `https://vimeo.com/${ref.id}/${ref.hash}` : `https://vimeo.com/${ref.id}`
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`)
    if (!res.ok) return null
    const data = await res.json()
    const secs = Number((data as { duration?: unknown }).duration)
    return Number.isFinite(secs) && secs > 0 ? Math.round(secs) : null
  } catch {
    return null
  }
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
