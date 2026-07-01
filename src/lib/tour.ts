import { driver, type Driver } from 'driver.js'
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
  '__more__': { title: '➕ Altro', description: 'Da qui apri tutte le altre sezioni. Apriamole e diamo un’occhiata 👇' },
}

// Ordine "canonico" delle sezioni (come in USE_NAV): usato su mobile per elencare
// le voci dentro il pannello "Altro" (che all'avvio non sono ancora nel DOM).
const ORDER = [
  '/student', '/student/percorso', '/student/corsi', '/student/diario',
  '/student/compiti', '/student/chat', '/student/mental-coach', '/student/live',
  '/student/calendario', '/student/progressi', '/student/journal',
]

type Step = { element: HTMLElement | string; popover: Record<string, unknown> }

// Avvia il tour interattivo evidenziando le sezioni. Su desktop percorre la
// sidebar; su mobile percorre la barra in basso, poi APRE il pannello "Altro" e
// continua con le sezioni interne — così è completo come su desktop.
export function startPlatformTour(onDone?: () => void) {
  const visible = Array.from(document.querySelectorAll<HTMLElement>('[data-tour]'))
    .filter(el => el.offsetParent !== null)

  const visibleKeys: string[] = []
  const elByKey = new Map<string, HTMLElement>()
  for (const el of visible) {
    const k = el.getAttribute('data-tour') || ''
    if (!visibleKeys.includes(k)) { visibleKeys.push(k); elByKey.set(k, el) }
  }

  const isMobile = visibleKeys.includes('__more__')
  let d: Driver
  const steps: Step[] = []

  const pushSection = (key: string, element: HTMLElement | string) => {
    if (SECTIONS[key]) steps.push({ element, popover: { ...SECTIONS[key] } })
  }

  if (isMobile) {
    const barKeys = visibleKeys.filter(k => k !== '__more__')
    // 1) voci della barra in basso
    barKeys.forEach(k => pushSection(k, elByKey.get(k)!))
    // 2) "Altro": alla pressione di Avanti apre il pannello e prosegue
    steps.push({
      element: elByKey.get('__more__')!,
      popover: {
        ...SECTIONS['__more__'],
        onNextClick: () => {
          window.dispatchEvent(new Event('ist:tour-open-more'))
          setTimeout(() => d.moveNext(), 450)
        },
      },
    })
    // 3) voci dentro il pannello "Altro" (per selettore: risolte a runtime)
    ORDER.filter(k => !barKeys.includes(k)).forEach(k => pushSection(k, `[data-tour="${k}"]`))
  } else {
    // desktop: tutte le voci della sidebar in ordine
    visibleKeys.filter(k => k !== '__more__').forEach(k => pushSection(k, elByKey.get(k)!))
  }

  if (steps.length === 0) return

  d = driver({
    showProgress: true,
    popoverClass: 'ist-tour',
    disableActiveInteraction: true, // durante il tour non si clicca l'elemento evidenziato
    progressText: '{{current}} di {{total}}',
    nextBtnText: 'Avanti',
    prevBtnText: 'Indietro',
    doneBtnText: 'Fine',
    steps,
    onDestroyStarted: () => {
      window.dispatchEvent(new Event('ist:tour-close-more')) // richiudi "Altro"
      if (!d.hasNextStep()) onDone?.()                        // completato solo se all'ultimo step
      d.destroy()
    },
  })
  d.drive()
}
