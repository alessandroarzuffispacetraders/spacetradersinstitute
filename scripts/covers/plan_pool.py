"""Scorta di copertine pronte: l'app ne assegna una (mai usata) a ogni nuova
live appena viene creata (funzione claim_live_cover). Ogni voce ha un grafico
protagonista che non compare in nessun'altra copertina; i tag servono a
scegliere quella più adatta al titolo/descrizione della live."""
import json, sys, os, zlib
import numpy as np
from charts import render_cover, set_theme, MENTAL_SECONDARY, TRADING_SECONDARY

POOL = {  # grafico → (tema, tag cercati nel titolo/descrizione, in minuscolo)
    'plateau_wire': ('trading', ['ottimizzazion', 'altipian', 'plateau', 'parametr', 'robust']),
    'stacked_area': ('trading', ['portafogli', 'diversific', 'strategie', 'multi']),
    'lollipop': ('trading', ['mensil', 'mese', 'risultat', 'performance', 'report']),
    'kelly': ('trading', ['rischio', 'risk', 'position', 'sizing', 'kelly', 'money management', 'lotti']),
    'rolling_sharpe': ('trading', ['sharpe', 'stabilit', 'metric', 'consisten']),
    'pairplot': ('trading', ['correlaz', 'variabil', 'dati', 'feature', 'analisi']),
    'ridgeline': ('trading', ['distribuz', 'stagional', 'volatilit', 'regim']),
    'bubble': ('trading', ['mercat', 'asset', 'strumenti', 'selezion']),
    'funnel': ('trading', ['piano', 'processo', 'checklist', 'routine', 'filtr', 'segnal']),
    'bollinger': ('trading', ['indicator', 'bollinger', 'rsi', 'tecnic', 'grafic']),
    'depth': ('trading', ['order', 'book', 'liquidit', 'spread', 'esecuzion']),
    'treemap': ('trading', ['allocaz', 'capitale', 'prop', 'conto', 'gestione']),
    'brain_orb': ('mind', ['mental coach', 'mental', 'mente']),
    'hypnogram': ('mind', ['sonno', 'riposo', 'energia', 'recupero']),
    'yerkes': ('mind', ['stress', 'pressione', 'ansia', 'performance']),
    'emotion_wheel': ('mind', ['emozion', 'paura', 'avidit', 'rabbia', 'frustraz']),
    'box_breath': ('mind', ['respir', 'calma', 'rilass', 'meditaz']),
    'iris': ('mind', ['focus', 'attenzion', 'concentraz', 'presenza']),
    'flow_channel': ('mind', ['flow', 'sfida', 'abilit', 'crescita', 'miglior']),
    'focus_gauge': ('mind', ['disciplin', 'controllo', 'autocontrollo', 'costanza']),
}

if __name__ == '__main__':
    out, theme = sys.argv[1], sys.argv[2]
    set_theme(theme); os.makedirs(out, exist_ok=True)
    for chart, (th, tags) in POOL.items():
        seed = zlib.crc32(chart.encode()) % 10_000
        sec = list(np.random.default_rng(seed).choice(MENTAL_SECONDARY, 3, replace=False)) if th == 'mind' else None
        render_cover(chart, f'{out}/{chart}.jpg', seed=seed, secondaries=sec, pool=TRADING_SECONDARY)
        print(theme, chart, flush=True)
    json.dump({c: {'theme': t, 'tags': g} for c, (t, g) in POOL.items()}, open(f'{out}/pool.json', 'w'), ensure_ascii=False, indent=1)
