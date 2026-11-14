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
