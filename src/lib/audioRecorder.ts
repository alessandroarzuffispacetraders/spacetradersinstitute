import { useCallback, useEffect, useRef, useState } from 'react'

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

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    recRef.current = null
  }, [])

  // Se il componente si smonta mentre registra: rilascia il microfono.
  useEffect(() => cleanup, [cleanup])

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream, picked.mime ? { mimeType: picked.mime } : undefined)
      chunksRef.current = []
      cancelledRef.current = false

      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const durationSec = Math.max(1, Math.round((performance.now() - startRef.current) / 1000))
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        const type = mimeRef.current.mime || rec.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const cancelled = cancelledRef.current
        chunksRef.current = []
        cleanup()
        setRecording(false)
        setElapsedMs(0)
        const resolve = resolveRef.current
        resolveRef.current = null
        if (cancelled || blob.size === 0) { resolve?.(null); return }
        resolve?.({ blob, durationSec, mime: blob.type, ext: mimeRef.current.ext })
      }

      recRef.current = rec
      startRef.current = performance.now()
      rec.start()
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

  return { recording, elapsedMs, error, start, stop, cancel }
}

// mm:ss da millisecondi o secondi.
export function formatDuration(input: number, isSeconds = false): string {
  const total = Math.max(0, Math.floor(isSeconds ? input : input / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
