import { useEffect, useRef, useState } from 'react'
import {
  X, Loader2, RefreshCw, WandSparkles, CircleAlert, Copy, Check, Upload, ChevronDown, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import MediaThumb from '../media/MediaThumb'
import {
  CoverKind, CoverPromptSubject, generateCover, useCoverJob, preparePrompt, usePromptJob,
  uploadCoverImage, copyText, isUploadedCover,
} from '../../lib/covers'
import { buildCoverPrompt, buildPosterPrompt } from '../../lib/coverPrompts'
import { claimLiveCover } from '../../lib/live'
import { supabase } from '../../lib/supabase'

// Copertina di una lezione o locandina verticale di una serie.
//  - Flusso PRINCIPALE (lezioni e serie): Claude sceglie il soggetto, qui si
//    copia il prompt completo da incollare in ChatGPT e si carica l'immagine
//    ottenuta (con la parola chiave per le lezioni).
//  - Secondario (a scomparsa): la vecchia generazione vettoriale automatica,
//    con richiesta di modifica a parole. Per i replay delle live resta l'unica.

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
  // Per il prompt di ChatGPT (lezioni e serie).
  prompt?: CoverPromptSubject | null
  promptContext?: { serie: string; descrizione?: string; corso?: string; numero?: number }
}

// Prompt completo da incollare in ChatGPT (null se il soggetto non c'è ancora).
export function fullPrompt(subject: CoverSubject, prompt: CoverPromptSubject | null | undefined): string | null {
  if (!prompt || subject.kind === 'live') return null
  const ctx = subject.promptContext
  return subject.kind === 'category'
    ? buildPosterPrompt({ titolo: subject.title, descrizione: ctx?.descrizione }, prompt)
    : buildCoverPrompt({ titolo: subject.title, numero: ctx?.numero ?? 1, serie: ctx?.serie ?? '', corso: ctx?.corso }, prompt)
}

const FEEDBACK_MAX = 500

// Anteprima della locandina 2:3 come la vedrà lo studente: titolo della serie
// scritto dall'app sopra il terzo inferiore scuro della grafica.
function PosterPreview({ subject, coverUrl, className = '' }: { subject: CoverSubject; coverUrl: string | null; className?: string }) {
  return (
    <MediaThumb
      imageUrl={coverUrl}
      accent={subject.accent}
      accentEnd={subject.accentEnd}
      icon={subject.icon}
      aspect="aspect-[2/3]"
      rounded="rounded-2xl"
      showPlay={false}
      thumbWidth={800}
      className={className}
    >
      <div
        data-inverted="true"
        className="absolute inset-x-0 bottom-0 px-5 pb-6 pt-24 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(5,7,13,0.92) 0%, rgba(5,7,13,0.55) 55%, rgba(5,7,13,0) 100%)' }}
      >
        <p
          className="text-white font-extrabold leading-[1.02]"
          style={{ fontSize: 'clamp(22px, 11cqw, 44px)', letterSpacing: '-0.025em', textWrap: 'balance' }}
        >
          {subject.title}
        </p>
      </div>
    </MediaThumb>
  )
}

// ─── Generazione vettoriale (secondaria; unica per i replay) ──────────────────

function VectorPanel({ subject, onChanged, onPreview }: {
  subject: CoverSubject
  onChanged: () => void
  onPreview: (p: { coverUrl: string | null; keyword: string | null }) => void
}) {
  const job = useCoverJob(subject.kind, subject.id)
  const [feedback, setFeedback] = useState('')
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const start = async (withFeedback: boolean) => {
    const text = withFeedback ? feedback.trim() : ''
    if (withFeedback && !text) return
    const res = await generateCover(subject.kind, subject.id, text || undefined)
    if (mounted.current && res.ok) {
      onPreview({ coverUrl: res.coverUrl ?? null, keyword: res.keyword ?? null })
      if (withFeedback) setFeedback('')
    }
    onChanged()
  }

  const serverPending = !job.running && subject.status === 'pending'
  const isPoster = subject.kind === 'category'
  const hasCover = !!subject.coverUrl

  return (
    <div className="space-y-3">
      {(job.running || serverPending) && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--ist-text-muted)' }}>
          <Loader2 size={13} className="animate-spin" />
          {isPoster ? 'Sto disegnando la locandina (2–3 minuti, continua in background)…' : 'Sto disegnando la copertina (circa un minuto, continua in background)…'}
        </p>
      )}
      {(job.error || (!job.running && subject.status === 'error')) && (
        <p className="text-xs flex items-start gap-1.5" style={{ color: '#FF6B7A' }}>
          <CircleAlert size={13} strokeWidth={2.2} className="flex-shrink-0 mt-px" />
          {job.error || "L'ultima generazione non è riuscita. Riprova."}
        </p>
      )}
      <textarea
        value={feedback}
        onChange={e => setFeedback(e.target.value.slice(0, FEEDBACK_MAX))}
        rows={2}
        disabled={job.running}
        placeholder={isPoster
          ? 'Modifica (facoltativa): es. «più drammatica», «più profondità sullo sfondo»'
          : 'Modifica (facoltativa): es. «più semplice», «parola chiave: RISCHIO»'}
        className="w-full px-3 py-2.5 text-sm resize-none disabled:opacity-60"
        style={{ background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)', borderRadius: 14, color: 'var(--ist-text)', outline: 'none' }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => start(true)}
          disabled={job.running || !feedback.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <WandSparkles size={13} strokeWidth={2.2} />
          Applica modifica
        </button>
        <button
          onClick={() => start(false)}
          disabled={job.running}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors disabled:opacity-40"
          style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: 'var(--ist-text)' }}
        >
          {job.running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} strokeWidth={2.2} />}
          {hasCover ? 'Rigenera in vettoriale' : 'Genera in vettoriale'}
        </button>
      </div>
    </div>
  )
}

// ─── Live: copertina dalla scorta + parola chiave ─────────────────────────────

function LivePoolPanel({ subject, onChanged, onPreview }: {
  subject: CoverSubject
  onChanged: () => void
  onPreview: (p: { coverUrl: string | null; keyword: string | null }) => void
}) {
  const [keyword, setKeyword] = useState(subject.keyword ?? '')
  const [busy, setBusy] = useState<'claim' | 'save' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const claim = async () => {
    setBusy('claim'); setMsg(null)
    const res = await claimLiveCover(subject.id, keyword || null, !!subject.coverUrl)
    setBusy(null)
    if (res.status === 'ok' || res.status === 'other_theme') {
      setMsg({ ok: true, text: `Nuova copertina assegnata${res.left !== undefined ? ` · ne restano ${res.left} di questo tema` : ''}.` })
    } else if (res.status === 'empty') setMsg({ ok: false, text: 'La scorta di copertine è finita: fanne generare altre.' })
    else if (res.status === 'unavailable') setMsg({ ok: false, text: "Manca l'aggiornamento del database (phase_live_share.sql)." })
    else setMsg({ ok: false, text: 'Non è stato possibile assegnare la copertina.' })
    onChanged()
  }

  const saveKeyword = async () => {
    setBusy('save'); setMsg(null)
    const kw = keyword.trim().toUpperCase() || null
    const { error } = await supabase.from('live_events').update({ cover_keyword: kw }).eq('id', subject.id)
    setBusy(null)
    if (!error) { onPreview({ coverUrl: subject.coverUrl, keyword: kw }); setMsg({ ok: true, text: 'Parola chiave aggiornata.' }); onChanged() }
    else setMsg({ ok: false, text: 'Salvataggio non riuscito.' })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
        Ogni live riceve una copertina pronta appena viene creata, presa da una scorta di immagini tutte diverse
        (tema mente per il Mental Coach, trading per il resto).
      </p>
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Parola chiave sulla copertina</label>
        <div className="flex gap-2">
          <input value={keyword} onChange={e => setKeyword(e.target.value.slice(0, 24))} placeholder="Es. OTTIMIZZAZIONE"
            className="flex-1 px-3 py-2.5 text-sm uppercase" style={{ background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)', borderRadius: 14, color: 'var(--ist-text)', outline: 'none' }} />
          <button onClick={saveKeyword} disabled={busy !== null || keyword.trim().toUpperCase() === (subject.keyword ?? '')}
            className="px-4 rounded-2xl text-xs font-bold text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}>
            {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : 'Salva'}
          </button>
        </div>
      </div>
      <button onClick={claim} disabled={busy !== null}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors disabled:opacity-40"
        style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: 'var(--ist-text)' }}>
        {busy === 'claim' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} strokeWidth={2.2} />}
        {subject.coverUrl ? 'Cambia copertina' : 'Assegna copertina'}
      </button>
      {msg && <p className="text-xs" style={{ color: msg.ok ? '#46D39A' : '#FF6B7A' }}>{msg.text}</p>}
    </div>
  )
}

// ─── Flusso ChatGPT: prompt da copiare + caricamento dell'immagine ───────────

function ChatGptPanel({ subject, prompt, onPrompt }: {
  subject: CoverSubject
  prompt: CoverPromptSubject | null
  onPrompt: (p: CoverPromptSubject) => void
}) {
  const job = usePromptJob(subject.kind as 'lesson' | 'category', subject.id)
  const [notes, setNotes] = useState('')
  const [copied, setCopied] = useState(false)
  const text = fullPrompt(subject, prompt)

  const prepare = async (withNotes: boolean) => {
    const res = await preparePrompt(subject.kind as 'lesson' | 'category', subject.id, withNotes ? notes : undefined)
    if (res.ok && res.subject) {
      onPrompt(res.subject)
      if (withNotes) setNotes('')
    }
  }

  const copy = async () => {
    if (!text) return
    if (await copyText(text)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <div className="space-y-3">
      <ol className="text-xs space-y-1" style={{ color: 'var(--ist-text-muted)' }}>
        <li><b style={{ color: 'var(--ist-text)' }}>1.</b> {text ? 'Copia il prompt' : 'Prepara il prompt (Claude sceglie il soggetto)'}</li>
        <li><b style={{ color: 'var(--ist-text)' }}>2.</b> Incollalo in ChatGPT (allega l&apos;immagine di riferimento se vuoi)</li>
        <li><b style={{ color: 'var(--ist-text)' }}>3.</b> Scarica l&apos;immagine e caricala qui</li>
      </ol>

      {!text ? (
        <button
          onClick={() => prepare(false)}
          disabled={job.running}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          {job.running ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} strokeWidth={2.2} />}
          {job.running ? 'Claude sta scegliendo il soggetto…' : 'Prepara prompt'}
        </button>
      ) : (
        <>
          {prompt?.visual && (
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ist-accent-text)' }}>
              Soggetto: {prompt.visual}{prompt.parolaChiave ? ` · parola chiave ${prompt.parolaChiave}` : ''}
            </p>
          )}
          {/* Testo a sola lettura (non un campo: la regola globale dei 16px per
              gli input lo renderebbe enorme); si copia col pulsante. */}
          <div
            className="w-full max-h-[240px] overflow-y-auto px-3 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap select-text"
            style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-w10)', borderRadius: 14, color: 'var(--ist-text-muted)' }}
          >
            {text}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-0.5"
              style={{ background: copied ? '#2BA877' : 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {copied ? <Check size={14} strokeWidth={2.6} /> : <Copy size={14} strokeWidth={2.2} />}
              {copied ? 'Copiato!' : 'Copia prompt'}
            </button>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value.slice(0, FEEDBACK_MAX))}
              disabled={job.running}
              placeholder="Indicazioni (facoltative): es. «usa la heatmap»"
              className="flex-1 min-w-[160px] px-3 py-2 text-xs disabled:opacity-60"
              style={{ background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)', borderRadius: 999, color: 'var(--ist-text)', outline: 'none' }}
            />
            <button
              onClick={() => prepare(!!notes.trim())}
              disabled={job.running}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors disabled:opacity-50"
              style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: 'var(--ist-text)' }}
              title="Chiede a Claude un soggetto diverso"
            >
              {job.running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} strokeWidth={2.2} />}
              Rigenera prompt
            </button>
          </div>
        </>
      )}

      {job.error && (
        <p className="text-xs flex items-start gap-1.5" style={{ color: '#FF6B7A' }}>
          <CircleAlert size={13} strokeWidth={2.2} className="flex-shrink-0 mt-px" />
          {job.error}
        </p>
      )}
    </div>
  )
}

function UploadBox({ subject, keyword, setKeyword, onUploaded }: {
  subject: CoverSubject
  keyword: string
  setKeyword: (k: string) => void
  onUploaded: (url: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPoster = subject.kind === 'category'

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    const res = await uploadCoverImage(subject.kind as 'lesson' | 'category', subject.id, file, keyword)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
    if (res.ok && res.url) onUploaded(res.url)
    else setError(res.error ?? 'Caricamento non riuscito')
  }

  return (
    <div className="space-y-2">
      {!isPoster && (
        <div>
          <label className="text-[11px] block mb-1" style={{ color: 'var(--ist-text-muted)' }}>Parola chiave (scritta sopra la copertina)</label>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value.toLocaleUpperCase('it-IT').slice(0, 24))}
            placeholder="es. LIQUIDITÀ"
            className="w-full px-3 py-2 text-sm font-bold tracking-wide"
            style={{ background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)', borderRadius: 12, color: 'var(--ist-text)', outline: 'none' }}
          />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-colors disabled:opacity-60"
        style={{ background: 'var(--ist-w8)', border: '1px dashed var(--ist-border-strong)', color: 'var(--ist-text)' }}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} strokeWidth={2.2} />}
        {busy ? 'Carico e ottimizzo…' : isPoster ? 'Carica locandina' : 'Carica copertina'}
      </button>
      <p className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
        {isPoster ? 'Verticale 2:3 (es. 1024×1536).' : 'Orizzontale 3:2 (es. 1536×1024), mostrata in 16:9.'} PNG, JPG o WebP: la riduco e la ottimizzo io.
      </p>
      {error && (
        <p className="text-xs flex items-start gap-1.5" style={{ color: '#FF6B7A' }}>
          <CircleAlert size={13} strokeWidth={2.2} className="flex-shrink-0 mt-px" />
          {error}
        </p>
      )}
    </div>
  )
}

export default function CoverEditorModal({ subject, onClose, onChanged }: {
  subject: CoverSubject
  onClose: () => void
  onChanged: () => void
}) {
  const isLive = subject.kind === 'live'
  const isPoster = subject.kind === 'category'
  const [preview, setPreview] = useState({ coverUrl: subject.coverUrl, keyword: subject.keyword })
  const [prompt, setPrompt] = useState<CoverPromptSubject | null>(subject.prompt ?? null)
  const [keyword, setKeyword] = useState(subject.keyword ?? subject.prompt?.parolaChiave ?? '')
  const [vectorOpen, setVectorOpen] = useState(isLive)
  const job = useCoverJob(subject.kind, subject.id)
  const serverPending = !job.running && subject.status === 'pending'

  // Il genitore ricarica i dati (dopo una generazione/caricamento): allinea.
  useEffect(() => {
    setPreview({ coverUrl: subject.coverUrl, keyword: subject.keyword })
  }, [subject.coverUrl, subject.keyword])
  useEffect(() => { if (subject.prompt) setPrompt(subject.prompt) }, [subject.prompt])

  const uploaded = isUploadedCover(preview.coverUrl)
  const state = uploaded ? 'Immagine caricata' : preview.coverUrl ? 'Grafica vettoriale' : 'Nessuna immagine'

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${isLive ? 'max-w-xl' : 'max-w-4xl'} rounded-3xl overflow-hidden my-auto`}
        style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--ist-border)' }}>
          <div className="min-w-0">
            <h3 className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>
              {isPoster ? 'Locandina della sezione' : isLive ? 'Copertina della live' : 'Copertina della lezione'}
            </h3>
            <p className="text-xs truncate" style={{ color: 'var(--ist-text-muted)' }}>{subject.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--ist-text-dim)' }}>
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className={`p-6 ${isLive ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6'}`}>
          {/* Anteprima (+ caricamento per lezioni e serie) */}
          <div className="space-y-3">
            <div className={`relative ${isPoster ? 'w-full max-w-[240px] mx-auto' : ''}`}>
              {isPoster ? (
                <PosterPreview subject={subject} coverUrl={preview.coverUrl} />
              ) : (
                <MediaThumb
                  imageUrl={preview.coverUrl}
                  keyword={isLive ? preview.keyword : (keyword || preview.keyword)}
                  kicker={subject.kicker}
                  accent={subject.accent}
                  accentEnd={subject.accentEnd}
                  icon={subject.icon}
                  rounded="rounded-2xl"
                  showPlay={false}
                  thumbWidth={960}
                />
              )}
              {(job.running || serverPending) && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center" data-inverted="true" style={{ background: 'rgba(5,7,13,0.6)' }}>
                  <Loader2 size={24} className="animate-spin text-white" />
                </div>
              )}
            </div>
            {!isLive && (
              <>
                <p className="text-[11px] text-center" style={{ color: 'var(--ist-text-dim)' }}>{state}</p>
                <UploadBox
                  subject={subject}
                  keyword={keyword}
                  setKeyword={setKeyword}
                  onUploaded={url => { setPreview({ coverUrl: url, keyword: keyword || null }); onChanged() }}
                />
              </>
            )}
          </div>

          {/* Prompt per ChatGPT (lezioni e serie) / generazione vettoriale */}
          <div className="space-y-4 min-w-0">
            {!isLive && (
              <ChatGptPanel
                subject={subject}
                prompt={prompt}
                onPrompt={p => {
                  setPrompt(p)
                  if (!keyword && p.parolaChiave) setKeyword(p.parolaChiave)
                  onChanged()
                }}
              />
            )}

            {isLive ? (
              <LivePoolPanel subject={subject} onChanged={onChanged} onPreview={setPreview} />
            ) : (
              <div className="rounded-2xl" style={{ border: '1px solid var(--ist-border)' }}>
                <button
                  onClick={() => setVectorOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold"
                  style={{ color: 'var(--ist-text-muted)' }}
                >
                  Genera automaticamente (vettoriale)
                  <ChevronDown size={14} strokeWidth={2.2} className={`transition-transform ${vectorOpen ? 'rotate-180' : ''}`} />
                </button>
                {vectorOpen && (
                  <div className="px-4 pb-4">
                    <VectorPanel subject={subject} onChanged={onChanged} onPreview={setPreview} />
                  </div>
                )}
              </div>
            )}
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
  const isPoster = subject.kind === 'category'
  const noun = isPoster ? 'Locandina' : 'Copertina'
  return (
    <button
      onClick={onClick}
      className="relative flex-shrink-0 rounded-md overflow-hidden transition-transform hover:scale-105"
      style={{ width, border: '1px solid var(--ist-border)' }}
      title={running ? `${noun} in generazione…` : failed ? 'Generazione non riuscita: apri per riprovare' : subject.coverUrl ? `${noun} AI: apri per modificarla` : `Nessuna ${noun.toLowerCase()}: apri per generarla`}
    >
      <MediaThumb
        imageUrl={subject.coverUrl}
        accent={subject.accent}
        accentEnd={subject.accentEnd}
        aspect={isPoster ? 'aspect-[2/3]' : 'aspect-video'}
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
