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
}

// Ordine "canonico" delle sezioni (come in USE_NAV).
const ORDER = [
  '/student', '/student/percorso', '/student/corsi', '/student/diario',
  '/student/compiti', '/student/chat', '/student/mental-coach', '/student/live',
  '/student/calendario', '/student/progressi', '/student/journal',
]
// Voci sempre presenti nella barra in basso su mobile (le altre stanno in "Altro").
const MOBILE_PRIMARY = ['/student', '/student/corsi', '/student/chat', '/student/live']

type Step = { element: HTMLElement; popover: Record<string, unknown> }

function runTour(onDone: (() => void) | undefined, mobile: boolean) {
  // Mappa chiave→elemento dai [data-tour] VISIBILI ora (su mobile il pannello
  // "Altro" è già aperto, quindi ci sono sia la barra sia le voci interne).
  const byKey = new Map<string, HTMLElement>()
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-tour]'))) {
    if (el.offsetParent === null) continue
    const k = el.getAttribute('data-tour') || ''
    if (k && k !== '__more__' && !byKey.has(k)) byKey.set(k, el)
  }

  // Ordine: mobile = prima la barra, poi le voci di "Altro"; desktop = ordine canonico.
  const keys = mobile ? [...MOBILE_PRIMARY, ...ORDER.filter(k => !MOBILE_PRIMARY.includes(k))] : ORDER

  const steps: Step[] = []
  for (const k of keys) {
    const el = byKey.get(k)
    if (el && SECTIONS[k]) steps.push({ element: el, popover: { ...SECTIONS[k] } })
  }

  if (steps.length === 0) {
    if (mobile) window.dispatchEvent(new Event('ist:tour-close-more'))
    return // nessun elemento: non marcare completato, resta il reminder
  }

  let d: Driver
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
      if (mobile) window.dispatchEvent(new Event('ist:tour-close-more')) // richiudi "Altro"
      if (!d.hasNextStep()) onDone?.()                                   // completato solo all'ultimo step
      d.destroy()
    },
  })
  d.drive()
}

// Avvia il tour. Desktop: percorre la sidebar. Mobile: apre prima il pannello
// "Altro" (così barra + voci interne sono tutte presenti) e le percorre tutte.
export function startPlatformTour(onDone?: () => void) {
  const moreBtn = document.querySelector<HTMLElement>('[data-tour="__more__"]')
  const isMobile = !!moreBtn && moreBtn.offsetParent !== null

  if (isMobile) {
    window.dispatchEvent(new Event('ist:tour-open-more'))
    // aspetta il render + animazione dello sheet, poi costruisci il tour sui veri elementi
    setTimeout(() => runTour(onDone, true), 400)
  } else {
    runTour(onDone, false)
  }
}
