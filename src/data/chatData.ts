export type ChannelType = 'chat' | 'bacheca'
export type MemberRole = 'student' | 'coach' | 'mental_coach' | 'admin'
export type ChannelKind = 'group' | 'direct'

export interface Channel {
  id: string
  name: string
  description?: string
  type: ChannelType
  channelKind: ChannelKind
  category: string
  categoryIcon: string
  roles: MemberRole[]
  canPost: MemberRole[]
  unread?: number
  pinned?: boolean
  dmWith?: { name: string; role: MemberRole; online?: boolean }
}

export interface ChatMessage {
  id: string
  author: string
  authorRole: MemberRole
  text: string
  timestamp: string
  own?: boolean
}

export interface BachecaPost {
  id: string
  author: string
  authorRole: MemberRole
  title?: string
  content: string
  timestamp: string
  pinned?: boolean
  reactions: { emoji: string; count: number; reacted: boolean }[]
  readCount: number
  totalReaders: number
  readByMe: boolean
  tag?: string
  attachmentType?: 'event' | 'link' | null
  attachmentData?: { label: string; url?: string; date?: string }
}

// I canali (group) sono ora reali nel DB: vedi `src/lib/channels.ts` (tabella
// `channels`, gestiti da Admin → Chat). I DM restano generati dinamicamente.

export const MESSAGES: Record<string, ChatMessage[]> = {
  generale: [
    {
      id: 'g1',
      author: 'Admin IST',
      authorRole: 'admin',
      text: 'Benvenuti nella community IST! Questo è il posto per condividere idee e supportarsi a vicenda 🚀',
      timestamp: '2026-06-25T09:00:00',
    },
    {
      id: 'g2',
      author: 'Andrea M.',
      authorRole: 'student',
      text: 'Ottima sessione stamattina su EUR/USD, trend ben definito sul 4H. Ho aspettato il retest e poi sono entrato long.',
      timestamp: '2026-06-25T10:23:00',
    },
    {
      id: 'g3',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: 'Anche io ho preso lo stesso setup! Grande segnale 📈 Risk/reward minimo 1:3',
      timestamp: '2026-06-25T10:31:00',
      own: true,
    },
    {
      id: 'g4',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      text: 'Ottimo lavoro ragazzi, esattamente il tipo di operatività paziente che voglio vedere nel programma.',
      timestamp: '2026-06-25T11:05:00',
    },
    {
      id: 'g5',
      author: 'Giulia T.',
      authorRole: 'student',
      text: "Io invece ho sbagliato l'entry, sono entrata troppo presto prima del retest. Devo lavorare sulla pazienza.",
      timestamp: '2026-06-25T11:20:00',
    },
    {
      id: 'g6',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: "Succede Giulia! L'importante è riconoscerlo nel diario e capire il perché.",
      timestamp: '2026-06-25T11:28:00',
      own: true,
    },
    {
      id: 'g7',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      text: 'Esatto Marco. Giulia, analizziamo insieme nel gruppo Zoom di giovedì 💪',
      timestamp: '2026-06-25T11:35:00',
    },
  ],

  'trading-ideas': [
    {
      id: 'ti1',
      author: 'Andrea M.',
      authorRole: 'student',
      text: 'GBP/JPY — struttura ribassista sul daily, attendo FVG sul 4H per eventuale short. Livello chiave 196.50.',
      timestamp: '2026-06-25T08:15:00',
    },
    {
      id: 'ti2',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      text: 'Buona lettura Andrea. Attenzione al livello di liquidità sopra 197.20 che potrebbe fare da magnete prima del reversal.',
      timestamp: '2026-06-25T08:40:00',
    },
    {
      id: 'ti3',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: 'Sto guardando anche XAU/USD. Oro in range da 3 giorni, potrebbe esplodere con i dati NFP di venerdì.',
      timestamp: '2026-06-25T09:10:00',
      own: true,
    },
    {
      id: 'ti4',
      author: 'Paolo R.',
      authorRole: 'student',
      text: 'Concordo sull\'oro. Io sto aspettando la rottura dei 2340$ con volume.',
      timestamp: '2026-06-25T09:25:00',
    },
    {
      id: 'ti5',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: 'Esatto Paolo, no break no trade! Gestione del rischio prima di tutto.',
      timestamp: '2026-06-25T09:35:00',
      own: true,
    },
  ],

  'gruppo-coach': [
    {
      id: 'gc1',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      text: 'Ciao gruppo! Ricordate la sessione Zoom di giovedì alle 18:00. Preparate almeno un trade da analizzare insieme.',
      timestamp: '2026-06-24T08:30:00',
    },
    {
      id: 'gc2',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: 'Confermato Laura, ci sono! Porto il mio trade su EUR/USD di questa mattina.',
      timestamp: '2026-06-24T09:15:00',
      own: true,
    },
    {
      id: 'gc3',
      author: 'Andrea M.',
      authorRole: 'student',
      text: 'Ci sono anche io. Ho un trade che non capisco ancora bene perché sia andato contro.',
      timestamp: '2026-06-24T09:30:00',
    },
    {
      id: 'gc4',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      text: 'Ottimo Andrea, è proprio quello che voglio vedere. Portare i trade che non funzionano è fondamentale per crescere.',
      timestamp: '2026-06-24T09:45:00',
    },
    {
      id: 'gc5',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: "Laura, possiamo dedicare un po' di tempo anche alla gestione emotiva dopo una losing streak?",
      timestamp: '2026-06-25T10:00:00',
      own: true,
    },
    {
      id: 'gc6',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      text: 'Assolutamente sì Marco! Inserisco anche quello in agenda. È uno degli aspetti più importanti del trading professionale.',
      timestamp: '2026-06-25T10:15:00',
    },
  ],

  'dm-laura': [
    {
      id: 'dl1',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      text: "Ciao Marco! Ho rivisto la tua analisi di ieri sera su EUR/USD. Ottimo lavoro sull'identificazione delle strutture.",
      timestamp: '2026-06-25T14:20:00',
    },
    {
      id: 'dl2',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: 'Grazie Laura! Stavo applicando esattamente quello che abbiamo visto la settimana scorsa sul FVG.',
      timestamp: '2026-06-25T14:35:00',
      own: true,
    },
    {
      id: 'dl3',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      text: 'Si vede! Continua così. Per giovedì porta anche un esempio di trade che hai evitato — la disciplina nel non entrare è importante quanto entrare.',
      timestamp: '2026-06-25T14:40:00',
    },
    {
      id: 'dl4',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: 'Perfetto! Ho già in mente uno di stamattina su GBP/USD dove ho resistito all\'impulso. Lo preparo.',
      timestamp: '2026-06-25T14:52:00',
      own: true,
    },
    {
      id: 'dl5',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      text: 'Ottima auto-consapevolezza Marco, è un segnale di grande maturità come trader 💪',
      timestamp: '2026-06-25T15:00:00',
    },
  ],

  'dm-sofia': [
    {
      id: 'ds1',
      author: 'Sofia Verdi',
      authorRole: 'mental_coach',
      text: 'Ciao Marco! Sono Sofia, il tuo mental coach. Benvenuto nel programma IST! Quando sei disponibile per la prima sessione?',
      timestamp: '2026-06-23T10:00:00',
    },
    {
      id: 'ds2',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: 'Ciao Sofia! Molto contento di iniziare. Sono disponibile giovedì pomeriggio o venerdì mattina.',
      timestamp: '2026-06-23T10:30:00',
      own: true,
    },
    {
      id: 'ds3',
      author: 'Sofia Verdi',
      authorRole: 'mental_coach',
      text: 'Perfetto! Prenotiamo giovedì alle 16:00 via Zoom. Ti manderò il link. La prima sessione durerà circa 60 minuti.',
      timestamp: '2026-06-23T10:45:00',
    },
    {
      id: 'ds4',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: 'Giovedì alle 16:00 è perfetto! Grazie Sofia 🙏',
      timestamp: '2026-06-23T11:00:00',
      own: true,
    },
  ],

  'dm-admin': [
    {
      id: 'da1',
      author: 'Admin IST',
      authorRole: 'admin',
      text: 'Ciao Marco! Benvenuto nel programma IST. Sono qui per qualsiasi supporto tecnico o domanda amministrativa.',
      timestamp: '2026-06-20T09:00:00',
    },
    {
      id: 'da2',
      author: 'Marco Rossi',
      authorRole: 'student',
      text: 'Grazie! Ho una domanda sull\'accesso ai video del modulo Build, uno non si carica correttamente.',
      timestamp: '2026-06-26T10:00:00',
      own: true,
    },
    {
      id: 'da3',
      author: 'Admin IST',
      authorRole: 'admin',
      text: "Grazie per la segnalazione! Ho aggiornato il video, dovrebbe funzionare adesso. Fammi sapere se il problema persiste.",
      timestamp: '2026-06-26T10:15:00',
    },
  ],
}

export const BACHECA_POSTS: Record<string, BachecaPost[]> = {
  avvisi: [
    {
      id: 'av1',
      author: 'Admin IST',
      authorRole: 'admin',
      title: 'Benvenuti nella community IST 🚀',
      content:
        'Questo è lo spazio ufficiale della community Inner Space Traders. Qui troverete tutti gli aggiornamenti importanti, le comunicazioni del team e gli avvisi di sistema.\n\nRicordate le regole base: rispetto reciproco, focus sul trading, condivisione costruttiva. Siamo qui per crescere insieme come trader professionisti.',
      timestamp: '2026-06-01T09:00:00',
      pinned: true,
      reactions: [
        { emoji: '🚀', count: 18, reacted: true },
        { emoji: '❤️', count: 12, reacted: false },
        { emoji: '👍', count: 9, reacted: false },
      ],
      readCount: 28,
      totalReaders: 30,
      readByMe: true,
      tag: 'Importante',
    },
    {
      id: 'av2',
      author: 'Admin IST',
      authorRole: 'admin',
      title: 'Sessione Zoom settimanale — Giovedì 27 Giugno',
      content:
        'La sessione Zoom di revisione trade con i coach è confermata per giovedì 27 giugno alle 18:00.\n\nPortate almeno un trade da analizzare (positivo o negativo). Il link Zoom verrà inviato 30 minuti prima via email.',
      timestamp: '2026-06-25T08:00:00',
      pinned: false,
      reactions: [
        { emoji: '✅', count: 14, reacted: true },
        { emoji: '👍', count: 7, reacted: false },
        { emoji: '🔥', count: 3, reacted: false },
      ],
      readCount: 24,
      totalReaders: 30,
      readByMe: true,
      tag: 'Evento',
      attachmentType: 'event',
      attachmentData: {
        label: 'Sessione Zoom Review Trade',
        date: 'Giovedì 27 Giugno 2026 — ore 18:00',
        url: 'https://zoom.us/j/example',
      },
    },
    {
      id: 'av3',
      author: 'Admin IST',
      authorRole: 'admin',
      title: 'Manutenzione programmata — Domenica mattina',
      content:
        'Domenica 29 giugno dalle 06:00 alle 08:00 la piattaforma potrebbe essere temporaneamente non disponibile per manutenzione tecnica. Ci scusiamo per il disagio.',
      timestamp: '2026-06-26T07:30:00',
      pinned: false,
      reactions: [
        { emoji: '👍', count: 5, reacted: false },
        { emoji: '✅', count: 8, reacted: false },
      ],
      readCount: 12,
      totalReaders: 30,
      readByMe: false,
      tag: 'Sistema',
    },
  ],

  'aggiornamenti-corso': [
    {
      id: 'ac1',
      author: 'Laura Bianchi',
      authorRole: 'coach',
      title: 'Nuovo modulo disponibile: Smart Money Concepts avanzati',
      content:
        'Ho caricato 3 nuove lezioni video nella sezione Build del percorso:\n\n• Lezione 12 — Order Blocks istituzionali\n• Lezione 13 — Breaker Blocks e come usarli\n• Lezione 14 — Liquidity sweep avanzati\n\nConsigliate a tutti gli studenti in fase Build e Deploy. Guardatele nell\'ordine indicato per una progressione ottimale.',
      timestamp: '2026-06-24T10:00:00',
      pinned: false,
      reactions: [
        { emoji: '🔥', count: 16, reacted: true },
        { emoji: '👍', count: 11, reacted: false },
        { emoji: '❤️', count: 8, reacted: false },
      ],
      readCount: 22,
      totalReaders: 30,
      readByMe: true,
      tag: 'Contenuto',
      attachmentType: 'link',
      attachmentData: {
        label: 'Vai ai videocorsi',
        url: '/student/corsi',
      },
    },
    {
      id: 'ac2',
      author: 'Admin IST',
      authorRole: 'admin',
      title: 'Analisi di mercato settimanale — Settimana 26',
      content:
        'Ecco il recap dei mercati questa settimana:\n\n📊 EUR/USD: range compression, attesa breakout\n📊 GBP/JPY: trend ribassista confermato, pullback in corso\n📊 XAU/USD: oro in consolidamento, NFP venerdì come catalizzatore\n\nFocus della settimana prossima: gestione posizioni durante dati macro ad alta volatilità.',
      timestamp: '2026-06-26T07:00:00',
      pinned: false,
      reactions: [
        { emoji: '📊', count: 9, reacted: false },
        { emoji: '👍', count: 13, reacted: true },
        { emoji: '🔥', count: 6, reacted: false },
      ],
      readCount: 15,
      totalReaders: 30,
      readByMe: true,
      tag: 'Analisi',
    },
  ],
}
