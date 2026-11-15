# Copertine dei videocorsi (grafici quant "fotografati")

Genera copertine (lezioni, 3:2) e locandine (serie, 2:3) a partire da grafici
quantitativi veri (matplotlib) trattati come uno schermo fotografato:
prospettiva, profondità di campo, bagliore, grana. Due versioni per ogni
immagine: **scura** (default) e **chiara** (mostrata sulle card quando lo
studente usa il tema chiaro).

- `charts.py` — libreria dei grafici (Monte Carlo, distribuzioni, superficie di
  ottimizzazione, MAE/MFE, walk-forward, costi, sessioni, grafo, …) e del
  trattamento fotografico; `set_theme('dark' | 'light')`.
- `plan.py` — per ogni lezione/serie: grafico protagonista + parola chiave
  (dizionari `LESSONS` e `POSTERS`, per titolo). Per una lezione nuova basta
  aggiungere una riga.

Uso (Python 3 con numpy, matplotlib, pillow):

```
python3 plan.py catalog.json out dark
python3 plan.py catalog.json out-light light
```

`catalog.json` = righe con `cat_id, categoria, lesson_id, lezione, …` (vedi la
query usata a novembre 2026: serie pubblicate della sezione trading). Le
immagini vanno poi convertite in WebP e caricate nel bucket `video-covers`
(cartella `curated/`), aggiornando `cover_url`, `cover_url_light`,
`cover_keyword` delle lezioni e `poster_url`, `poster_url_light` delle serie.
In alternativa si caricano a mano dall'admin (Contenuti → Copertina).

## Live registrate

`plan_lives.py` fa lo stesso per i replay delle live (dizionario `LIVES`, per
prefisso dell'id): le live di trading usano il grafico dell'argomento
(breakout, prop vs reale, cicli giornalieri, Monte Carlo, …); quelle del Mental
Coach e quelle sulla mente usano cervello a particelle, neuroni che esplodono e
reti di sinapsi, con EEG/spettrogramma di contorno.

```
python3 plan_lives.py lives.json out-lives dark
python3 plan_lives.py lives.json out-lives-light light
```

`lives.json` = righe di `live_events` (`id, title, status, …`); solo i replay
ricevono una copertina. Colonne da aggiornare: `cover_url`, `cover_url_light`,
`cover_keyword`, `cover_status` (cartella del bucket `curated/lives/`).

## Videocorsi del Mental Coach

`plan_mental.py` crea la locandina della serie e le copertine delle lezioni del
Mental Coach nello stesso stile (cervello, neuroni, sinapsi). Input: le
categorie della sezione `mental` con le loro lezioni (`id, title, lessons[]`).

## Scorta per le nuove live

`plan_pool.py` genera la scorta di copertine pronte (tabella `cover_pool`,
cartella `curated/pool/` del bucket). Quando si crea una live l'app chiama
`claim_live_cover` e riceve subito una copertina mai usata: tema mente per il
Mental Coach, trading per il resto, scegliendo quella con più tag presenti nel
titolo. Ogni voce ha un grafico protagonista che non compare altrove: per
rifornire la scorta servono grafici nuovi (aggiungerli a `POOL`).

## Sfondo degli avvisi

`draw_broadcast` (onde di trasmissione) è lo sfondo della slide "Avvisi" della
Home quando il post non ha immagini: file statico `public/covers/avvisi.webp`.
