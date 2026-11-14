"""Piano copertine delle live registrate: grafico + parola chiave per ogni replay.
Trading → grafico dell'argomento; Mental Coach e live sulla mente → cervello,
neuroni, esplosioni di particelle, sinapsi (con EEG/spettrogramma di contorno)."""
import json, sys, os
from charts import render_cover, set_theme

BRAIN, NEURON, SYN = 'brain', 'neuron_burst', 'synapse'
LIVES = {  # prefisso id → (grafico, parametri, parola chiave)
    # trading
    '01e34a32': ('montecarlo', {}, 'MONTECARLO'),
    'cd187445': ('surface', {}, 'STRATEGIA'),
    '183ce4a2': ('breakout', {}, 'BREAKOUT'),
    '226784cd': ('heatmap', {}, 'Q&A'),
    '15f996a6': ('scatter', {}, 'Q&A'),
    '1fc872d4': ('cloud3d', {}, 'SPACE QUANT'),
    'ca3c3c61': ('graph', {}, 'LANCIO APP'),
    '6485d93a': ('prop', {}, 'PROP VS REAL'),
    '2bc156fc': ('cond_hist', {}, 'PROP VS REAL'),
    '0c73dbf0': ('mc_expect', {}, 'ASPETTATIVE'),
    '7c99a528': ('hist', {}, 'EXPECTANCY'),
    '37961b81': ('coverage', {}, 'RACCOLTA DATI'),
    'b67ca996': ('discr', {}, 'MECCANICO'),
    '41e2c7bf': ('cycle', {}, 'CICLI GIORNALIERI'),
    '94e7a456': ('table_heat', {}, 'I TUOI NUMERI'),
    'cf3cbdfb': ('percentiles', {}, 'HTR'),
    '3755fcf9': ('overfit', {}, 'OVERFITTING'),
    'fc2e972f': ('sessions', {}, 'SESSIONI'),
    'bdef5c55': ('walkforward', {}, 'SESSIONI + HTR'),
    '9c6986cf': ('is_oos', {}, 'HTR & IPA'),
    # mente (Live & Replay)
    '50da72f3': (BRAIN, dict(az=-18, el=10, active=((0.72, -0.25, 0.25),)), 'MENTAL COACH'),
    'ae69c32c': (BRAIN, dict(az=196, el=12, active=((0.55, 0.3, 0.45),)), 'BUON TRADER'),
    '79df3253': (BRAIN, dict(az=-30, el=18, active=((0.78, -0.2, 0.18), (-0.1, -0.35, 0.5))), 'IL 99%'),
    '334a5373': (SYN, {}, 'ABITUDINI'),
    'cc10f5f6': (NEURON, dict(c=(0.15, 0.05), scale=1.1), 'DOPAMINA'),
    '3b0d13f1': (NEURON, dict(c=(-0.35, -0.05), scale=0.8, sats=2), 'AREA DI COMFORT'),
    # Mental Coach (pagina dedicata)
    '63306827': (BRAIN, dict(az=-12, el=6, active=((0.8, -0.2, 0.05),)), 'MENTE #1'),
    '4c839ce0': (NEURON, dict(c=(0.1, 0.05)), 'MENTE #2'),
    'a9fe9b21': (SYN, {}, 'MENTE #3'),
    'b90e53b0': (BRAIN, dict(az=190, el=16, active=((0.3, 0.3, 0.55),)), 'MENTE #4'),
    'ae7bafe6': (NEURON, dict(c=(0.45, 0.2), scale=0.72, sats=3), 'MENTE #5'),
    '7c34fbe9': (SYN, {}, 'MENTE #6'),
    '02934246': (BRAIN, dict(az=-40, el=24, active=((0.1, -0.3, 0.55), (0.7, -0.2, 0.2))), 'MENTE #7'),
    '92b401de': (NEURON, dict(c=(-0.25, -0.1), scale=0.85, sats=2), 'MENTE #8'),
    '17c5f70a': (SYN, {}, 'MENTE #9'),
    'cae75eea': (BRAIN, dict(az=165, el=8, active=((-0.6, 0.3, 0.2),)), 'MENTE #10'),
    '2d766aae': (NEURON, dict(c=(0.2, 0.0), scale=0.62, sats=4), 'MENTE #11'),
    'ee54eba4': (SYN, {}, 'MENTE #12'),
}
MIND = {BRAIN, NEURON, SYN}

if __name__ == '__main__':
    lives, out, theme = sys.argv[1], sys.argv[2], sys.argv[3]
    only = set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None
    set_theme(theme); os.makedirs(out, exist_ok=True)
    rows = [r for r in json.load(open(lives)) if r['status'] == 'replay']
    manifest = {}
    for r in rows:
        k = r['id'][:8]; main, kw, word = LIVES[k]
        seed = int(k, 16) % 10_000
        sec = None
        if main in MIND:
            sec = ['raster' if seed % 2 else 'eeg', 'spectrogram', 'bandpower']
        f = f'{k}.jpg'
        if not only or k in only:
            render_cover(main, f'{out}/{f}', seed=seed, secondaries=sec, kw=kw)
            print(theme, k, main, '·', word, '·', r['title'][:50], flush=True)
        manifest[r['id']] = {'file': f, 'keyword': word, 'title': r['title'], 'chart': main}
    missing = [r['title'] for r in rows if r['id'][:8] not in LIVES]
    json.dump(manifest, open(f'{out}/manifest.json', 'w'), ensure_ascii=False, indent=1)
    print('replay:', len(rows), '· copertine:', len(manifest), '· senza piano:', missing)
