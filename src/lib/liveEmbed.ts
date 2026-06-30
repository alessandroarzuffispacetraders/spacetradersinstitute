// Costruisce l'src di un iframe per guardare una diretta IN-APP, a partire da
// ciò che il coach incolla: link YouTube (watch / youtu.be / live / embed) o
// Vimeo (video o evento live). Ritorna null se non è embeddabile.

import { vimeoEmbedSrc } from './vimeo'

function youtubeId(u: URL): string | null {
  // youtu.be/<id>
  if (u.hostname.endsWith('youtu.be')) {
    const id = u.pathname.slice(1).split('/')[0]
    return id || null
  }
  if (u.hostname.includes('youtube.com')) {
    // youtube.com/watch?v=<id>
    const v = u.searchParams.get('v')
    if (v) return v
    // youtube.com/live/<id>  ·  youtube.com/embed/<id>  ·  youtube.com/shorts/<id>
    const m = u.pathname.match(/\/(?:live|embed|shorts)\/([\w-]+)/)
    if (m) return m[1]
  }
  return null
}

export function liveEmbedSrc(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim()
  if (!s) return null

  let url: URL
  try {
    url = new URL(s.startsWith('http') ? s : `https://${s}`)
  } catch {
    return null
  }

  // YouTube
  const yt = youtubeId(url)
  if (yt) {
    const p = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1' })
    return `https://www.youtube.com/embed/${yt}?${p.toString()}`
  }

  // Vimeo evento live: vimeo.com/event/<id>  →  player evento
  const ev = url.pathname.match(/\/event\/(\w+)/)
  if (url.hostname.includes('vimeo.com') && ev) {
    return `https://vimeo.com/event/${ev[1]}/embed`
  }

  // Vimeo video classico (riusa il parser esistente)
  const vimeo = vimeoEmbedSrc(s, { autoplay: true })
  if (vimeo) return vimeo

  // Già un URL di embed pronto all'uso → usalo così com'è.
  if (/\/embed\b/.test(url.pathname)) return s

  return null
}
