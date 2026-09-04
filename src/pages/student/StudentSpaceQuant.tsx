import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { ArrowUp, ChevronDown, ChevronLeft, ChevronUp, Loader2, MessageCircle, PlayCircle } from 'lucide-react'
import { useUI } from '../../context/UIContext'
import { useStableSafeAreaBottom } from '../../lib/useStableSafeAreaBottom'
import { useVisibleViewport, useNativeKeyboardHeight, nativeKeyboardInset } from '../../lib/useKeyboardViewport'
import QuantBrainIcon from '../../components/icons/QuantBrainIcon'
import KnowledgeGraph from '../../components/spacequant/KnowledgeGraph'
import {
  useSpaceQuantGraph, useSpaceQuantQuota, useSpaceQuantAccess, useSpaceQuantHistory, askSpaceQuant,
  type ChatTurn, type VideoCitato,
} from '../../lib/spacequant'

// Altezza minima del pannello chiuso (solo maniglia) — anche limite inferiore
// del trascinamento manuale.
const MIN_SHEET_HEIGHT = 60

// Mostrato SOLO finché non è stata fatta ancora nessuna domanda vera (mai
// inviato all'assistente, mai incluso nella cronologia reale) — serve solo a
// far vedere subito come si presenta uno scambio, con le citazioni cliccabili.
const ESEMPIO_CONVERSAZIONE: ChatTurn[] = [
  { ruolo: 'utente', testo: "Cos'è l'R-multiple?" },
  {
    ruolo: 'assistente',
    testo: "L'R-multiple è l'unità con cui la piattaforma misura ogni risultato: 1R corrisponde a quanto rischiavi su quell'operazione. Se entri a 100 e metti lo stop a 98, rischi 2 punti — quello è 1R. Se esci a 104, hai fatto +2R.\n\nSi usa al posto del denaro perché dipende solo dall'idea, non da capitale, percentuale rischiata o valuta del conto: due persone con la stessa strategia vedono cifre diverse in euro, ma lo stesso identico numero in R. Vedi [[Il motore di backtest]] e [[La valuta del conto]].",
  },
]

const CITAZIONE_STILE: React.CSSProperties = { background: 'rgba(90,154,177,0.15)', color: 'var(--ist-accent-text)' }
const CITAZIONE_CLASSE = 'inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-[13px] font-medium transition-opacity hover:opacity-80'

// Converte [[Titolo Nota]] e {{Titolo Video}} in link markdown con uno schema
// finto (nota:/video:) PRIMA di passare il testo a ReactMarkdown: così le
// citazioni convivono correttamente con la formattazione vera anche quando
// annidate (es. **[[Nota]]**) — impossibile con lo split manuale di prima,
// che trattava tutto il resto come testo semplice (da lì gli asterischi
// grezzi lasciati a vista). I titoli finiscono nell'URL con encodeURIComponent
// solo per sicurezza (parentesi/caratteri strani nel titolo non spaccano la
// sintassi del link); il testo visibile del link resta il titolo originale.
function preparaMarkdown(text: string): string {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
      const titolo = inner.split('|')[0].trim()
      return `[${titolo}](nota:${encodeURIComponent(titolo)})`
    })
    .replace(/\{\{([^}]+)\}\}/g, (_, inner: string) => `[${inner.trim()}](video:${encodeURIComponent(inner.trim())})`)
}

// Messaggio dell'assistente: markdown vero (grassetto, elenchi, ecc. — prima
// restavano asterischi/trattini a vista, mai interpretati) + le due citazioni
// custom sopra, intercettate qui nel renderer del link. I video citati
// arrivano SOLO dalla risposta stessa (videoCitati), già validati lato server
// contro l'elenco che quello studente può davvero vedere: un {{Titolo}} che
// non risulta lì (allucinato, o video nel frattempo rimosso) resta testo
// semplice invece di un link rotto.
function MessaggioAssistente({ text, onCiteNota, videoCitati, onCiteVideo }: {
  text: string
  onCiteNota: (titolo: string) => void
  videoCitati: VideoCitato[]
  onCiteVideo: (id: string) => void
}) {
  const videoByTitle = new Map(videoCitati.map(v => [v.title.toLowerCase(), v]))
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
        code: ({ children }) => <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--ist-w8)' }}>{children}</code>,
        a: ({ href, children }) => {
          if (href?.startsWith('nota:')) {
            const titolo = decodeURIComponent(href.slice(5))
            return (
              <button type="button" onClick={() => onCiteNota(titolo)} className={CITAZIONE_CLASSE} style={CITAZIONE_STILE}>
                {children}
              </button>
            )
          }
          if (href?.startsWith('video:')) {
            const v = videoByTitle.get(decodeURIComponent(href.slice(6)).toLowerCase())
            if (!v) return <>{children}</>
            return (
              <button type="button" onClick={() => onCiteVideo(v.id)} className={`${CITAZIONE_CLASSE} gap-1`} style={CITAZIONE_STILE}>
                <PlayCircle size={12} />
                {v.title}
              </button>
            )
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ist-accent-text)', textDecoration: 'underline' }}>{children}</a>
        },
      }}
    >
      {preparaMarkdown(text)}
    </ReactMarkdown>
  )
}

export default function StudentSpaceQuant() {
  const { setHideBottomNav, setHideDownloadPrompt } = useUI()
  const navigate = useNavigate()
  const hasAccess = useSpaceQuantAccess()
  const { nodi, archi, demo, loading: grafoLoading, error: grafoError } = useSpaceQuantGraph()
  const { quotaRestante, setQuotaRestante } = useSpaceQuantQuota()
  const cronologiaSalvata = useSpaceQuantHistory()
  const storicoApplicatoRef = useRef(false)

  const [cronologia, setCronologia] = useState<ChatTurn[]>([])
  const [chatEspansa, setChatEspansa] = useState(false)
  const [input, setInput] = useState('')
  const [inviando, setInviando] = useState(false)
  const [erroreChat, setErroreChat] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messaggiFineRef = useRef<HTMLDivElement>(null)
  const safeBottom = useStableSafeAreaBottom()

  // Stessa identica gestione tastiera della chat normale (ChatPage.tsx), via
  // gli hook condivisi: il contenitore combacia con l'area visibile quando la
  // tastiera è aperta su web/PWA (vp.kbOpen), mentre su nativo iOS il webview
  // non si ridimensiona da solo e va sollevato manualmente (keyboardInset).
  const vp = useVisibleViewport()
  const nativeKbHeight = useNativeKeyboardHeight()
  const nativeKb = nativeKbHeight > 0
  const keyboardInset = nativeKeyboardInset(nativeKbHeight)
  const keyboardOpen = (vp?.kbOpen ?? false) || nativeKb

  // Altezza "aperta" di riposo: normalmente 78vh (unità nativa del browser,
  // corretta quando l'area visibile combacia col viewport). Ma con la
  // tastiera aperta su web/PWA il contenitore radice viene ristretto via JS
  // a vp.height (vedi sotto), mentre vh resta ancorata al viewport INTERO
  // (non si accorcia con la tastiera) — il pannello risulterebbe più alto
  // dell'area visibile e la casella di testo, in fondo, sparirebbe sotto la
  // tastiera. In quel caso calcoliamo il 78% direttamente da vp.height invece
  // di lasciarlo a vh.
  const alturaApertaResa = keyboardOpen && vp ? `${vp.height * 0.78}px` : '78vh'

  // Altezza minima reale: sotto la maniglia riserviamo la safe-area (home
  // indicator su iOS), altrimenti il testo risulta schiacciato in basso.
  const alturaChiusa = MIN_SHEET_HEIGHT + safeBottom

  // Altezza del pannello mentre lo si trascina (segue il dito in tempo reale)
  // — null = usa uno dei due stati fissi (chiusa/aperta). Al rilascio si
  // aggancia SEMPRE a uno dei due punti di ancoraggio (mai una via di mezzo):
  // trascinato verso l'alto abbastanza si apre del tutto, altrimenti si chiude.
  const [chatHeight, setChatHeight] = useState<number | null>(null)
  const colonnaRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startHeight: number; lastHeight: number; moved: boolean } | null>(null)
  const dragListenersRef = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null)
  const suppressClickRef = useRef(false)

  // Il tracking del trascinamento vive su `window`, non su setPointerCapture
  // del singolo bottone: superata la soglia di apertura la maniglia collassata
  // viene smontata e sostituita dall'intestazione espansa (rami JSX diversi),
  // il che spezzerebbe la cattura del puntatore a metà gesto.
  const trascina = (clientY: number) => {
    const drag = dragRef.current
    if (!drag) return
    const deltaY = drag.startY - clientY
    if (!drag.moved && Math.abs(deltaY) < 4) return
    drag.moved = true
    const colonnaH = colonnaRef.current?.getBoundingClientRect().height ?? window.innerHeight
    const headerH = headerRef.current?.getBoundingClientRect().height ?? 0
    const maxHeight = Math.max(alturaChiusa, colonnaH - headerH - 8)
    const nuovaAltezza = Math.min(maxHeight, Math.max(alturaChiusa, drag.startHeight + deltaY))
    drag.lastHeight = nuovaAltezza
    setChatHeight(nuovaAltezza)
    if (!chatEspansa && nuovaAltezza > alturaChiusa + 40) setChatEspansa(true)
  }

  const fineTrascinamento = () => {
    if (dragListenersRef.current) {
      window.removeEventListener('pointermove', dragListenersRef.current.move)
      window.removeEventListener('pointerup', dragListenersRef.current.up)
      window.removeEventListener('pointercancel', dragListenersRef.current.up)
      dragListenersRef.current = null
    }
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.moved) return // nessun trascinamento reale: lascia fare al click (toggle invariato)
    suppressClickRef.current = true
    // Punto di ancoraggio unico: mai una via di mezzo. Superata la soglia a
    // metà strada tra chiusa e aperta si va sempre alla stessa altezza aperta
    // (78vh, quella dei due stati fissi); sotto si richiude — mai ferma
    // esattamente dove è stato rilasciato il dito.
    const colonnaH = colonnaRef.current?.getBoundingClientRect().height ?? window.innerHeight
    const alturaAperta = colonnaH * 0.78
    const soglia = (alturaChiusa + alturaAperta) / 2
    setChatHeight(null)
    setChatEspansa(drag.lastHeight > soglia)
  }

  const iniziaTrascinamento = (e: React.PointerEvent) => {
    const startHeight = sheetRef.current?.getBoundingClientRect().height
      ?? (chatEspansa ? window.innerHeight * 0.78 : alturaChiusa)
    dragRef.current = { startY: e.clientY, startHeight, lastHeight: startHeight, moved: false }
    const move = (ev: PointerEvent) => trascina(ev.clientY)
    const up = () => fineTrascinamento()
    dragListenersRef.current = { move, up }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  useEffect(() => () => {
    if (dragListenersRef.current) {
      window.removeEventListener('pointermove', dragListenersRef.current.move)
      window.removeEventListener('pointerup', dragListenersRef.current.up)
      window.removeEventListener('pointercancel', dragListenersRef.current.up)
    }
  }, [])

  const alterna = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    setChatHeight(null)
    setChatEspansa(v => !v)
  }
  const inTrascinamento = !!dragRef.current?.moved

  useEffect(() => {
    setHideBottomNav(true)
    setHideDownloadPrompt(true)
    return () => { setHideBottomNav(false); setHideDownloadPrompt(false) }
  }, [setHideBottomNav, setHideDownloadPrompt])

  // Applica la cronologia salvata UNA SOLA VOLTA, appena arriva — ma solo se
  // non è già in corso una conversazione (l'utente potrebbe aver scritto
  // prima che il caricamento finisse): senza il controllo su c.length,
  // sovrascriverebbe quello che ha appena mandato.
  useEffect(() => {
    if (cronologiaSalvata !== null && !storicoApplicatoRef.current) {
      storicoApplicatoRef.current = true
      if (cronologiaSalvata.length > 0) {
        setCronologia(c => c.length === 0 ? cronologiaSalvata : c)
      }
    }
  }, [cronologiaSalvata])

  // Nessuna domanda vera fatta ancora: mostra l'esempio (mai inviato
  // all'assistente, mai nella cronologia reale che va all'API).
  const messaggi = cronologia.length > 0 ? cronologia : ESEMPIO_CONVERSAZIONE
  const isEsempio = cronologia.length === 0

  // Anche sulla lunghezza dell'ULTIMO messaggio (non solo sul numero di
  // messaggi): durante lo streaming il testo cresce dentro lo stesso
  // messaggio, senza che se ne aggiunga uno nuovo all'array — senza questo la
  // vista non seguirebbe la risposta mentre si genera. 'auto' invece di
  // 'smooth': con 'smooth' ogni chunk metterebbe in coda una sua animazione,
  // risultando a scatti invece che fluido.
  useEffect(() => {
    if (chatEspansa) messaggiFineRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messaggi.length, messaggi[messaggi.length - 1]?.testo.length, chatEspansa])

  // Click su una citazione [[Nota]] dentro un messaggio (il grafo è
  // puramente decorativo ora, non genera più domande al tocco di un nodo).
  const handleCitaNota = (titolo: string) => {
    setChatEspansa(true)
    setInput(`Spiegami: ${titolo}`)
    setTimeout(() => inputRef.current?.focus(), 50) // dopo l'animazione di apertura
  }

  const handleVideoClick = (lessonId: string) => {
    navigate(`/student/corsi/lezione/${lessonId}`)
  }

  const esaurita = quotaRestante === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const domanda = input.trim()
    if (!domanda || inviando || esaurita) return

    setInviando(true)
    setErroreChat(null)
    setInput('')
    const cronologiaPrecedente = cronologia
    // Placeholder vuoto subito in cronologia: niente spinner separato, la
    // risposta si vede crescere direttamente al posto suo mentre arriva.
    setCronologia(c => [...c, { ruolo: 'utente', testo: domanda }, { ruolo: 'assistente', testo: '' }])

    const res = await askSpaceQuant(domanda, cronologiaPrecedente, (testoParziale) => {
      setCronologia(c => {
        const next = c.slice()
        next[next.length - 1] = { ruolo: 'assistente', testo: testoParziale }
        return next
      })
    })
    setInviando(false)

    if (!res.ok) {
      setCronologia(c => c.slice(0, -1)) // via il placeholder vuoto, la domanda resta visibile
      setErroreChat(
        res.error.motivo === 'quota_esaurita' ? 'Hai esaurito le domande di questo mese.'
        : res.error.motivo === 'rate_limit' ? 'Troppe domande ravvicinate — aspetta un momento.'
        : res.error.error,
      )
      if (typeof res.error.quotaRestante === 'number') setQuotaRestante(res.error.quotaRestante)
      return
    }

    setCronologia(c => {
      const next = c.slice()
      next[next.length - 1] = { ruolo: 'assistente', testo: res.result.risposta, videoCitati: res.result.videoCitati }
      return next
    })
    if (!Number.isNaN(res.result.quotaRestante)) setQuotaRestante(res.result.quotaRestante)
  }

  // Beta ristretta: mentre l'accesso è in verifica non mostrare nulla (evita
  // un flash del contenuto); se negato, via silenziosamente alla dashboard —
  // la voce di menu è già nascosta, quindi chi arriva qui a mano non deve
  // vedere un messaggio che riveli l'esistenza della sezione.
  if (hasAccess === null) {
    return (
      <div className="fixed inset-0 z-10 flex items-center justify-center" style={{ background: 'var(--ist-nav-bg)' }}>
        <Loader2 className="animate-spin" size={22} style={{ color: 'var(--ist-text-dim)' }} />
      </div>
    )
  }
  if (hasAccess === false) return <Navigate to="/student" replace />

  return (
    // Sfondo a schermo intero (nessun margine): si estende anche dietro la
    // sidebar desktop, che è un pannello fluttuante con z-index più alto e vi
    // galleggia sopra — così non c'è più uno stacco di colore a sinistra.
    <div
      className="fixed inset-0 z-10 overflow-hidden"
      style={{
        background: 'var(--ist-nav-bg)',
        // Stesso meccanismo di ChatPage.tsx: su web/PWA con tastiera aperta
        // (non su nativo, dove il webview non si ridimensiona) il contenitore
        // combacia con l'area realmente visibile, altrimenti resterebbe
        // "sotto" la tastiera invece di restringersi sopra di essa.
        ...(vp?.kbOpen && !nativeKb ? { top: vp.top, height: vp.height, bottom: 'auto' } : null),
      }}
    >
      <div
        ref={colonnaRef}
        className="flex flex-col h-full lg:pl-[108px]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div
          ref={headerRef}
          className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--ist-w8)' }}
        >
          <button
            type="button"
            onClick={() => navigate('/student')}
            className="lg:hidden -ml-1 mr-0.5 p-1 transition-opacity hover:opacity-70"
            aria-label="Torna alla dashboard"
          >
            <ChevronLeft size={20} strokeWidth={2.5} style={{ color: 'var(--ist-text)' }} />
          </button>
          <QuantBrainIcon size={20} style={{ color: 'var(--ist-accent-text)' }} />
          <h1 className="font-semibold text-[15px]" style={{ color: 'var(--ist-text)' }}>Quant-Brain</h1>
        </div>

        {/* Il grafo occupa sempre lo spazio rimanente (flex-1): quando la chat
            sotto si espande, questo spazio si riduce da solo — nessun calcolo
            manuale di percentuali. Con la chat aperta il grafo praticamente
            sparisce, così non resta "come sfondo" mentre si chatta. */}
        <div className="flex-1 min-h-0 relative">
          {grafoLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="animate-spin" size={22} style={{ color: 'var(--ist-text-dim)' }} />
            </div>
          ) : grafoError ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px]" style={{ color: 'var(--ist-text-dim)' }}>
              {grafoError}
            </div>
          ) : (
            <>
              <KnowledgeGraph nodi={nodi} archi={archi} pensando={inviando} />
              {demo && (
                <div
                  className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-border)', color: 'var(--ist-text-dim)' }}
                >
                  Anteprima con dati dimostrativi
                </div>
              )}
            </>
          )}
        </div>

        {/* Pannello a scomparsa ("bottom sheet"): collassato è solo una
            maniglia con un invito a scrivere (grafo interamente visibile
            sopra); espanso copre quasi tutto lo schermo con sfondo pieno e la
            conversazione vera e propria — non il grafo "come sfondo". */}
        <div
          ref={sheetRef}
          className="flex-shrink-0 w-full flex flex-col overflow-hidden"
          style={{
            height: chatHeight !== null ? `${chatHeight}px` : (chatEspansa ? alturaApertaResa : `${alturaChiusa}px`),
            background: 'var(--ist-nav-bg)',
            borderTop: '1px solid var(--ist-w8)',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: chatEspansa ? '0 -8px 30px rgba(0,0,0,0.25)' : 'none',
            transition: inTrascinamento ? 'none' : 'height 300ms ease-out',
          }}
        >
          {chatEspansa ? (
            <>
              <button
                type="button"
                onClick={alterna}
                onPointerDown={iniziaTrascinamento}
                style={{ touchAction: 'none' }}
                className="relative flex items-center gap-2 px-4 pt-2.5 pb-2 flex-shrink-0 w-full text-left cursor-grab active:cursor-grabbing"
                aria-label="Trascina o tocca per ridurre la chat"
              >
                <span className="w-9 h-1 rounded-full absolute left-1/2 -translate-x-1/2 top-1.5" style={{ background: 'var(--ist-w20)' }} />
                <MessageCircle size={16} style={{ color: 'var(--ist-accent-text)' }} />
                <span className="font-semibold text-[13.5px]" style={{ color: 'var(--ist-text)' }}>Chiedi all'assistente</span>
                <span className="ml-auto flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--ist-text-dim)' }}>
                  {quotaRestante !== null && `${quotaRestante} domande rimaste`}
                  <ChevronDown size={16} />
                </span>
              </button>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 flex flex-col gap-3.5">
                {isEsempio && (
                  <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--ist-text-dim)' }}>
                    Esempio
                  </p>
                )}
                {messaggi.map((m, i) => (
                  <div key={i} className={m.ruolo === 'utente' ? 'self-end max-w-[85%]' : 'max-w-[92%]'}>
                    <p
                      className="text-[10.5px] font-medium mb-0.5 px-1"
                      style={{ color: 'var(--ist-text-dim)' }}
                    >
                      {m.ruolo === 'utente' ? 'Tu' : 'Assistente'}
                    </p>
                    <div
                      className="px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed"
                      style={
                        m.ruolo === 'utente'
                          ? { background: 'var(--ist-w8)', color: 'var(--ist-text)' }
                          : { color: 'var(--ist-text)' }
                      }
                    >
                      {m.ruolo === 'utente' ? m.testo : (
                        <MessaggioAssistente text={m.testo} onCiteNota={handleCitaNota} videoCitati={m.videoCitati ?? []} onCiteVideo={handleVideoClick} />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messaggiFineRef} />
              </div>

              {erroreChat && (
                <p className="px-4 pt-1 text-[12.5px] flex-shrink-0" style={{ color: '#e34948' }}>{erroreChat}</p>
              )}

              <form
                onSubmit={handleSubmit}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 pt-3"
                style={{
                  // Stessa formula della chat normale: tastiera chiusa → 12px
                  // + safe-area; aperta su iOS nativo (webview non si
                  // ridimensiona da solo) → si solleva di keyboardInset;
                  // aperta su web/Android (il contenitore è già la giusta
                  // area visibile) → basta il gap fisso, altrimenti si
                  // sommerebbe due volte la stessa compensazione.
                  paddingBottom: keyboardOpen ? (keyboardInset > 0 ? keyboardInset + 12 : 12) : 12 + safeBottom,
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={esaurita}
                  placeholder={esaurita ? 'Quota mensile esaurita' : 'Scrivi una domanda…'}
                  className="flex-1 min-w-0 px-3.5 py-2 rounded-full text-[13.5px] outline-none disabled:opacity-50"
                  style={{ background: 'var(--ist-w8)', border: '1px solid var(--ist-border)', color: 'var(--ist-text)' }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || inviando || esaurita}
                  className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)' }}
                >
                  {inviando ? <Loader2 className="animate-spin" size={15} /> : <ArrowUp size={15} />}
                </button>
              </form>
            </>
          ) : (
            <button
              type="button"
              onClick={alterna}
              onPointerDown={iniziaTrascinamento}
              style={{ touchAction: 'none', paddingBottom: safeBottom }}
              className="relative flex items-center gap-2 px-4 h-full w-full text-left cursor-grab active:cursor-grabbing"
            >
              <span className="w-9 h-1 rounded-full absolute left-1/2 -translate-x-1/2 top-2" style={{ background: 'var(--ist-w20)' }} />
              <MessageCircle size={16} style={{ color: 'var(--ist-accent-text)' }} />
              <span className="text-[13.5px]" style={{ color: 'var(--ist-text-dim)' }}>Chiedi qualcosa sul modello quantitativo…</span>
              <span className="ml-auto flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--ist-text-dim)' }}>
                {quotaRestante !== null && `${quotaRestante} domande`}
                <ChevronUp size={16} />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
