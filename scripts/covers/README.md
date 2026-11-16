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

## Scorta (copertine e locandine nuove)

`plan_pool.py` genera la scorta di immagini pronte (tabella `cover_pool`,
cartella `curated/pool/` del bucket). Ogni voce ha un grafico protagonista che
non compare altrove, in quattro file: copertina orizzontale scura e chiara
(`{grafico}-dark.webp`, `-light.webp`) e locandina verticale scura e chiara
(`-poster-dark.webp`, `-poster-light.webp`).

Ogni «Genera» dell'admin (copertina di lezione o live, locandina di sezione,
«Genera tutte») e ogni lezione o live appena creata prende dalla scorta una voce
mai usata: tema mente per il Mental Coach, trading per il resto, scegliendo
quella con più tag nel titolo (funzioni `claim_lesson_cover`, `claim_live_cover`,
`claim_category_poster`; anche la funzione `generate-cover` usa queste). Ogni
voce si usa una volta sola.

Per rifornirla servono grafici NUOVI (mai uno di `plan.py`, `plan_lives.py`,
`plan_mental.py` o già in `POOL`): aggiungili a `charts.py` e a `POOL`, poi

```
python3 plan_pool.py out grafico1,grafico2,…
```

converti in WebP, carica in `video-covers/curated/pool/` e inserisci le righe
in `cover_pool` (`theme, chart, tags, url_dark, url_light, poster_dark,
poster_light`). Novembre 2026: 47 voci in tutto (20 della prima scorta, 27
della seconda).

## Sfondo degli avvisi

`draw_broadcast` (onde di trasmissione) è lo sfondo della slide "Avvisi" della
Home quando il post non ha immagini: file statico `public/covers/avvisi.webp`.
