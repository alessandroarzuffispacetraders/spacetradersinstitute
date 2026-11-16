import { useEffect, useState } from 'react'
import { X, Loader2, RefreshCw, WandSparkles, CircleAlert, Moon, Sun, type LucideIcon } from 'lucide-react'
import MediaThumb from '../media/MediaThumb'
import { CoverKind, claimCover, claimMessage, isStyledCover } from '../../lib/coverPool'
import { coverPoolStatus, type CoverPoolStatus } from '../../lib/live'
import { supabase } from '../../lib/supabase'

// Copertina di una lezione o di una live, o locandina verticale di una sezione.
// «Genera» prende dalla scorta un'immagine mai usata nello stesso stile di
// tutte le altre (grafici quant "fotografati"), già pronta in versione scura e
// chiara: lo studente vede quella del suo tema. Qui si vedono tutte e due.

export interface CoverSubject {
  kind: CoverKind
  id: string
  title: string
  coverUrl: string | null
  coverUrlLight?: string | null
  keyword: string | null
  status: string | null
  accent: string
  accentEnd?: string
  icon?: LucideIcon
  kicker?: string
}

const NAVY = '#0b1530'

// Anteprima della locandina 2:3 come la vede lo studente: titolo della sezione
// scritto dall'app sul terzo inferiore (scuro o chiaro secondo la versione).
function PosterPreview({ subject, url, light }: { subject: CoverSubject; url: string | null; light: boolean }) {
  return (
    <MediaThumb
      imageUrl={url}
      tone={light ? 'light' : 'dark'}
      accent={subject.accent}
      accentEnd={subject.accentEnd}
      icon={subject.icon}
      aspect="aspect-[2/3]"
      rounded="rounded-2xl"
      showPlay={false}
      thumbWidth={600}
    >
      <div
        data-inverted={light ? undefined : 'true'}
        className="absolute inset-x-0 bottom-0 px-4 pb-5 pt-20 pointer-events-none"
        style={{ background: light
          ? 'linear-gradient(to top, rgba(240,244,250,0.94) 0%, rgba(240,244,250,0.55) 55%, rgba(240,244,250,0) 100%)'
          : 'linear-gradient(to top, rgba(5,7,13,0.92) 0%, rgba(5,7,13,0.55) 55%, rgba(5,7,13,0) 100%)' }}
      >
        <p className="font-extrabold leading-[1.02]" style={{ color: light ? NAVY : '#fff', fontSize: 'clamp(16px, 10cqw, 30px)', letterSpacing: '-0.025em', textWrap: 'balance' }}>
          {subject.title}
        </p>
      </div>
    </MediaThumb>
  )
}

// side = colonna (tema scuro / tema chiaro); light = l'immagine è davvero la
// versione chiara (senza, il tema chiaro mostra quella scura, come nell'app).
function Preview({ subject, side, url, light, keyword }: { subject: CoverSubject; side: 'dark' | 'light'; url: string | null; light: boolean; keyword: string | null }) {
  const Icon = side === 'light' ? Sun : Moon
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>
        <Icon size={12} strokeWidth={2.2} /> {side === 'light' ? 'Tema chiaro' : 'Tema scuro'}
      </p>
      {subject.kind === 'category' ? (
        <PosterPreview subject={subject} url={url} light={light} />
      ) : (
        <MediaThumb
          imageUrl={url}
          tone={light ? 'light' : 'dark'}
          keyword={keyword}
          kicker={subject.kicker}
          accent={subject.accent}
          accentEnd={subject.accentEnd}
          icon={subject.icon}
          rounded="rounded-2xl"
          showPlay={false}
          thumbWidth={720}
        />
      )}
    </div>
  )
}

export default function CoverEditorModal({ subject, onClose, onChanged }: {
  subject: CoverSubject
  onClose: () => void
  onChanged: () => void
}) {
  const isPoster = subject.kind === 'category'
  const noun = isPoster ? 'locandina' : 'copertina'
  const [keyword, setKeyword] = useState(subject.keyword ?? '')
  const [busy, setBusy] = useState<'claim' | 'save' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pool, setPool] = useState<CoverPoolStatus | null>(null)

  useEffect(() => { coverPoolStatus().then(setPool) }, [subject.coverUrl])
  useEffect(() => { setKeyword(subject.keyword ?? '') }, [subject.keyword])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const styled = isStyledCover(subject.coverUrl)
  const darkUrl = subject.coverUrl
  // Senza versione chiara (vecchie grafiche) il tema chiaro mostra quella scura.
  const lightUrl = subject.coverUrlLight ?? null
  const shownKeyword = isPoster ? null : (keyword.trim().toUpperCase() || subject.keyword)

  const left = pool ? (isPoster ? pool.posters : pool.trading + pool.mind) : null
  const state = !darkUrl
    ? `Nessuna ${noun}: generala dalla scorta.`
    : styled
      ? (lightUrl ? 'Stile della piattaforma, con versione scura e chiara.' : 'Stile della piattaforma (manca la versione chiara).')
      : `Questa ${noun} ha uno stile diverso e non ha la versione chiara: generane una nuova.`

  const claim = async () => {
    setBusy('claim'); setMsg(null)
    const res = await claimCover(subject.kind, subject.id, { title: subject.title, keyword: subject.keyword, force: !!subject.coverUrl })
    setBusy(null)
    setMsg(claimMessage(res, subject.kind))
    onChanged()
  }

  const saveKeyword = async () => {
    setBusy('save'); setMsg(null)
    const kw = keyword.trim().toUpperCase() || null
    const { error } = await supabase.from(subject.kind === 'live' ? 'live_events' : 'lessons').update({ cover_keyword: kw }).eq('id', subject.id)
    setBusy(null)
    if (!error) { setMsg({ ok: true, text: 'Parola chiave aggiornata.' }); onChanged() }
    else setMsg({ ok: false, text: 'Salvataggio non riuscito.' })
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${isPoster ? 'max-w-xl' : 'max-w-3xl'} rounded-3xl overflow-hidden my-auto`}
        style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--ist-border)' }}>
          <div className="min-w-0">
            <h3 className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>
              {isPoster ? 'Locandina della sezione' : subject.kind === 'live' ? 'Copertina della live' : 'Copertina della lezione'}
            </h3>
            <p className="text-xs truncate" style={{ color: 'var(--ist-text-muted)' }}>{subject.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--ist-text-dim)' }} aria-label="Chiudi">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className={`grid gap-4 ${isPoster ? 'grid-cols-2 max-w-[440px] mx-auto' : 'grid-cols-1 sm:grid-cols-2'}`}>
            <Preview subject={subject} side="dark" url={darkUrl} light={false} keyword={shownKeyword} />
            <Preview subject={subject} side="light" url={lightUrl ?? darkUrl} light={!!lightUrl} keyword={shownKeyword} />
          </div>

          <p className="text-xs flex items-start gap-1.5" style={{ color: darkUrl && !styled ? '#F6C85F' : 'var(--ist-text-muted)' }}>
            {darkUrl && !styled && <CircleAlert size={13} strokeWidth={2.2} className="flex-shrink-0 mt-px" />}
            {state}
          </p>

          {!isPoster && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Parola chiave sulla copertina</label>
              <div className="flex gap-2">
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value.slice(0, 24))}
                  placeholder="Es. OTTIMIZZAZIONE"
                  className="flex-1 min-w-0 px-3 py-2.5 text-sm uppercase"
                  style={{ background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)', borderRadius: 14, color: 'var(--ist-text)', outline: 'none' }}
                />
                <button
                  onClick={saveKeyword}
                  disabled={busy !== null || keyword.trim().toUpperCase() === (subject.keyword ?? '')}
                  className="px-4 rounded-2xl text-xs font-bold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
                >
                  {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : 'Salva'}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={claim}
              disabled={busy !== null}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {busy === 'claim' ? <Loader2 size={15} className="animate-spin" /> : darkUrl ? <RefreshCw size={15} strokeWidth={2.2} /> : <WandSparkles size={15} strokeWidth={2.2} />}
              {darkUrl ? (styled ? `Genera un'altra ${noun}` : `Genera la ${noun} nello stile giusto`) : `Genera ${noun}`}
            </button>
            {left !== null && (
              <span className="text-[11px]" style={{ color: left <= 6 ? '#F6C85F' : 'var(--ist-text-dim)' }}>
                {isPoster ? `${left} locandine pronte nella scorta` : `${left} copertine pronte nella scorta`}
                {left <= 6 && ' — stanno finendo'}
              </span>
            )}
          </div>
          {msg && <p className="text-xs" style={{ color: msg.ok ? '#46D39A' : '#FF6B7A' }}>{msg.text}</p>}
          <p className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>
            Ogni immagine si usa una volta sola: quella che sostituisci non ricompare altrove.
          </p>
        </div>
      </div>
    </div>
  )
}

// Miniatura cliccabile per le righe admin: copertina (o segnaposto) con un
// pallino giallo se l'immagine ha uno stile diverso da quello della piattaforma.
export function CoverChip({ subject, onClick, width = 64 }: {
  subject: CoverSubject
  onClick: () => void
  width?: number
}) {
  const isPoster = subject.kind === 'category'
  const noun = isPoster ? 'Locandina' : 'Copertina'
  const running = subject.status === 'pending'
  const offStyle = !!subject.coverUrl && !isStyledCover(subject.coverUrl)
  return (
    <button
      onClick={onClick}
      className="relative flex-shrink-0 rounded-md overflow-hidden transition-transform hover:scale-105"
      style={{ width, border: '1px solid var(--ist-border)' }}
      title={offStyle ? `${noun} di uno stile diverso: apri per generarne una nuova` : subject.coverUrl ? `${noun}: apri per cambiarla` : `Nessuna ${noun.toLowerCase()}: apri per generarla`}
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
      {offStyle && !running && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: '#F6C85F', boxShadow: '0 0 0 1.5px rgba(5,7,13,0.8)' }} />
      )}
      {!subject.coverUrl && !running && (
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.75)' }}>
          <WandSparkles size={12} strokeWidth={2} />
        </span>
      )}
    </button>
  )
}
