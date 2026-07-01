import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './tour.css'

// Descrizione di ogni sezione, per chiave = path della voce di nav.
const SECTIONS: Record<string, { title: string; description: string }> = {
  '/student': { title: '🏠 Home', description: 'Il tuo punto di partenza: da qui vedi i primi passi, le live e i messaggi.' },
  '/student/percorso': { title: '🗺️ Percorso', description: 'Il tuo programma passo-passo diviso in fasi. Qui vedi cosa hai completato e cosa manca.' },
  '/student/corsi': { title: '🎬 Videocorsi', description: 'Tutte le lezioni video del programma, organizzate per categoria e corso.' },
  '/student/diario': { title: '📓 Diario', description: 'Annota le tue giornate di trading: uno spazio privato solo tuo.' },
  '/student/compiti': { title: '📋 Compiti', description: 'I compiti assegnati dal coach: consegni note e immagini e ricevi il feedback.' },
  '/student/chat': { title: '💬 Community', description: 'I canali della community e i messaggi privati con coach e mental coach.' },
  '/student/mental-coach': { title: '🧠 Mental Coach', description: 'Materiali utili e la tua checklist per il lavoro mentale, più le sessioni.' },
  '/student/live': { title: '🔴 Live & Replay', description: 'Le dirette Zoom e le registrazioni delle sessioni.' },
  '/student/calendario': { title: '📅 Calendario', description: 'Il calendario delle live, così non ti perdi nulla.' },
  '/student/progressi': { title: '📈 Progressi', description: 'I tuoi badge e traguardi raggiunti man mano che avanzi.' },
  '/student/journal': { title: '🔗 Protocol Journal', description: 'Lo strumento esterno per tracciare le tue performance di trading.' },
  '__more__': { title: '➕ Altro', description: 'Tocca qui per aprire tutte le altre sezioni della piattaforma.' },
}

// Avvia il tour interattivo evidenziando le voci di nav VISIBILI (si adatta a
// desktop/mobile). onDone viene chiamato quando l'utente completa il tour.
export function startPlatformTour(onDone?: () => void) {
  const seen = new Set<string>()
  const steps: { element: HTMLElement; popover: { title: string; description: string } }[] = []

  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-tour]'))) {
    if (el.offsetParent === null) continue // salta gli elementi nascosti (es. sidebar su mobile)
    const key = el.getAttribute('data-tour') || ''
    if (seen.has(key)) continue
    const info = SECTIONS[key]
    if (!info) continue
    seen.add(key)
    steps.push({ element: el, popover: info })
  }

  // Nessun elemento nav trovato (es. non ancora renderizzato): non marcare come
  // completato, così resta il reminder.
  if (steps.length === 0) return

  const d = driver({
    showProgress: true,
    popoverClass: 'ist-tour',
    progressText: '{{current}} di {{total}}',
    nextBtnText: 'Avanti',
    prevBtnText: 'Indietro',
    doneBtnText: 'Fine',
    steps,
    onDestroyStarted: () => {
      // Completato solo se si è arrivati all'ultimo step.
      if (!d.hasNextStep()) onDone?.()
      d.destroy()
    },
  })
  d.drive()
}
