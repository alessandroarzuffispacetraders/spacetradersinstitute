// Parse whatever an admin pastes (full URL, player URL, or bare id) into a
// Vimeo id (+ optional privacy hash for unlisted videos), and build the embed
// src for the iframe player.

export interface VimeoRef { id: string; hash?: string }

export function parseVimeo(input: string | null | undefined): VimeoRef | null {
  if (!input) return null
  const s = input.trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return { id: s }
  try {
    const url = new URL(s.startsWith('http') ? s : `https://${s}`)
    // player.vimeo.com/video/<id>?h=<hash>
    let m = url.pathname.match(/\/video\/(\d+)/)
    if (m) return { id: m[1], hash: url.searchParams.get('h') ?? undefined }
    // vimeo.com/<id> or vimeo.com/<id>/<hash>
    m = url.pathname.match(/^\/(\d+)(?:\/(\w+))?/)
    if (m) return { id: m[1], hash: m[2] || url.searchParams.get('h') || undefined }
  } catch {
    /* not a URL */
  }
  return null
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
