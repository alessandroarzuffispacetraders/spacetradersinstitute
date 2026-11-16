"""Scorta di copertine pronte (tabella cover_pool, cartella curated/pool/ del
bucket video-covers). Quando l'admin crea una lezione o una live, o preme
«Genera» su una copertina o sulla locandina di una sezione, l'app prende dalla
scorta un'immagine mai usata: tema mente per il Mental Coach, trading per il
resto, scegliendo quella con più tag presenti nel titolo.

Ogni voce ha un grafico protagonista che non compare in nessun'altra copertina
ed è disponibile in quattro file: orizzontale (lezioni e live, 3:2) e verticale
(locandine, 2:3), ognuna in versione scura e chiara. Per rifornire la scorta
servono grafici nuovi: aggiungili a POOL (e a charts.py), mai riusarne uno
di plan.py, plan_lives.py o plan_mental.py.

Uso:  python3 plan_pool.py OUT [grafico,grafico,…]
      → OUT/{grafico}-dark.jpg, -light.jpg, -poster-dark.jpg, -poster-light.jpg
        e OUT/pool.json (tema e tag di ogni voce)."""
import json, sys, os, zlib
import numpy as np
from charts import render_cover, render_poster, set_theme, MENTAL_SECONDARY, TRADING_SECONDARY

POOL = {  # grafico → (tema, tag cercati nel titolo/descrizione, in minuscolo)
    # novembre 2026, prima scorta (solo orizzontali all'inizio)
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
    # novembre 2026, seconda scorta (orizzontali + locandine)
    'efficient_frontier': ('trading', ['frontiera', 'markowitz', 'portafogl', 'diversific', 'allocaz', 'sharpe']),
    'qq_tails': ('trading', ['code', 'cigno', 'estrem', 'normal', 'statistic', 'distribuz']),
    'acf': ('trading', ['autocorrel', 'memoria del mercato', 'pattern', 'ciclic', 'dipendenz', 'statistic']),
    'regimes': ('trading', ['regim', 'trend', 'fase di mercato', 'contesto', 'laterale', 'condizion']),
    'polar_clock': ('trading', ['orari', 'orario', 'sessione', 'apertura', 'timing', 'atr']),
    'waffle_streak': ('trading', ['perdite consecutive', 'striscia', 'serie negativ', 'win rate', 'probabilit', 'sequenz']),
    'renko': ('trading', ['renko', 'price action', 'struttura', 'swing', 'movimento']),
    'ichimoku': ('trading', ['ichimoku', 'nuvola', 'indicator', 'supporto', 'tendenz']),
    'macd': ('trading', ['macd', 'momentum', 'media mobile', 'medie mobili', 'incroci', 'segnal']),
    'slope': ('trading', ['out of sample', 'out-of-sample', 'oos', 'validaz', 'degrad', 'robust']),
    'dumbbell': ('trading', ['aspettativ', 'conto reale', 'live', 'confronto', 'realt', 'risultat']),
    'bookmap': ('trading', ['liquidit', 'order flow', 'orderflow', 'book', 'volume', 'istituzional']),
    'fibonacci': ('trading', ['fibonacci', 'ritracc', 'livell', 'supporto', 'resistenz', 'poi']),
    'sunburst': ('trading', ['portafogl', 'composiz', 'esposiz', 'asset', 'mercati']),
    'term_structure': ('trading', ['futures', 'contango', 'rollover', 'scadenz', 'materie prime', 'curva']),
    'vol_cluster': ('trading', ['volatilit', 'garch', 'cluster', 'news', 'rischio']),
    'spiral': ('trading', ['lungo periodo', 'anni', 'storico', 'pazienza', 'tempo', 'costanza']),
    'trade_gantt': ('trading', ['durata', 'gestione', 'esecuz', 'diario', 'operativ', 'trade']),
    'entry_exit': ('trading', ['ingresso', 'uscita', 'entrata', 'holding', 'rendimento', 'timing']),
    'var_tail': ('trading', ['value at risk', 'perdita massima', 'shortfall', 'risk management', 'stress', 'rischio']),
    'turing': ('mind', ['crescita', 'cambiamento', 'trasformaz', 'evoluz', 'percorso']),
    'flow_field': ('mind', ['pensier', 'flusso', 'mindset', 'mentalit', 'intuiz']),
    'voronoi': ('mind', ['identit', 'personalit', 'convinzion', 'credenz', 'struttura']),
    'circadian': ('mind', ['energia', 'routine', 'giornata', 'mattina', 'ritmo', 'orari']),
    'arc_connectome': ('mind', ['connession', 'relazion', 'comunicaz', 'neuroplastic', 'apprendiment']),
    'memory_curve': ('mind', ['memoria', 'ripetiz', 'ripasso', 'studio', 'apprendiment', 'abitudin']),
    'dopamine': ('mind', ['dopamin', 'ricompens', 'motivaz', 'gratificaz', 'dipendenz', 'impuls']),
}

def seed_of(chart):
    return zlib.crc32(chart.encode()) % 10_000

def render(chart, out, theme):
    th, _ = POOL[chart]; seed = seed_of(chart)
    sec = list(np.random.default_rng(seed).choice(MENTAL_SECONDARY, 3, replace=False)) if th == 'mind' else None
    render_cover(chart, f'{out}/{chart}-{theme}.jpg', seed=seed, secondaries=sec, pool=TRADING_SECONDARY)
    pool = MENTAL_SECONDARY if th == 'mind' else [s for s in TRADING_SECONDARY if s != chart]
    render_poster(chart, f'{out}/{chart}-poster-{theme}.jpg', seed=seed, secondaries=list(np.random.default_rng(seed + 1).choice(pool, 4, replace=False)))

if __name__ == '__main__':
    out = sys.argv[1]; only = sys.argv[2].split(',') if len(sys.argv) > 2 else list(POOL)
    os.makedirs(out, exist_ok=True)
    for theme in ('dark', 'light'):
        set_theme(theme)
        for chart in only:
            render(chart, out, theme); print(theme, chart, flush=True)
    json.dump({c: {'theme': POOL[c][0], 'tags': POOL[c][1]} for c in only}, open(f'{out}/pool.json', 'w'), ensure_ascii=False, indent=1)
