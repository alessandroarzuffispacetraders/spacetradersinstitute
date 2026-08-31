import { useEffect, useRef, useState, Fragment } from 'react'
import { ArrowUp, Loader2, Network } from 'lucide-react'
import { useUI } from '../../context/UIContext'
import KnowledgeGraph from '../../components/spacequant/KnowledgeGraph'
import {
  useSpaceQuantGraph, useSpaceQuantQuota, askSpaceQuant, type ChatTurn,
} from '../../lib/spacequant'

// Trasforma [[Titolo]] in badge cliccabili (precompila una nuova domanda),
// il resto resta testo semplice — niente dipendenza markdown per questa v1.
function renderWithCitations(text: string, onCite: (titolo: string) => void) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[\[([^\]]+)\]\]$/)
    if (!m) return <Fragment key={i}>{part.split('\n').map((line, j) => <Fragment key={j}>{j > 0 && <br />}{line}</Fragment>)}</Fragment>
    const titolo = m[1].split('|')[0].trim()
    return (
      <button
        key={i}
        type="button"
        onClick={() => onCite(titolo)}
        className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-[13px] font-medium transition-opacity hover:opacity-80"
        style={{ background: 'rgba(90,154,177,0.15)', color: 'var(--ist-accent-text)' }}
      >
        {titolo}
      </button>
    )
  })
}

export default function StudentSpaceQuant() {
  const { setHideBottomNav } = useUI()
  const { nodi, archi, loading: grafoLoading, error: grafoError } = useSpaceQuantGraph()
  const { quotaRestante, setQuotaRestante } = useSpaceQuantQuota()

  const [cronologia, setCronologia] = useState<ChatTurn[]>([])
  const [ultimaRisposta, setUltimaRisposta] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [inviando, setInviando] = useState(false)
  const [erroreChat, setErroreChat] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHideBottomNav(true)
    return () => setHideBottomNav(false)
  }, [setHideBottomNav])

  const handleNodeClick = (titolo: string) => {
    setInput(`Spiegami: ${titolo}`)
    inputRef.current?.focus()
  }

  const esaurita = quotaRestante === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const domanda = input.trim()
    if (!domanda || inviando || esaurita) return

    setInviando(true)
    setErroreChat(null)
    setInput('')

    const res = await askSpaceQuant(domanda, cronologia)
    setInviando(false)

    if (!res.ok) {
      setErroreChat(
        res.error.motivo === 'quota_esaurita' ? 'Hai esaurito le domande di questo mese.'
        : res.error.motivo === 'rate_limit' ? 'Troppe domande ravvicinate — aspetta un momento.'
        : res.error.error,
      )
      if (typeof res.error.quotaRestante === 'number') setQuotaRestante(res.error.quotaRestante)
      return
    }

    setCronologia(c => [...c, { ruolo: 'utente', testo: domanda }, { ruolo: 'assistente', testo: res.result.risposta }])
    setUltimaRisposta(res.result.risposta)
    setQuotaRestante(res.result.quotaRestante)
  }

  return (
    <div
      className="flex flex-col overflow-hidden fixed inset-0 z-10 lg:ml-[108px]"
      style={{ background: 'var(--ist-nav-bg)', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--ist-w8)' }}
      >
        <Network size={20} style={{ color: 'var(--ist-accent-text)' }} />
        <h1 className="font-semibold text-[15px]" style={{ color: 'var(--ist-text)' }}>SpaceQuant</h1>
        <span className="ml-auto text-[12px]" style={{ color: 'var(--ist-text-dim)' }}>
          {quotaRestante === null ? '' : `Ti restano ${quotaRestante} domande questo mese`}
        </span>
      </div>

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
          <KnowledgeGraph nodi={nodi} archi={archi} onNodeClick={handleNodeClick} />
        )}
      </div>

      <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--ist-w8)', maxHeight: '40%' }}>
        {ultimaRisposta && (
          <div className="px-4 pt-3 overflow-y-auto text-[14px] leading-relaxed" style={{ color: 'var(--ist-text)', maxHeight: 'calc(40vh - 64px)' }}>
            {renderWithCitations(ultimaRisposta, handleNodeClick)}
          </div>
        )}

        {erroreChat && (
          <p className="px-4 pt-2 text-[13px]" style={{ color: '#e34948' }}>{erroreChat}</p>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={esaurita}
            placeholder={esaurita ? 'Quota mensile esaurita' : 'Scrivi una domanda sul modello quantitativo…'}
            className="flex-1 px-4 py-3 rounded-2xl outline-none disabled:opacity-50"
            style={{ background: 'var(--ist-w8)', border: '1px solid var(--ist-border)', color: 'var(--ist-text)' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || inviando || esaurita}
            className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)' }}
          >
            {inviando ? <Loader2 className="animate-spin" size={18} /> : <ArrowUp size={18} />}
          </button>
        </form>
      </div>
    </div>
  )
}
