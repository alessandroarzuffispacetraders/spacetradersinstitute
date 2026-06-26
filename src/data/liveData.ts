export type LiveStatus = 'live' | 'upcoming' | 'replay'
export type LiveRole = 'student' | 'coach' | 'mental_coach' | 'admin'

export interface LiveEvent {
  id: string
  title: string
  host: string
  hostRole: LiveRole
  status: LiveStatus
  date: string
  duration?: string
  viewers?: number
  views?: number
  description: string
  accent: string
  accentEnd: string
}

export interface LiveChatMessage {
  id: string
  authorId: string
  author: string
  authorRole: LiveRole
  text: string
  ts: number
  own?: boolean
}

export const LIVE_EVENTS: LiveEvent[] = [
  {
    id: 'live-1',
    title: 'Analisi mercati settimanale',
    host: 'Laura Bianchi',
    hostRole: 'coach',
    status: 'live',
    date: 'Ora in diretta',
    viewers: 31,
    description: 'Analisi dei principali mercati: Forex, oro e indici. Review dei setup della settimana e outlook per la prossima. Portate le vostre domande!',
    accent: '#7CBBD0',
    accentEnd: '#286680',
  },
  {
    id: 'live-2',
    title: 'Q&A Psicologia del Trading',
    host: 'Sofia Verdi',
    hostRole: 'mental_coach',
    status: 'upcoming',
    date: 'Lun 8 Lug · 19:30',
    description: 'Sessione dedicata alla psicologia e al mindset. Porteremo casi reali di gestione emotiva, bias cognitivi e come costruire una routine vincente.',
    accent: '#A078FF',
    accentEnd: '#5C34C4',
  },
  {
    id: 'live-3',
    title: 'Masterclass: Smart Money Concepts',
    host: 'Laura Bianchi',
    hostRole: 'coach',
    status: 'upcoming',
    date: 'Ven 12 Lug · 17:00',
    description: 'Approfondimento completo sui concetti SMC: order blocks, FVG, BOS/CHoCH e come operare seguendo il flusso istituzionale.',
    accent: '#F6C85F',
    accentEnd: '#C4941A',
  },
  {
    id: 'replay-1',
    title: 'Webinar: EUR/USD — Setup avanzati',
    host: 'Laura Bianchi',
    hostRole: 'coach',
    status: 'replay',
    date: '20 Giu 2026',
    duration: '1h 24 min',
    views: 47,
    description: 'Analisi approfondita degli setup su EUR/USD: entry, gestione del trade e uscita. Con esempi pratici dal mercato reale.',
    accent: '#7CBBD0',
    accentEnd: '#286680',
  },
  {
    id: 'replay-2',
    title: 'Analisi settimanale #8',
    host: 'Laura Bianchi',
    hostRole: 'coach',
    status: 'replay',
    date: '13 Giu 2026',
    duration: '58 min',
    views: 63,
    description: 'Review dei mercati nella settimana 24: NFP, dati inflazione e impatto sui principali cross Forex.',
    accent: '#7CBBD0',
    accentEnd: '#286680',
  },
  {
    id: 'replay-3',
    title: 'Mindset: Come gestire le drawdown',
    host: 'Sofia Verdi',
    hostRole: 'mental_coach',
    status: 'replay',
    date: '6 Giu 2026',
    duration: '47 min',
    views: 81,
    description: 'Come reagire emotivamente alle perdite, mantenere la disciplina nelle drawdown e tornare operativi con lucidità.',
    accent: '#A078FF',
    accentEnd: '#5C34C4',
  },
]

export const LIVE_CHAT_SEED: LiveChatMessage[] = [
  { id: 'lc-1', authorId: 'u-admin', author: 'Admin IST', authorRole: 'admin', text: '🎙️ La live inizia adesso! Benvenuti tutti.', ts: Date.now() - 480000 },
  { id: 'lc-2', authorId: 'u-andrea', author: 'Andrea M.', authorRole: 'student', text: 'Finalmente! Aspettavo questa da lunedì 🔥', ts: Date.now() - 430000 },
  { id: 'lc-3', authorId: 'u-giulia', author: 'Giulia T.', authorRole: 'student', text: 'Ciao a tutti! In diretta da Milano 👋', ts: Date.now() - 410000 },
  { id: 'lc-4', authorId: 'u-coach', author: 'Laura Bianchi', authorRole: 'coach', text: 'Ciao ragazzi! Iniziamo con un recap di questa settimana sul Forex.', ts: Date.now() - 390000 },
  { id: 'lc-5', authorId: 'u-paolo', author: 'Paolo R.', authorRole: 'student', text: 'EUR/USD è stato difficile questa settimana, molti falsi breakout', ts: Date.now() - 360000 },
  { id: 'lc-6', authorId: 'u-andrea', author: 'Andrea M.', authorRole: 'student', text: 'Concordo Paolo, ho preso due stop loss di fila sul London open 😅', ts: Date.now() - 340000 },
  { id: 'lc-7', authorId: 'u-coach', author: 'Laura Bianchi', authorRole: 'coach', text: 'Esatto, era una settimana da aspettare. Il mercato non ha sempre setup puliti. Tra poco vi mostro cosa ho visto io sul 4H.', ts: Date.now() - 310000 },
  { id: 'lc-8', authorId: 'u-luca', author: 'Luca B.', authorRole: 'student', text: 'Ottimo! Aspettavo proprio l\'analisi sul 4H 🎯', ts: Date.now() - 290000 },
  { id: 'lc-9', authorId: 'u-marco', author: 'Marco Rossi', authorRole: 'student', text: 'Ciao coach! Ho una domanda sulla gestione del trailing stop su GBP/JPY', ts: Date.now() - 260000, own: true },
  { id: 'lc-10', authorId: 'u-coach', author: 'Laura Bianchi', authorRole: 'coach', text: 'Marco ottima domanda! La tratto tra 10 minuti nella sezione risk management.', ts: Date.now() - 240000 },
  { id: 'lc-11', authorId: 'u-sara', author: 'Sara F.', authorRole: 'student', text: 'Qualcuno ha già guardato il modulo 5 sugli SMC? Ci sono riferimenti diretti a quello che vediamo adesso?', ts: Date.now() - 200000 },
  { id: 'lc-12', authorId: 'u-andrea', author: 'Andrea M.', authorRole: 'student', text: 'Sì Sara, lezione 16! Altamente consigliata prima di queste live', ts: Date.now() - 180000 },
  { id: 'lc-13', authorId: 'u-giulia', author: 'Giulia T.', authorRole: 'student', text: 'Grazie Andrea 🙏 La guardo dopo la live', ts: Date.now() - 160000 },
  { id: 'lc-14', authorId: 'u-paolo', author: 'Paolo R.', authorRole: 'student', text: 'Laura stai condividendo il grafico? Non vedo ancora lo schermo', ts: Date.now() - 130000 },
  { id: 'lc-15', authorId: 'u-coach', author: 'Laura Bianchi', authorRole: 'coach', text: 'Adesso sì! Vedete EUR/USD Daily?', ts: Date.now() - 110000 },
  { id: 'lc-16', authorId: 'u-luca', author: 'Luca B.', authorRole: 'student', text: '✅ Vedo tutto chiaramente', ts: Date.now() - 100000 },
  { id: 'lc-17', authorId: 'u-marco', author: 'Marco Rossi', authorRole: 'student', text: 'Confermato! Si vede bene 👍', ts: Date.now() - 95000, own: true },
]

export const BOT_MESSAGES: Omit<LiveChatMessage, 'id' | 'ts'>[] = [
  { authorId: 'u-andrea', author: 'Andrea M.', authorRole: 'student', text: 'Ottima analisi coach! Non avevo visto quella confluenza sul H4 🎯' },
  { authorId: 'u-giulia', author: 'Giulia T.', authorRole: 'student', text: 'Quindi il livello chiave è 1.0840? Ho appena disegnato il mio grafico' },
  { authorId: 'u-luca', author: 'Luca B.', authorRole: 'student', text: 'Concordo con la lettura. GBP sta dando segnali simili sul daily' },
  { authorId: 'u-sara', author: 'Sara F.', authorRole: 'student', text: 'Questa live è fantastica ogni settimana 🔥🔥' },
  { authorId: 'u-paolo', author: 'Paolo R.', authorRole: 'student', text: 'Domanda: questo setup funziona anche sul CAD/JPY?' },
  { authorId: 'u-andrea', author: 'Andrea M.', authorRole: 'student', text: 'Paolo sì! Stessa struttura, ma occhio alla correlazione col petrolio' },
  { authorId: 'u-luca', author: 'Luca B.', authorRole: 'student', text: '📊 Grazie per la spiegazione sull\'order block! Molto chiaro' },
  { authorId: 'u-giulia', author: 'Giulia T.', authorRole: 'student', text: 'Possiamo avere il link del grafico dopo la live?' },
  { authorId: 'u-sara', author: 'Sara F.', authorRole: 'student', text: 'La settimana prossima analizziamo anche il crude oil?' },
  { authorId: 'u-coach', author: 'Laura Bianchi', authorRole: 'coach', text: 'Buona domanda Paolo! Il setup funziona su qualsiasi mercato liquido 💪' },
  { authorId: 'u-paolo', author: 'Paolo R.', authorRole: 'student', text: 'Perfetto grazie! Un\'altra domanda: il volume è rilevante in questa analisi?' },
  { authorId: 'u-coach', author: 'Laura Bianchi', authorRole: 'coach', text: 'Giulia: sì, carico lo screen sul canale avvisi dopo la live 📎' },
  { authorId: 'u-andrea', author: 'Andrea M.', authorRole: 'student', text: 'Ora capisco perché ho sbagliato il timing la scorsa settimana!' },
  { authorId: 'u-luca', author: 'Luca B.', authorRole: 'student', text: 'Stessa cosa Andrea, tutto torna quando la spiega Laura 😂' },
  { authorId: 'u-giulia', author: 'Giulia T.', authorRole: 'student', text: 'Quante sessioni live facciamo al mese in totale?' },
]
