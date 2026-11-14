// Prompt per generare copertine e locandine con ChatGPT (immagini), da incollare
// a mano e poi caricare dall'admin. Il soggetto specifico di ogni lezione/serie
// lo sceglie Claude dalla libreria qui sotto (funzione generate-cover, modo
// "prompt"); il resto del testo è fisso, così lo stile resta identico per tutto
// il catalogo. Si possono ritoccare questi testi senza ripubblicare la funzione.

export interface CoverSubject {
  visual?: string           // nome della visualizzazione scelta dalla libreria
  soggetto: string          // visualizzazione principale (protagonista)
  contorno: string          // grafici secondari intorno, parzialmente visibili
  parolaChiave?: string     // solo lezioni: la parola che l'app scrive sopra
}

// Libreria delle visualizzazioni tecniche usate nelle ricerche (dalla griglia
// di riferimento + quelle legate agli argomenti del catalogo).
export const VISUAL_LIBRARY: { nome: string; descrizione: string; temi: string }[] = [
  { nome: 'Superficie di ottimizzazione 3D', descrizione: "superficie 3D a maglia dell'expectancy al variare di due parametri, con un plateau stabile evidenziato", temi: 'ottimizzazione, parametri, robustezza, creare una strategia' },
  { nome: 'Heatmap di stabilità dei parametri', descrizione: 'griglia a celle dei risultati per combinazioni di parametri, con una zona stabile centrale più luminosa', temi: 'stabilità, overfitting, validazione' },
  { nome: 'Simulazioni Monte Carlo delle equity', descrizione: 'fascio di centinaia di equity simulate che si aprono a ventaglio, con la mediana bianca ben visibile', temi: 'backtest, scenari, rischio, aspettative' },
  { nome: 'Distribuzione Monte Carlo degli esiti', descrizione: 'istogramma dei rendimenti finali a campana con le linee dei percentili 5°, 50° e 95°', temi: 'percentili, probabilità, aspettative realistiche' },
  { nome: 'In-Sample vs Out-of-Sample', descrizione: "curva di equity divisa in due aree (In-Sample / Out-of-Sample) da una linea verticale tratteggiata", temi: 'validazione, forward test, protocollo' },
  { nome: 'Equity curve + drawdown', descrizione: 'curva di equity in crescita con sotto il grafico del drawdown a area', temi: 'performance, rischio, gestione delle aspettative' },
  { nome: 'Scatter MAE/MFE', descrizione: 'nuvola di punti MAE contro MFE dei trade, con linee dei percentili e un cluster evidenziato', temi: 'MAE & MFE, stop e target, edge' },
  { nome: 'Volume profile e liquidità', descrizione: 'istogramma orizzontale dei volumi accanto al prezzo, con il POC evidenziato e le zone di liquidità', temi: 'liquidità, cicli di liquidità, point of interest' },
  { nome: 'Struttura di mercato', descrizione: 'grafico a candele monocromatico con swing high/low, livelli e una rottura di struttura segnata', temi: 'market structure, supply & demand, entry model' },
  { nome: 'Order flow / footprint', descrizione: 'griglia footprint con volumi bid/ask per livello di prezzo e uno squilibrio evidenziato', temi: 'orderflow, engulf, ingressi' },
  { nome: 'Prezzo e tempo per sessioni', descrizione: 'grafico del prezzo con finestre orarie delle sessioni evidenziate e la linea del daily open', temi: 'time and price, daily bias, daily open, fuso orario' },
  { nome: 'Walk-forward analysis', descrizione: 'finestre scorrevoli In-Sample/Out-of-Sample in sequenza sopra una equity complessiva', temi: 'protocollo di validazione, step, robustezza' },
  { nome: 'Position sizing', descrizione: 'curva della crescita del capitale al variare della frazione di rischio, con il punto ottimale e la zona di rovina', temi: 'calcolo del rischio, position sizer, money management' },
  { nome: 'Matrice di correlazione', descrizione: 'matrice di correlazione tra strategie o mercati, a celle sfumate', temi: 'portafoglio, diversificazione' },
  { nome: 'Win rate vs payoff', descrizione: 'curva di frontiera win rate / rapporto rischio-rendimento con la zona di edge positivo', temi: 'percentuali, edge, semplice batte complesso' },
  { nome: 'Discrezionale vs quantitativo', descrizione: 'due equity a confronto: una caotica e irregolare, una regolare e disciplinata', temi: 'introduzione, metodo, mentalità' },
  { nome: 'Dataset di serie storiche', descrizione: 'molte serie di prezzo sovrapposte e una mappa di copertura dei dati per mercato e anno', temi: 'dataset, mercati e costi, setup della piattaforma' },
  { nome: 'Dal paper all’ipotesi', descrizione: "grafico di regressione con intervallo di confidenza e un test statistico, come in un paper accademico", temi: 'paper, SSRN, ipotesi, ricerca' },
]

const IDENTITA = `IDENTITÀ VISIVA (SpaceQuant)
- Sfondo nero profondo e blu notte quasi nero: il nero domina.
- Colori dei dati: blu elettrico (#3B6EF5), azzurro (#7AA0FF, #A8CFFF), viola SpaceQuant (#7B3FE4) e magenta (#E0489F) solo come accento. Le scale di colore di superfici e heatmap vanno dal blu profondo al blu elettrico, poi viola e magenta, con i picchi quasi bianchi. Niente verde, rosso, giallo o arancio: nessun arcobaleno.
- Estetica da software istituzionale di ricerca quantitativa: griglie sottili, assi fini, piccole tacche numeriche realistiche, legende di colore discrete.
- Grafica nitidissima sul soggetto, contrasto sofisticato e misurato.
- Il grafico principale è illuminato dallo schermo stesso, non da effetti neon. Riflessi ambientali minimi e realistici, morbidezza fotografica naturale.`

const CINEMA = `TRATTAMENTO CINEMATOGRAFICO
La fotografia di un thriller finanziario americano incontra il software di ricerca quantitativa istituzionale. Scuro, elegante, tecnicamente sofisticato e immersivo. Realismo fotografico, leggera profondità di campo, chiarezza eccezionale sul soggetto, atmosfera sobria.`

const VINCOLI = `VINCOLI
- Nessun titolo, scritta promozionale o logo: solo piccoli numeri sugli assi e legende.
- Nessun HUD futuristico, card olografiche fluttuanti o elementi fantascientifici.
- Nessuna scrivania, tastiera, cornice del monitor, ufficio o persona.
- Niente bagliori eccessivi o luci decorative, niente disordine, niente aspetto da infografica piatta.
- Nessuna dashboard irrealistica e nessuna promessa di guadagni esagerati.`

const RIFERIMENTO = `Se ti allego un'immagine di riferimento, usala come riferimento principale per composizione, inquadratura e linguaggio visivo, sostituendo il soggetto e i grafici di contorno con quelli indicati qui.`

// Locandina della serie: verticale 2:3 (es. 1024×1536). Nell'app il titolo è
// scritto in basso; nell'anteprima orizzontale si vede la fascia alta.
export function buildPosterPrompt(serie: { titolo: string; descrizione?: string }, s: CoverSubject): string {
  return `Crea un'immagine fotorealistica, premium e cinematografica in formato VERTICALE 2:3 (1024×1536): un'interfaccia professionale di ricerca quantitativa per il trading, fotografata da vicino su un vero display ad alta risoluzione, come la locandina di un film thriller finanziario.
${RIFERIMENTO}

TEMA DELLA SERIE: «${serie.titolo}»${serie.descrizione ? ` — ${serie.descrizione}` : ''}

SOGGETTO PRINCIPALE
${s.soggetto}

ANALISI DI CONTORNO
${s.contorno}

COMPOSIZIONE
- Il soggetto principale domina la scena (70–80% dell'attenzione) e sta nella parte ALTA e CENTRALE dell'immagine, tra il 10% e il 60% dell'altezza, perfettamente a fuoco.
- L'ultimo terzo in basso (circa il 35% inferiore) deve restare SCURO, sfocato e povero di dettagli: lì l'app scriverà in bianco il titolo della serie. Nessun elemento importante o luminoso in quella zona.
- Il soggetto deve restare riconoscibile anche ritagliando l'immagine in orizzontale (16:9) attorno al terzo superiore.
- Intorno, alcuni grafici secondari parzialmente visibili lungo i bordi alti e laterali, tagliati in modo naturale, leggermente sfocati e subordinati al soggetto.
- L'interfaccia continua oltre tutti e quattro i bordi: nessuna cornice del monitor visibile.
- Prospettiva realistica dello schermo, leggera inclinazione, profondità di campo.

${IDENTITA}

${CINEMA}

${VINCOLI}

Il risultato deve sembrare un vero display di analisi quantitativa fotografato magnificamente, con una visualizzazione scientifica eccezionalmente protagonista e gli elementi secondari visibili solo attorno.
Formato: verticale 2:3.`
}

// Copertina della lezione: orizzontale 3:2 (es. 1536×1024), mostrata in 16:9.
// Nell'app "LEZIONE 03" e la parola chiave stanno in basso a sinistra.
export function buildCoverPrompt(
  lezione: { titolo: string; numero: number; serie: string; corso?: string },
  s: CoverSubject,
): string {
  return `Crea un'immagine fotorealistica, premium e cinematografica in formato ORIZZONTALE 3:2 (1536×1024): un'interfaccia professionale di ricerca quantitativa per il trading, fotografata da vicino su un vero display ad alta risoluzione.
${RIFERIMENTO}

TEMA DELLA LEZIONE: «${lezione.titolo}» (lezione ${lezione.numero}${lezione.corso ? ` del capitolo «${lezione.corso}»` : ''}, serie «${lezione.serie}»)

SOGGETTO PRINCIPALE
${s.soggetto}

ANALISI DI CONTORNO
${s.contorno}

COMPOSIZIONE
- Il soggetto principale domina la scena e sta nella parte DESTRA e CENTRALE dell'immagine, perfettamente a fuoco.
- La zona in BASSO A SINISTRA (circa la metà sinistra e il 40% inferiore) deve restare SCURA, sfocata e povera di dettagli: lì l'app scriverà in bianco il numero della lezione e una parola chiave. Nessun elemento importante o luminoso in quella zona.
- L'immagine verrà ritagliata in 16:9: tieni gli elementi importanti lontani dall'8% superiore e inferiore.
- Intorno, alcuni grafici secondari parzialmente visibili lungo i bordi, tagliati in modo naturale, leggermente sfocati e subordinati al soggetto.
- L'interfaccia continua oltre tutti e quattro i bordi: nessuna cornice del monitor visibile.
- Prospettiva realistica dello schermo, leggera inclinazione, profondità di campo.

${IDENTITA}

${CINEMA}

${VINCOLI}

Il risultato deve sembrare un vero display di analisi quantitativa fotografato magnificamente, con una visualizzazione scientifica protagonista e gli elementi secondari visibili solo attorno.
Formato: orizzontale 3:2.`
}
