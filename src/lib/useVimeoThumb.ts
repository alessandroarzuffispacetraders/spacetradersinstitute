import { useEffect, useState } from 'react'
import { cachedVimeoThumbnail, fetchVimeoThumbnail } from './vimeo'

// Miniatura di un video Vimeo (null finché non c'è o se Vimeo la nega).
// Se è già in cache la restituisce subito, senza "lampeggio" del segnaposto.
export function useVimeoThumb(vimeoId: string | null | undefined, width = 640): string | null {
  const [url, setUrl] = useState<string | null>(() => cachedVimeoThumbnail(vimeoId, width) ?? null)

  useEffect(() => {
    const cached = cachedVimeoThumbnail(vimeoId, width)
    if (cached !== undefined) { setUrl(cached); return }
    let alive = true
    fetchVimeoThumbnail(vimeoId, width).then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [vimeoId, width])

  return url
}
