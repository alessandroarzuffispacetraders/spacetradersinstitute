"""Piano: grafico + parola chiave per ogni lezione/serie pubblicata (sezione trading)."""
import json, sys, hashlib, os
from charts import render_cover, render_poster, set_theme

LESSONS = {  # titolo → (grafico principale, parola chiave)
    'Discrezionale VS Meccanico/Quantitativo': ('discr', 'QUANTITATIVO'),
    'Le percentuali che non cambiano MAI': ('winrate', 'PERCENTUALI'),
    'Come trovo un EDGE': ('hist', 'EDGE'),
    'Come CREO una strategia': ('surface', 'STRATEGIA'),
    'I 3 punti CHIAVE di una strategia': ('equity_dd', '3 PUNTI CHIAVE'),
    'Semplice è meglio di Complesso': ('overfit', 'SEMPLICITÀ'),
    'Portafoglio (?)': ('corr', 'PORTAFOGLIO'),
    'Hai aspettative FUORI CONTROLLO': ('mc_expect', 'ASPETTATIVE'),
    'Come Proseguire': ('walkforward', 'PROSSIMI PASSI'),
    'Tour di Space Quant': ('cloud3d', 'SPACE QUANT'),
    'Scarica il tuo Primo Dataset': ('coverage', 'DATASET'),
    'Mercati e Costi': ('costs', 'COSTI'),
    'Profili e Swap': ('swap', 'SWAP'),
    'Vault e Fuso orario': ('sessions', 'FUSO ORARIO'),
    'Finalizzare la Creazione del Dataset': ('multiseries', 'DATASET PRONTO'),
    'Come analizzare Paper': ('regression', 'PAPER'),
    'Come utilizzare SSRN': ('tstat', 'SSRN'),
    "Dal Paper All'Ipotesi": ('hypothesis', 'IPOTESI'),
    'Semplice batte Complesso': ('overfit_bars', 'SEMPLICE'),
    'Concetti & Condizioni': ('cond_hist', 'CONDIZIONI'),
    'Creare una Ricerca': ('heatmap', 'RICERCA'),
    'La sezione Ricerca': ('random_vs_yours', 'RICERCA'),
    'MAE & MFE': ('scatter', 'MAE & MFE'),
    'I percentili': ('percentiles', 'PERCENTILI'),
    'Leggere la tabella MAE & MFE': ('table_heat', 'TABELLA MAE'),
    'Considerazioni AI': ('pred_actual', 'AI'),
    'Quant-Brain': ('graph', 'QUANT-BRAIN'),
    'Imposta la tua strategia correttamente': ('is_oos', 'BACKTEST'),
}
POSTERS = {  # titolo serie → grafico protagonista
    'Perchè il modello Quantitativo': 'montecarlo',
    'PIATTAFORMA & SETUP DATASET': 'cloud3d',
    'DAL PAPER ALLA RICERCA': 'hypothesis',
    'EDGE VERO O È IL MERCATO?': 'random_vs_yours',
    'BACKTEST & REPLAY': 'surface',
}

def key(s):  # nome file stabile dal titolo (le serie gemelle condividono le immagini)
    return hashlib.sha1(s.encode()).hexdigest()[:10]

if __name__ == '__main__':
    catalog, out = sys.argv[1], sys.argv[2]
    set_theme(sys.argv[3] if len(sys.argv) > 3 else 'dark')
    os.makedirs(f'{out}/lessons', exist_ok=True); os.makedirs(f'{out}/posters', exist_ok=True)
    rows = json.load(open(catalog))
    manifest = {'lessons': {}, 'categories': {}}
    done = set()
    for r in rows:
        t = r['lezione']; chart_, kw = LESSONS[t]
        f = f'lessons/{key(t)}.jpg'
        if f not in done:
            render_cover(chart_, f'{out}/{f}', seed=int(key(t), 16) % 10_000); done.add(f); print('copertina', t, '→', chart_)
        manifest['lessons'][r['lesson_id']] = {'file': f, 'keyword': kw, 'title': t}
        c = r['categoria']
        if r['cat_id'] not in manifest['categories']:
            pf = f'posters/{key(c)}.jpg'
            if pf not in done:
                render_poster(POSTERS[c], f'{out}/{pf}', seed=int(key(c), 16) % 10_000); done.add(pf); print('locandina', c, '→', POSTERS[c])
            manifest['categories'][r['cat_id']] = {'file': pf, 'title': c}
    json.dump(manifest, open(f'{out}/manifest.json', 'w'), ensure_ascii=False, indent=1)
    print('file unici:', len(done), '· lezioni:', len(manifest['lessons']), '· serie:', len(manifest['categories']))
