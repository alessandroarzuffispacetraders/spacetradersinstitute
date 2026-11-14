"""Piano copertine delle live registrate: grafico + parola chiave per ogni replay.
Trading → grafico dell'argomento; Mental Coach e live sulla mente → cervello,
neuroni, esplosioni di particelle, sinapsi (con EEG/spettrogramma di contorno)."""
import json, sys, os
import numpy as np
from charts import render_cover, set_theme, MENTAL_SECONDARY, TRADING_SECONDARY

BRAIN, NEURON, SYN = 'brain', 'neuron_burst', 'synapse'
LIVES = {  # prefisso id → (grafico, parametri, parola chiave) — ogni grafico compare una sola volta
    # trading
    '01e34a32': ('underwater', {}, 'MONTECARLO'),
    'cd187445': ('volprofile', {}, 'STRATEGIA'),
    '183ce4a2': ('breakout', {}, 'BREAKOUT'),
    '226784cd': ('bar3d', {}, 'Q&A'),
    '15f996a6': ('radar', {}, 'Q&A'),
    '1fc872d4': ('contour', {}, 'SPACE QUANT'),
    'ca3c3c61': ('rings', {}, 'LANCIO APP'),
    '6485d93a': ('prop', {}, 'PROP VS REAL'),
    '2bc156fc': ('waterfall', {}, 'PROP VS REAL'),
    '0c73dbf0': ('violin', {}, 'ASPETTATIVE'),
    '7c99a528': ('rmultiple', {}, 'EXPECTANCY'),
    '37961b81': ('hexbin', {}, 'RACCOLTA DATI'),
    'b67ca996': ('boxplot', {}, 'MECCANICO'),
    '41e2c7bf': ('cycle', {}, 'CICLI GIORNALIERI'),
    '94e7a456': ('calendar', {}, 'I TUOI NUMERI'),
    'cf3cbdfb': ('ranges', {}, 'HTR'),
    '3755fcf9': ('polyfit', {}, 'OVERFITTING'),
    'fc2e972f': ('weekhour', {}, 'SESSIONI'),
    'bdef5c55': ('sensitivity', {}, 'SESSIONI + HTR'),
    '9c6986cf': ('hour_dual', {}, 'HTR & IPA'),
    # mente (Live & Replay)
    '50da72f3': ('galaxy', {}, 'MENTAL COACH'),
    'ae69c32c': ('dendrite', {}, 'BUON TRADER'),
    '79df3253': ('fmri', {}, 'IL 99%'),
    '334a5373': ('habit', {}, 'ABITUDINI'),
    'cc10f5f6': ('molecule', {}, 'DOPAMINA'),
    '3b0d13f1': ('comfort', {}, 'AREA DI COMFORT'),
    # Mental Coach (pagina dedicata)
    '63306827': ('brain_lines', {}, 'MENTE #1'),
    '4c839ce0': ('action_potential', {}, 'MENTE #2'),
    'a9fe9b21': ('synapse', {}, 'MENTE #3'),
    'b90e53b0': ('calcium', {}, 'MENTE #4'),
    'ae7bafe6': ('cleft', {}, 'MENTE #5'),
    '7c34fbe9': ('eeg', {}, 'MENTE #6'),
    '02934246': ('chord', {}, 'MENTE #7'),
    '92b401de': ('raster', {}, 'MENTE #8'),
    '17c5f70a': ('attractor', {}, 'MENTE #9'),
    'cae75eea': ('hrv', {}, 'MENTE #10'),
    '2d766aae': ('wave_rings', {}, 'MENTE #11'),
    'ee54eba4': ('spectrogram', {}, 'MENTE #12'),
}
MIND = {'brain', 'neuron_burst', 'synapse', 'brain_top', 'brain_lines', 'fmri', 'chord', 'tracto', 'cleft', 'action_potential', 'wave_rings',
        'comfort', 'habit', 'attractor', 'calcium', 'dendrite', 'galaxy', 'hrv', 'molecule', 'eeg', 'raster', 'spectrogram'}

if __name__ == '__main__':
    lives, out, theme = sys.argv[1], sys.argv[2], sys.argv[3]
    only = set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None
    set_theme(theme); os.makedirs(out, exist_ok=True)
    rows = [r for r in json.load(open(lives)) if r['status'] == 'replay']
    manifest = {}
    for r in rows:
        k = r['id'][:8]; main, kw, word = LIVES[k]
        seed = int(k, 16) % 10_000
        pick = np.random.default_rng(seed)
        sec = list(pick.choice([x for x in MENTAL_SECONDARY if x != main], 3, replace=False)) if main in MIND else None
        f = f'{k}.jpg'
        if not only or k in only:
            render_cover(main, f'{out}/{f}', seed=seed, secondaries=sec, kw=kw, pool=TRADING_SECONDARY)
            print(theme, k, main, '·', word, '·', r['title'][:50], flush=True)
        manifest[r['id']] = {'file': f, 'keyword': word, 'title': r['title'], 'chart': main}
    missing = [r['title'] for r in rows if r['id'][:8] not in LIVES]
    json.dump(manifest, open(f'{out}/manifest.json', 'w'), ensure_ascii=False, indent=1)
    print('replay:', len(rows), '· copertine:', len(manifest), '· senza piano:', missing)
