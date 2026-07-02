import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import PreviewLock from './PreviewLock'
import { DecoyPercorso, DecoyCompiti, DecoyMentalCoach, DecoyLive, DecoyCalendario, DecoyDiario, DecoyJournal } from './LockedDecoys'

// Per ogni sezione riservata: quale anteprima esca mostrare e con che testo di
// upsell. L'ordine conta: match sul prefisso più lungo per primo.
const SECTIONS: { prefix: string; title: string; body: string; decoy: ReactNode }[] = [
  { prefix: '/student/percorso', title: 'Sblocca il tuo percorso 1:1',
    body: 'Il programma guidato in 90 giorni con coach dedicato fa parte della versione completa. Questa è solo un\'anteprima.', decoy: <DecoyPercorso /> },
  { prefix: '/student/mental-coach', title: 'Sblocca il mental coach',
    body: 'Sessioni, materiali e checklist del percorso mentale sono riservati alla versione completa. Questa è solo un\'anteprima.', decoy: <DecoyMentalCoach /> },
  { prefix: '/student/compiti', title: 'Sblocca compiti e review',
    body: 'Gli esercizi assegnati dal coach e le review personalizzate fanno parte della versione completa. Questa è solo un\'anteprima.', decoy: <DecoyCompiti /> },
  { prefix: '/student/live', title: 'Sblocca le live e i replay',
    body: 'Le sessioni in diretta e le registrazioni sono riservate alla versione completa. Questa è solo un\'anteprima.', decoy: <DecoyLive /> },
  { prefix: '/student/calendario', title: 'Sblocca il calendario delle live',
    body: 'Il calendario degli appuntamenti in diretta è riservato alla versione completa. Questa è solo un\'anteprima.', decoy: <DecoyCalendario /> },
  { prefix: '/student/diario', title: 'Sblocca il diario di trading',
    body: 'Il diario per tracciare sessioni, risultati ed emozioni fa parte della versione completa. Questa è solo un\'anteprima.', decoy: <DecoyDiario /> },
  { prefix: '/student/journal', title: 'Sblocca il Protocol Data Journal',
    body: 'Lo strumento avanzato di analisi delle performance è riservato alla versione completa. Questa è solo un\'anteprima.', decoy: <DecoyJournal /> },
]

export default function LockedSection() {
  const { pathname } = useLocation()
  const section =
    SECTIONS.find(s => pathname === s.prefix || pathname.startsWith(s.prefix + '/')) ?? SECTIONS[0]

  return (
    <PreviewLock title={section.title} body={section.body}>
      {section.decoy}
    </PreviewLock>
  )
}
