"""Piano copertine dei videocorsi del Mental Coach: cervello, neuroni, sinapsi
(stesso stile delle live del mental coach), con EEG/spettrogramma di contorno."""
import json, sys, os
from charts import render_cover, render_poster, set_theme
from plan import key

MIND_SEC = ['eeg', 'spectrogram', 'bandpower']
LESSONS = {  # titolo → (grafico, parametri, parola chiave)
    'Perchè Mental coach nel trading': ('brain_top', {}, 'MENTE E TRADING'),
    'Cosa fare per iniziare al meglio il percorso': ('neuron_burst', dict(c=(0.15, 0.05)), 'INIZIARE'),
    'Come sarà strutturato. il percorso': ('tracto', {}, 'IL PERCORSO'),
}
POSTERS = {  # titolo serie → (grafico, parametri)
    'Mental Coach': ('brain', dict(az=-20, el=10, active=((0.72, -0.25, 0.25),), cy=0.42)),
}

if __name__ == '__main__':
    cat_json, out, theme = sys.argv[1], sys.argv[2], sys.argv[3]
    posters = '--no-posters' not in sys.argv
    set_theme(theme); os.makedirs(f'{out}/lessons', exist_ok=True); os.makedirs(f'{out}/posters', exist_ok=True)
    manifest = {'lessons': {}, 'categories': {}}
    for cat in json.load(open(cat_json)):
        main, kw = POSTERS[cat['title']]; f = f"posters/{key(cat['title'])}.jpg"
        if posters: render_poster(main, f'{out}/{f}', seed=int(key(cat['title']), 16) % 10_000, secondaries=['eeg', 'raster', 'spectrogram', 'bandpower'], kw=kw)
        manifest['categories'][cat['id']] = {'file': f, 'title': cat['title']}; print(theme, 'locandina', cat['title'])
        for l in cat['lessons']:
            main, kw, word = LESSONS[l['title']]; f = f"lessons/{key(l['title'])}.jpg"; seed = int(key(l['title']), 16) % 10_000
            render_cover(main, f'{out}/{f}', seed=seed, secondaries=['calcium' if seed % 2 else 'hrv', 'spectrogram', 'bandpower'], kw=kw)
            manifest['lessons'][l['id']] = {'file': f, 'keyword': word, 'title': l['title']}; print(theme, 'copertina', l['title'], '→', main)
    json.dump(manifest, open(f'{out}/manifest.json', 'w'), ensure_ascii=False, indent=1)
