// Gestione CONDIVISA del microfono. Acquisiamo il MediaStream una sola volta
// (un solo prompt di permesso) e lo riusiamo per tutte le registrazioni
// successive — anche cambiando chat — così non viene chiesto il permesso ogni
// volta. Lo rilasciamo dopo un po' di inattività o quando l'app va in
// background/si chiude, per non tenere acceso l'indicatore "microfono in uso".

let stream: MediaStream | null = null
let releaseTimer: ReturnType<typeof setTimeout> | null = null
const IDLE_RELEASE_MS = 3 * 60 * 1000 // 3 minuti senza registrare → rilascia

function stopStream() {
  if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
  stream?.getTracks().forEach(t => t.stop())
  stream = null
}

// Acquisisce (o riusa) il microfono. Un solo prompt finché il permesso regge e
// la traccia resta viva. Se l'OS l'ha reclamata (readyState 'ended') riacquisisce.
export async function acquireMic(): Promise<MediaStream> {
  if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
  const alive = !!stream && stream.getAudioTracks().some(t => t.readyState === 'live')
  if (alive) return stream!
  if (stream) stopStream() // traccia morta → ripulisci e riacquisisci
  stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  return stream
}

// Programma il rilascio del microfono dopo un periodo di inattività.
export function scheduleMicRelease() {
  if (releaseTimer) clearTimeout(releaseTimer)
  releaseTimer = setTimeout(stopStream, IDLE_RELEASE_MS)
}

// Rilascio immediato (app in background / chiusura).
export function releaseMicNow() {
  stopStream()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', releaseMicNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') releaseMicNow()
  })
}
