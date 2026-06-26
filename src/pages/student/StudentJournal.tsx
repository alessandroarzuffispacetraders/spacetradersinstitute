import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { ExternalLink } from 'lucide-react'

export default function StudentJournal() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Protocol Data Journal" subtitle="Strumento esterno per il tracking delle performance" />

      <Card className="p-8 text-center" premium>
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5"
          style={{
            background: 'rgba(90,154,177,0.16)',
            border: '1px solid rgba(124,187,208,0.28)',
          }}
        >
          <ExternalLink size={28} strokeWidth={1.5} className="text-ist-300" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Protocol Data Journal</h2>
        <p className="text-sm leading-relaxed mb-6 max-w-sm mx-auto" style={{ color: '#8495A3' }}>
          Il Protocol Data Journal è uno strumento esterno per documentare e analizzare le tue performance di trading in modo approfondito.
        </p>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="inline-flex items-center gap-2 px-6 py-3 text-white font-bold text-sm rounded-full transition-all hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)',
            border: '1px solid var(--ist-w14)',
            boxShadow: '0 14px 40px rgba(40,102,128,0.36)',
          }}
        >
          Apri Protocol Data Journal
          <ExternalLink size={14} strokeWidth={2} />
        </a>
        <p className="text-xs mt-4" style={{ color: '#56636F' }}>Si apre in una nuova scheda</p>
      </Card>
    </div>
  )
}
