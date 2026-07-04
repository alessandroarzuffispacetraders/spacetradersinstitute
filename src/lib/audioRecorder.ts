import { useCallback, useEffect, useRef, useState } from 'react'
import { acquireMic, scheduleMicRelease } from './micStream'

// ─── Registrazione vocali (stile WhatsApp) ────────────────────────────────────
// Hook attorno a MediaRecorder: gestisce permessi mic, scelta del formato più
// compatibile, timer e stop/cancel. `stop()` è una Promise che risolve col blob.

export interface RecordedAudio {
  blob: Blob
  durationSec: number
  mime: string
  ext: string
}

// Formato: preferiamo mp4/aac (Safari → riproducibile ovunque), poi webm/opus
// (Chrome/Firefox/Android). Il primo supportato vince.
function pickMime(): { mime: string; ext: string } {
  const candidates: { mime: string; ext: string }[] = [
    { mime: 'audio/mp4', ext: 'm4a' },
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  ]
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c
    }
  }
  return { mime: '', ext: 'webm' } // lascia scegliere il browser
}

// Il dispositivo può registrare audio?
export function isAudioRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeRef = useRef<{ mime: string; ext: string }>({ mime: '', ext: 'webm' })
  const resolveRef = useRef<((r: RecordedAudio | null) => void) | null>(null)
  const cancelledRef = useRef(false)

  // NB: non fermiamo lo stream qui — è condiviso (micStream) e va riusato per le
  // registrazioni successive; disattiviamo solo la cattura e ne programmiamo il
  // rilascio dopo inattività.
  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = false })
    scheduleMicRelease()
    recRef.current = null
  }, [])

  // Allo smontaggio (es. si esce dalla chat): ferma un'eventuale registrazione e
  // programma il rilascio del microfono (non lo stoppiamo subito, così sopravvive
  // al cambio di chat e non richiede di nuovo il permesso).
  useEffect(() => () => {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') { cancelledRef.current = true; try { rec.stop() } catch { /* noop */ } }
    cleanup()
  }, [cleanup])

  const start = useCallback(async (): Promise<boolean> => {
    setError(null)
    if (recRef.current) return false
    if (!isAudioRecordingSupported()) {
      setError('La registrazione audio non è supportata su questo dispositivo.')
      return false
    }
    const picked = pickMime()
    mimeRef.current = picked
    try {
      // Riusa il microfono già autorizzato (un solo prompt per sessione).
      const stream = await acquireMic()
      streamRef.current = stream
      stream.getAudioTracks().forEach(t => { t.enabled = true })
      const rec = new MediaRecorder(stream, picked.mime ? { mimeType: picked.mime } : undefined)
      chunksRef.current = []
      cancelledRef.current = false

      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const durationSec = Math.max(1, Math.round((performance.now() - startRef.current) / 1000))
        const type = mimeRef.current.mime || rec.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const cancelled = cancelledRef.current
        chunksRef.current = []
        cleanup() // disattiva la cattura + programma rilascio; NON stoppa lo stream
        setRecording(false)
        setElapsedMs(0)
        const resolve = resolveRef.current
        resolveRef.current = null
        if (cancelled || blob.size === 0) { resolve?.(null); return }
        resolve?.({ blob, durationSec, mime: blob.type, ext: mimeRef.current.ext })
      }

      recRef.current = rec
      startRef.current = performance.now()
      // timeslice: MediaRecorder emette i dati OGNI secondo invece che solo allo
      // stop. Fondamentale per i vocali lunghi (iOS/WebView): i chunk si
      // accumulano man mano → niente perdita del blob e stop più affidabile.
      rec.start(1000)
      setRecording(true)
      setElapsedMs(0)
      timerRef.current = setInterval(() => {
        setElapsedMs(performance.now() - startRef.current)
      }, 100)
      return true
    } catch {
      cleanup()
      setRecording(false)
      setError('Microfono non disponibile. Consenti l’accesso al microfono per registrare.')
      return false
    }
  }, [cleanup])

  // Ferma e restituisce il vocale (o null se vuoto).
  const stop = useCallback((): Promise<RecordedAudio | null> => {
    return new Promise((resolve) => {
      const rec = recRef.current
      if (!rec || rec.state === 'inactive') { resolve(null); return }
      resolveRef.current = resolve
      cancelledRef.current = false
      rec.stop()
    })
  }, [])

  // Annulla: ferma la registrazione e scarta il risultato.
  const cancel = useCallback(() => {
    cancelledRef.current = true
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') {
      rec.stop() // onstop farà cleanup + reset
    } else {
      cleanup()
      setRecording(false)
      setElapsedMs(0)
    }
  }, [cleanup])

  // Tempo trascorso REALE (dal ref, non dallo stato React che è throttlato a 100ms
  // e soggetto al timing dei render): usato per decidere se un vocale è "troppo
  // corto" senza scartare per errore messaggi brevi ma validi.
  const getElapsedMs = useCallback(() => (recRef.current ? performance.now() - startRef.current : 0), [])

  // La registrazione è realmente in corso? (ref → affidabile subito, a differenza
  // dello stato `recording` che può non essere ancora committato da React.)
  const isActive = useCallback(() => recRef.current?.state === 'recording', [])

  return { recording, elapsedMs, error, start, stop, cancel, getElapsedMs, isActive }
}

// mm:ss da millisecondi o secondi.
export function formatDuration(input: number, isSeconds = false): string {
  const total = Math.max(0, Math.floor(isSeconds ? input : input / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
