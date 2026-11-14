import { useEffect, useRef, useState } from 'react'
import { X, Loader2, RefreshCw, WandSparkles, CircleAlert, type LucideIcon } from 'lucide-react'
import MediaThumb from '../media/MediaThumb'
import { CoverKind, generateCover, useCoverJob } from '../../lib/covers'

// Copertina AI di una lezione o di un replay: anteprima, rigenera, e richiesta
// di modifica a parole ("più semplice", "metti un toro", "parola chiave: RISCHIO").
// La generazione continua in background anche chiudendo la finestra.

export interface CoverSubject {
  kind: CoverKind
  id: string
  title: string
  coverUrl: string | null
  keyword: string | null
  status: string | null
  accent: string
  accentEnd?: string
  icon?: LucideIcon
  kicker?: string
}

const FEEDBACK_MAX = 500

export default function CoverEditorModal({ subject, onClose, onChanged }: {
  subject: CoverSubject
  onClose: () => void
  onChanged: () => void
}) {
  const job = useCoverJob(subject.kind, subject.id)
  const [feedback, setFeedback] = useState('')
  const [preview, setPreview] = useState({ coverUrl: subject.coverUrl, keyword: subject.keyword })
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  // Il genitore ricarica i dati a fine generazione: allinea l'anteprima.
  useEffect(() => {
    setPreview({ coverUrl: subject.coverUrl, keyword: subject.keyword })
  }, [subject.coverUrl, subject.keyword])

  const start = async (withFeedback: boolean) => {
    const text = withFeedback ? feedback.trim() : ''
    if (withFeedback && !text) return
    const res = await generateCover(subject.kind, subject.id, text || undefined)
    if (mounted.current && res.ok) {
      setPreview({ coverUrl: res.coverUrl ?? null, keyword: res.keyword ?? null })
      if (withFeedback) setFeedback('')
    }
    onChanged()
  }

  const serverPending = !job.running && subject.status === 'pending'
  const hasCover = !!preview.coverUrl

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl overflow-hidden"
        style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--ist-border)' }}>
          <div className="min-w-0">
            <h3 className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>Copertina AI</h3>
            <p className="text-xs truncate" style={{ color: 'var(--ist-text-muted)' }}>{subject.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--ist-text-dim)' }}>
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <MediaThumb
              imageUrl={preview.coverUrl}
              keyword={preview.keyword}
              kicker={subject.kicker}
              accent={subject.accent}
              accentEnd={subject.accentEnd}
              icon={subject.icon}
              rounded="rounded-2xl"
              showPlay={false}
              thumbWidth={960}
            />
            {(job.running || serverPending) && (
              <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2 text-center px-6" data-inverted="true" style={{ background: 'rgba(5,7,13,0.72)' }}>
                <Loader2 size={26} className="animate-spin text-white" />
                <p className="text-sm font-semibold text-white">Sto disegnando la copertina…</p>
                <p className="text-[11px] text-white" style={{ opacity: 0.7 }}>
                  Di solito ci vuole meno di un minuto e mezzo. Puoi chiudere: continua in background.
                </p>
              </div>
            )}
          </div>

          {!hasCover && !job.running && !serverPending && (
            <p className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
              Nessuna copertina ancora: generala ora, oppure descrivi sotto cosa vorresti vedere.
            </p>
          )}

          {(job.error || (!job.running && subject.status === 'error')) && (
            <p className="text-xs flex items-start gap-1.5" style={{ color: '#FF6B7A' }}>
              <CircleAlert size={13} strokeWidth={2.2} className="flex-shrink-0 mt-px" />
              {job.error || "L'ultima generazione non è riuscita. Riprova."}
            </p>
          )}

          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Chiedi una modifica</label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value.slice(0, FEEDBACK_MAX))}
              rows={3}
              disabled={job.running}
              placeholder="es. «più semplice», «metti un toro al posto delle candele», «parola chiave: RISCHIO»"
              className="w-full px-3 py-2.5 text-sm resize-none disabled:opacity-60"
              style={{ background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)', borderRadius: 14, color: 'var(--ist-text)', outline: 'none' }}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => start(true)}
              disabled={job.running || !feedback.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <WandSparkles size={14} strokeWidth={2.2} />
              Applica modifica
            </button>
            <button
              onClick={() => start(false)}
              disabled={job.running}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: 'var(--ist-text)' }}
            >
              {job.running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} strokeWidth={2.2} />}
              {hasCover ? 'Rigenera' : 'Genera copertina'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Miniatura cliccabile per le righe admin: copertina (o segnaposto) con lo
// stato sopra (in generazione / errore).
export function CoverChip({ subject, onClick, width = 64 }: {
  subject: CoverSubject
  onClick: () => void
  width?: number
}) {
  const job = useCoverJob(subject.kind, subject.id)
  const running = job.running || subject.status === 'pending'
  const failed = !running && (!!job.error || subject.status === 'error')
  return (
    <button
      onClick={onClick}
      className="relative flex-shrink-0 rounded-md overflow-hidden transition-transform hover:scale-105"
      style={{ width, border: '1px solid var(--ist-border)' }}
      title={running ? 'Copertina in generazione…' : failed ? 'Generazione non riuscita: apri per riprovare' : subject.coverUrl ? 'Copertina AI: apri per modificarla' : 'Nessuna copertina: apri per generarla'}
    >
      <MediaThumb
        imageUrl={subject.coverUrl}
        accent={subject.accent}
        accentEnd={subject.accentEnd}
        rounded="rounded-none"
        showPlay={false}
        thumbWidth={320}
      />
      {running && (
        <span className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(5,7,13,0.6)' }}>
          <Loader2 size={13} className="animate-spin" style={{ color: '#fff' }} />
        </span>
      )}
      {failed && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: '#FF6B7A', boxShadow: '0 0 0 1.5px rgba(5,7,13,0.8)' }} />
      )}
      {!subject.coverUrl && !running && (
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.75)' }}>
          <WandSparkles size={12} strokeWidth={2} />
        </span>
      )}
    </button>
  )
}
