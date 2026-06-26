export interface Attachment {
  id: string
  name: string
  type: 'pdf' | 'xlsx' | 'docx' | 'pptx' | 'zip'
  size: string
}

export interface Lesson {
  id: string
  courseId: string
  title: string
  description: string
  duration: string
  done: boolean
  attachments: Attachment[]
}

export interface Course {
  id: string
  categoryId: string
  title: string
  description: string
  phase: string
  published: boolean
  lessons: Lesson[]
}

export interface Category {
  id: string
  title: string
  description: string
  accent: string
  phase: string
  published: boolean
  courses: Course[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'cat-1',
    title: 'Fondamenta del Trading',
    description: 'Dai mercati finanziari alla lettura dei grafici: le basi per iniziare con il piede giusto.',
    accent: '#7CBBD0',
    phase: 'Build',
    published: true,
    courses: [
      {
        id: 'crs-1',
        categoryId: 'cat-1',
        title: 'Modulo 1 — Introduzione ai mercati',
        description: 'I fondamentali del mercato Forex, struttura e partecipanti.',
        phase: 'Build',
        published: true,
        lessons: [
          {
            id: 'les-1',
            courseId: 'crs-1',
            title: 'Introduzione ai mercati finanziari',
            description: 'Una panoramica completa sui principali mercati: Forex, equity, futures e CFD. Capirai chi sono i partecipanti, come si muovono i prezzi e perché il mercato è il miglior maestro.',
            duration: '18 min',
            done: true,
            attachments: [
              { id: 'att-1', name: 'Slide introduzione mercati.pdf', type: 'pdf', size: '2.4 MB' },
            ],
          },
          {
            id: 'les-2',
            courseId: 'crs-1',
            title: 'Struttura del mercato Forex',
            description: 'Come funziona il mercato Forex: sessioni, liquidità, spread e slippage. Imparerai a riconoscere le ore di maggiore volatilità e come sfruttarle.',
            duration: '24 min',
            done: true,
            attachments: [
              { id: 'att-2', name: 'Struttura Forex — Riepilogo.pdf', type: 'pdf', size: '1.8 MB' },
              { id: 'att-3', name: 'Sessioni di trading.xlsx', type: 'xlsx', size: '420 KB' },
            ],
          },
          {
            id: 'les-3',
            courseId: 'crs-1',
            title: 'Come leggere un grafico',
            description: 'Candlestick, barre, linee: capire il linguaggio universale dei grafici. Dal timeframe M1 al Monthly, ogni scala ha il suo scopo.',
            duration: '31 min',
            done: true,
            attachments: [
              { id: 'att-4', name: 'Guida ai grafici.pdf', type: 'pdf', size: '3.1 MB' },
            ],
          },
          {
            id: 'les-4',
            courseId: 'crs-1',
            title: 'Sessione domande e risposte',
            description: 'Risposta alle domande più frequenti dei nuovi trader. Un momento di consolidamento prima di passare al modulo successivo.',
            duration: '45 min',
            done: false,
            attachments: [],
          },
        ],
      },
      {
        id: 'crs-2',
        categoryId: 'cat-1',
        title: 'Modulo 2 — Analisi Tecnica',
        description: 'Pattern candlestick, indicatori e setup multi-timeframe per operare con precisione.',
        phase: 'Build',
        published: true,
        lessons: [
          {
            id: 'les-5',
            courseId: 'crs-2',
            title: 'Pattern candlestick fondamentali',
            description: 'I 12 pattern candlestick più importanti e come riconoscerli in real-time sul grafico.',
            duration: '27 min',
            done: true,
            attachments: [
              { id: 'att-5', name: 'Catalogo pattern completo.pdf', type: 'pdf', size: '5.2 MB' },
            ],
          },
          {
            id: 'les-6',
            courseId: 'crs-2',
            title: 'Supporti e resistenze',
            description: 'Come identificare e usare i livelli chiave del grafico per entry e exit precisi.',
            duration: '22 min',
            done: true,
            attachments: [],
          },
          {
            id: 'les-7',
            courseId: 'crs-2',
            title: 'Indicatori tecnici — RSI & MACD',
            description: 'Configurazione, lettura e utilizzo pratico di RSI e MACD nel trading operativo.',
            duration: '35 min',
            done: false,
            attachments: [
              { id: 'att-6', name: 'RSI MACD cheatsheet.pdf', type: 'pdf', size: '890 KB' },
            ],
          },
          {
            id: 'les-8',
            courseId: 'crs-2',
            title: 'Setup multi-timeframe',
            description: 'Come allineare i timeframe per confluenza e precision entry. Il segreto dei trader professionisti.',
            duration: '41 min',
            done: false,
            attachments: [],
          },
        ],
      },
    ],
  },
  {
    id: 'cat-2',
    title: 'Risk & Psychology',
    description: 'Gestione del rischio e psicologia del trader per performance consistente nel tempo.',
    accent: '#46D39A',
    phase: 'Build',
    published: true,
    courses: [
      {
        id: 'crs-3',
        categoryId: 'cat-2',
        title: 'Modulo 3 — Risk Management',
        description: 'Position sizing, stop loss, drawdown e protezione del capitale.',
        phase: 'Build',
        published: true,
        lessons: [
          {
            id: 'les-9',
            courseId: 'crs-3',
            title: 'I principi del risk management',
            description: 'Perché il risk management è la skill più importante per un trader. Il denaro che non perdi è il denaro che guadagni.',
            duration: '19 min',
            done: false,
            attachments: [
              { id: 'att-7', name: 'Risk Management Handbook.pdf', type: 'pdf', size: '4.1 MB' },
            ],
          },
          {
            id: 'les-10',
            courseId: 'crs-3',
            title: 'Position sizing e leva',
            description: 'Come calcolare la dimensione corretta della posizione in base al rischio e alla size del conto.',
            duration: '28 min',
            done: false,
            attachments: [
              { id: 'att-8', name: 'Position Size Calculator.xlsx', type: 'xlsx', size: '180 KB' },
            ],
          },
          {
            id: 'les-11',
            courseId: 'crs-3',
            title: 'Stop loss e take profit',
            description: 'Dove posizionare SL e TP per massimizzare il risk/reward in ogni condizione di mercato.',
            duration: '23 min',
            done: false,
            attachments: [],
          },
        ],
      },
      {
        id: 'crs-4',
        categoryId: 'cat-2',
        title: 'Modulo 4 — Psicologia del Trading',
        description: 'Bias cognitivi, routine e journaling per costruire un mindset da trader professionista.',
        phase: 'Build',
        published: true,
        lessons: [
          {
            id: 'les-12',
            courseId: 'crs-4',
            title: 'Bias cognitivi nel trading',
            description: 'I 10 bias più pericolosi per i trader e le tecniche concrete per neutralizzarli.',
            duration: '33 min',
            done: false,
            attachments: [
              { id: 'att-9', name: 'Mappa bias cognitivi.pdf', type: 'pdf', size: '2.7 MB' },
            ],
          },
          {
            id: 'les-13',
            courseId: 'crs-4',
            title: 'Routine del trader professionista',
            description: 'Pre-market, intraday e post-market: come costruire e mantenere una routine vincente.',
            duration: '21 min',
            done: false,
            attachments: [],
          },
          {
            id: 'les-14',
            courseId: 'crs-4',
            title: 'Journaling e auto-analisi',
            description: 'Come tenere un trading journal efficace per migliorare sistematicamente nel tempo.',
            duration: '26 min',
            done: false,
            attachments: [
              { id: 'att-10', name: 'Trading Journal Template.xlsx', type: 'xlsx', size: '240 KB' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'cat-3',
    title: 'Advanced Strategies',
    description: 'Setup avanzati, order flow e strategie istituzionali per trader in fase Test e Deploy.',
    accent: '#F6C85F',
    phase: 'Test',
    published: true,
    courses: [
      {
        id: 'crs-5',
        categoryId: 'cat-3',
        title: 'Modulo 5 — Setup Avanzati',
        description: 'Order flow, volumi e strategia istituzionale: il trading come fanno le grandi mani.',
        phase: 'Test',
        published: true,
        lessons: [
          {
            id: 'les-15',
            courseId: 'crs-5',
            title: 'Order Flow Analysis',
            description: 'Come leggere il book di negoziazione, il volume delta e il footprint chart per anticipare i movimenti.',
            duration: '48 min',
            done: false,
            attachments: [],
          },
          {
            id: 'les-16',
            courseId: 'crs-5',
            title: 'Smart Money Concepts',
            description: 'La logica istituzionale: BOS, CHoCH, liquidity hunt e order blocks. Come seguire le grandi mani.',
            duration: '55 min',
            done: false,
            attachments: [
              { id: 'att-11', name: 'SMC Reference Guide.pdf', type: 'pdf', size: '8.3 MB' },
            ],
          },
          {
            id: 'les-17',
            courseId: 'crs-5',
            title: 'Backtest e forward test',
            description: 'Come validare una strategia in modo statisticamente rigoroso prima di metterla live.',
            duration: '39 min',
            done: false,
            attachments: [
              { id: 'att-12', name: 'Backtest Spreadsheet.xlsx', type: 'xlsx', size: '520 KB' },
              { id: 'att-13', name: 'Forward Test Log.xlsx', type: 'xlsx', size: '320 KB' },
            ],
          },
        ],
      },
      {
        id: 'crs-6',
        categoryId: 'cat-3',
        title: 'Modulo 6 — Automazione',
        description: 'Introduzione alle strategie algoritmiche con Pine Script su TradingView.',
        phase: 'Deploy',
        published: false,
        lessons: [
          {
            id: 'les-18',
            courseId: 'crs-6',
            title: 'Introduzione a Pine Script',
            description: 'Come scrivere indicatori custom su TradingView partendo da zero.',
            duration: '44 min',
            done: false,
            attachments: [],
          },
          {
            id: 'les-19',
            courseId: 'crs-6',
            title: 'Automatizzare il journaling',
            description: 'Export automatico dei trade e integrazione con Google Sheets per un journal sempre aggiornato.',
            duration: '31 min',
            done: false,
            attachments: [],
          },
        ],
      },
    ],
  },
]

export function findLesson(lessonId: string): { lesson: Lesson; course: Course; category: Category } | null {
  for (const cat of CATEGORIES) {
    for (const crs of cat.courses) {
      const lesson = crs.lessons.find(l => l.id === lessonId)
      if (lesson) return { lesson, course: crs, category: cat }
    }
  }
  return null
}

export function findCategory(categoryId: string): Category | null {
  return CATEGORIES.find(c => c.id === categoryId) ?? null
}

export function getCategoryStats(cat: Category) {
  const allLessons = cat.courses.flatMap(c => c.lessons)
  const done = allLessons.filter(l => l.done).length
  return { total: allLessons.length, done, pct: allLessons.length ? Math.round((done / allLessons.length) * 100) : 0 }
}

export function getCourseStats(course: Course) {
  const done = course.lessons.filter(l => l.done).length
  return { total: course.lessons.length, done, pct: course.lessons.length ? Math.round((done / course.lessons.length) * 100) : 0 }
}
