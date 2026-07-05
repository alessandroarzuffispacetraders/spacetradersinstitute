import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import PreviewLock from './PreviewLock'
import LockedNotice from './LockedNotice'
import { upsellSuppressed } from '../../lib/freeTier'
import { PreviewProvider } from '../../lib/previewMode'
import StudentPercorso from '../../pages/student/StudentPercorso'
import StudentMentalCoach from '../../pages/student/StudentMentalCoach'
import StudentCompiti from '../../pages/student/StudentCompiti'
import StudentLive from '../../pages/student/StudentLive'
import StudentCalendario from '../../pages/student/StudentCalendario'
import StudentDiario from '../../pages/student/StudentDiario'
import StudentJournal from '../../pages/student/StudentJournal'

// Per ogni sezione riservata: la PAGINA REALE (mostrata in modalità anteprima,
// con dati finti) e il testo di upsell. Riusando la pagina vera, l'anteprima
// resta sempre identica e si aggiorna da sola quando modifichi la pagina.
// `name` = etichetta NEUTRA usata su iOS (senza "Sblocca...", vietato — 3.1.1).
// L'ordine conta: match sul prefisso più lungo per primo.
const SECTIONS: { prefix: string; name: string; title: string; body: string; page: ReactNode }[] = [
  { prefix: '/student/percorso', name: 'Percorso 1:1', title: 'Sblocca il tuo percorso 1:1',
    body: 'Il programma guidato in 90 giorni con coach dedicato fa parte della versione completa. Questa è solo un\'anteprima.', page: <StudentPercorso /> },
  { prefix: '/student/mental-coach', name: 'Mental coach', title: 'Sblocca il mental coach',
    body: 'Sessioni, materiali e checklist del percorso mentale sono riservati alla versione completa. Questa è solo un\'anteprima.', page: <StudentMentalCoach /> },
  { prefix: '/student/compiti', name: 'Compiti e review', title: 'Sblocca compiti e review',
    body: 'Gli esercizi assegnati dal coach e le review personalizzate fanno parte della versione completa. Questa è solo un\'anteprima.', page: <StudentCompiti /> },
  { prefix: '/student/live', name: 'Live e replay', title: 'Sblocca le live e i replay',
    body: 'Le sessioni in diretta e le registrazioni sono riservate alla versione completa. Questa è solo un\'anteprima.', page: <StudentLive /> },
  { prefix: '/student/calendario', name: 'Calendario delle live', title: 'Sblocca il calendario delle live',
    body: 'Il calendario degli appuntamenti in diretta è riservato alla versione completa. Questa è solo un\'anteprima.', page: <StudentCalendario /> },
  { prefix: '/student/diario', name: 'Diario di trading', title: 'Sblocca il diario di trading',
    body: 'Il diario per tracciare sessioni, risultati ed emozioni fa parte della versione completa. Questa è solo un\'anteprima.', page: <StudentDiario /> },
  { prefix: '/student/journal', name: 'Protocol Data Journal', title: 'Sblocca il Protocol Data Journal',
    body: 'Lo strumento avanzato di analisi delle performance è riservato alla versione completa. Questa è solo un\'anteprima.', page: <StudentJournal /> },
]

export default function LockedSection() {
  const { pathname } = useLocation()
  const section =
    SECTIONS.find(s => pathname === s.prefix || pathname.startsWith(s.prefix + '/')) ?? SECTIONS[0]

  // iOS: niente preview-esca né popup di upsell (Guideline 3.1.1). Mostriamo un
  // avviso neutro; la sezione resta comunque visibile nel menu. Il contenuto
  // vero non viene mai montato/fetchato per il free (gating server-side).
  if (upsellSuppressed()) {
    return <LockedNotice title={section.name} />
  }

  // key = prefisso della sezione: cambiando sezione bloccata, PreviewLock si
  // rimonta e il timer del popup riparte.
  // pointer-events:none → la pagina si vede "abilitata" ma è inerte (nessun
  // click/navigazione/mutazione). PreviewProvider → gli hook danno dati finti.
  return (
    <PreviewLock key={section.prefix} title={section.title} body={section.body}>
      <PreviewProvider>
        <div aria-hidden="true" style={{ pointerEvents: 'none' }}>
          {section.page}
        </div>
      </PreviewProvider>
    </PreviewLock>
  )
}
