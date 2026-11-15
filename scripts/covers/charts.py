"""Copertine 'quant cinematografiche': grafici scientifici veri (matplotlib)
fotografati come uno schermo (prospettiva, profondità di campo, bagliore, grana)."""
import io, sys, math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance

rng = np.random.default_rng(7)
def reseed(n):
    global rng
    rng = np.random.default_rng(n)
BG = (4, 6, 12)
PANEL = (8, 12, 22)
BORDER = (26, 34, 56)
BLUE, LBLUE, PALE, RED, GREEN, AMBER, SAND = '#2F7DFF', '#4DB3FF', '#A8D8FF', '#E5574F', '#3DD68C', '#F5B000', '#D8C7A3'
VIOLET, MAGENTA = BLUE, RED
SQ = LinearSegmentedColormap.from_list('sq', ['#7a2622', '#c94a43', '#cf8670', '#bfae8c', '#86c494', '#33b878', '#1a9459'])
SQ_COOL = LinearSegmentedColormap.from_list('sqc', ['#0b2a5f', '#1f5fd8', '#2F7DFF', '#4DB3FF', '#A8D8FF'])
BARS = LinearSegmentedColormap.from_list('bars', ['#123c8c', '#2F7DFF', '#4DB3FF'])
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10})

THEMES = {
    'dark': dict(BG=(4, 6, 12), PANEL=(8, 12, 22), BORDER=(26, 34, 56), CANVAS_GRID=(10, 14, 26, 255),
                 SPINE='#2a3552', GRID='#18213a', TICK='#7f8aa6', TXT='#8f9ab4', TXT2='#cfd6e6', HERO='white',
                 LBLUE='#4DB3FF', PALE='#A8D8FF', NEUTRAL='#2b3b63', IS_BG='#0d2350', OOS_BG='#0d3a2a', EDGE='#3b5998',
                 DIAG='#4a5a85', ZERO='#3a4668', CELL_A='#0b0f18', CELL_B='#e6ebf5',
                 GRID3D=(0.25, 0.32, 0.5, 0.35), LINE3D=(0.3, 0.4, 0.65, 0.7), SURF_EDGE=(0.82, 0.88, 1, 0.38),
                 COOL=['#0b2a5f', '#1f5fd8', '#2F7DFF', '#4DB3FF', '#A8D8FF'], BARS_C=['#123c8c', '#2F7DFF', '#4DB3FF']),
    'light': dict(BG=(229, 234, 241), PANEL=(243, 246, 250), BORDER=(203, 211, 224), CANVAS_GRID=(218, 224, 233, 255),
                  SPINE='#a9b5c9', GRID='#d3dae6', TICK='#4f5c77', TXT='#44516c', TXT2='#1b2540', HERO='#0a1530',
                  LBLUE='#1557d6', PALE='#2f5fa8', NEUTRAL='#8fa3c6', IS_BG='#d3e0f8', OOS_BG='#d2ecdf', EDGE='#8396bd',
                  DIAG='#8693ad', ZERO='#8693ad', CELL_A='#0b0f18', CELL_B='#0b0f18',
                  GRID3D=(0.5, 0.56, 0.68, 0.55), LINE3D=(0.42, 0.48, 0.62, 0.85), SURF_EDGE=(0.1, 0.14, 0.26, 0.28),
                  COOL=['#78a5ee', '#3a78e8', '#1650c8', '#103c95', '#0a2a66'], BARS_C=['#5b93ea', '#1f63e0', '#123f9c']),
}
THEME = 'dark'
def set_theme(name):
    global THEME, BG, PANEL, BORDER, CANVAS_GRID, SPINE, GRID, TICK, TXT, TXT2, HERO, LBLUE, PALE, NEUTRAL, IS_BG, OOS_BG
    global EDGE, DIAG, ZERO, CELL_A, CELL_B, GRID3D, LINE3D, SURF_EDGE, SQ_COOL, BARS
    THEME = name; t = THEMES[name]
    BG, PANEL, BORDER, CANVAS_GRID = t['BG'], t['PANEL'], t['BORDER'], t['CANVAS_GRID']
    SPINE, GRID, TICK, TXT, TXT2, HERO = t['SPINE'], t['GRID'], t['TICK'], t['TXT'], t['TXT2'], t['HERO']
    LBLUE, PALE, NEUTRAL, IS_BG, OOS_BG, EDGE = t['LBLUE'], t['PALE'], t['NEUTRAL'], t['IS_BG'], t['OOS_BG'], t['EDGE']
    DIAG, ZERO, CELL_A, CELL_B = t['DIAG'], t['ZERO'], t['CELL_A'], t['CELL_B']
    GRID3D, LINE3D, SURF_EDGE = t['GRID3D'], t['LINE3D'], t['SURF_EDGE']
    SQ_COOL = LinearSegmentedColormap.from_list('sqc_' + name, t['COOL'])
    BARS = LinearSegmentedColormap.from_list('bars_' + name, t['BARS_C'])


def fig_to_img(fig):
    buf = io.BytesIO(); fig.savefig(buf, format='png', transparent=True, dpi=fig.dpi); plt.close(fig)
    buf.seek(0); return Image.open(buf).convert('RGBA')

def style(ax, ticks=True, label_size=9):
    ax.set_facecolor('none')
    for s in ax.spines.values(): s.set_color(SPINE); s.set_linewidth(0.8)
    ax.tick_params(colors=TICK, labelsize=label_size, length=3, width=0.6)
    ax.grid(color=GRID, lw=0.6)
    if not ticks: ax.set_xticklabels([]); ax.set_yticklabels([])

def panel(canvas, box, img=None, radius=18, title=None):
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle(box, radius=radius, fill=PANEL + (255,), outline=BORDER + (255,), width=2)
    if img is not None:
        x0, y0, x1, y1 = box
        im = img.resize((x1 - x0 - 40, y1 - y0 - 40), Image.LANCZOS)
        canvas.alpha_composite(im, (x0 + 20, y0 + 20))

def chart(w, h, draw, dpi=100):
    fig = plt.figure(figsize=(w / dpi, h / dpi), dpi=dpi)
    fig.patch.set_alpha(0)
    draw(fig)
    return fig_to_img(fig)

# ── grafici ────────────────────────────────────────────────────────────────
def mc_paths(n=320, steps=220, drift=0.0009, vol=0.012):
    r = rng.normal(drift, vol, size=(n, steps))
    return np.cumprod(1 + r, axis=1)

def draw_montecarlo(fig, n=320):
    ax = fig.add_axes([0.08, 0.1, 0.88, 0.85]); style(ax)
    P = mc_paths(n)
    x = np.arange(P.shape[1])
    fin = P[:, -1]; order = np.argsort(fin)
    norm = (fin - fin.min()) / (fin.max() - fin.min())
    lo, hi = np.percentile(P, 5, axis=0), np.percentile(P, 95, axis=0)
    ax.fill_between(x, lo, hi, color=BLUE, alpha=0.08, lw=0)
    for i in order:
        ax.plot(x, P[i], color=SQ_COOL(0.25 + 0.75 * norm[i]), lw=0.7, alpha=0.32)
    ax.plot(x, np.median(P, axis=0), color=HERO, lw=2.6)
    ax.plot(x, lo, color=RED, lw=1.2, ls='--', alpha=0.85); ax.plot(x, hi, color=GREEN, lw=1.2, ls='--', alpha=0.85)
    ax.set_xlim(0, x[-1]); ax.set_xlabel('Trade', color=TXT); ax.set_ylabel('Equity (x)', color=TXT)

def draw_hist(fig, highlight=True, label=True):
    ax = fig.add_axes([0.1, 0.14, 0.86, 0.8]); style(ax)
    data = rng.normal(17, 12, 40000)
    counts, edges = np.histogram(data, bins=46, range=(-25, 60))
    centers = (edges[:-1] + edges[1:]) / 2
    cols = [BARS(0.35 + 0.65 * np.exp(-((c - 17) / 26) ** 2)) for c in centers]
    ax.bar(centers, counts / counts.sum() * 100, width=(edges[1] - edges[0]) * 0.82, color=cols, alpha=0.95)
    p5, p50, p95 = np.percentile(data, [5, 50, 95])
    for v, c in ((p5, RED), (p50, 'white'), (p95, GREEN)):
        ax.axvline(v, color=c, lw=1.6, ls='--')
    if highlight: ax.axvspan(p5, p95, color=BLUE, alpha=0.06)
    ax.set_xlabel('Rendimento finale (%)', color=TXT); ax.set_ylabel('Frequenza (%)', color=TXT)

def draw_heatmap(fig):
    ax = fig.add_axes([0.12, 0.12, 0.74, 0.8]); style(ax)
    X, Y = np.meshgrid(np.linspace(-1, 1, 12), np.linspace(-1, 1, 12))
    Z = np.exp(-((X - .1) ** 2 + (Y + .05) ** 2) * 2.2) + rng.normal(0, .05, X.shape)
    im = ax.imshow(Z, cmap=SQ, origin='lower', extent=[10, 50, 10, 50], aspect='auto', alpha=0.88)
    cb = fig.colorbar(im, cax=fig.add_axes([0.89, 0.12, 0.03, 0.8])); cb.outline.set_color(SPINE); cb.ax.tick_params(colors=TICK, labelsize=8)
    ax.set_xlabel('Param A', color=TXT); ax.set_ylabel('Param B', color=TXT)

def draw_equity_dd(fig):
    ax = fig.add_axes([0.1, 0.42, 0.86, 0.52]); style(ax)
    eq = np.cumprod(1 + rng.normal(0.0009, 0.009, 900)); x = np.arange(900)
    ax.plot(x, eq, color=LBLUE, lw=1.6); ax.set_xticklabels([])
    ax2 = fig.add_axes([0.1, 0.1, 0.86, 0.26]); style(ax2)
    dd = eq / np.maximum.accumulate(eq) - 1
    ax2.fill_between(x, dd * 100, 0, color=RED, alpha=0.6, lw=0)
    ax.set_ylabel('Equity', color=TXT); ax2.set_ylabel('DD %', color=TXT)

def draw_surface(fig):
    ax = fig.add_axes([-0.02, 0.0, 1.04, 1.0], projection='3d')
    ax.set_facecolor('none')
    X, Y = np.meshgrid(np.linspace(10, 50, 46), np.linspace(10, 50, 46))
    u, v = (X - 30) / 20, (Y - 30) / 20
    Z = 0.32 * np.exp(-((u - .15) ** 2 + (v - .1) ** 2) * 2.6) + 0.12 * np.exp(-((u + .55) ** 2 + (v - .5) ** 2) * 5) \
        - 0.1 * np.exp(-((u - .4) ** 2 + (v + .7) ** 2) * 4) + 0.04 * np.sin(3 * u) * np.cos(2 * v) - 0.02
    surf = ax.plot_surface(X, Y, Z, cmap=SQ, rstride=1, cstride=1, linewidth=0.25, edgecolor=SURF_EDGE, antialiased=True, shade=False)
    k = np.unravel_index(np.argmax(Z), Z.shape)
    ax.scatter([X[k]], [Y[k]], [Z[k] + 0.012], color=AMBER, s=140, depthshade=False, edgecolor='#ffe39a', linewidth=1.2, zorder=10)
    ax.view_init(elev=27, azim=-58)
    for a in (ax.xaxis, ax.yaxis, ax.zaxis):
        a.set_pane_color((0, 0, 0, 0)); a._axinfo['grid']['color'] = GRID3D; a._axinfo['grid']['linewidth'] = 0.6
        a.line.set_color(LINE3D)
    ax.tick_params(colors=TXT, labelsize=9)
    ax.set_xlabel('Param A', color=TXT, labelpad=8); ax.set_ylabel('Param B', color=TXT, labelpad=8); ax.set_zlabel('Expectancy', color=TXT, labelpad=6)

def draw_scatter(fig):
    ax = fig.add_axes([0.09, 0.12, 0.87, 0.83]); style(ax)
    n = 1400
    mae = np.abs(rng.gamma(2.0, 9, n)); mfe = np.abs(rng.gamma(2.6, 14, n)) + mae * rng.uniform(0, .4, n)
    clus = rng.random(n) < 0.22
    mae[clus] = np.abs(rng.normal(10, 3, clus.sum())); mfe[clus] = np.abs(rng.normal(48, 9, clus.sum()))
    dens = mfe / (mae + 8)
    win = mfe[~clus] > mae[~clus] * 1.2
    cols = np.where(win[:, None], np.array([[0.24, 0.84, 0.55, 1]]), np.array([[0.90, 0.34, 0.31, 1]]))
    ax.scatter(mae[~clus], mfe[~clus], s=80, c=cols, alpha=0.05, lw=0)
    ax.scatter(mae[~clus], mfe[~clus], s=15, c=cols, alpha=0.8, lw=0)
    ax.scatter(mae[clus], mfe[clus], s=240, c=AMBER, alpha=0.05, lw=0)
    ax.scatter(mae[clus], mfe[clus], s=22, c=AMBER, alpha=0.9, lw=0)
    ax.scatter(mae[clus], mfe[clus], s=4, c='#fff1c2', alpha=0.9, lw=0)
    for q, c in ((50, PALE), (90, LBLUE)):
        ax.axvline(np.percentile(mae, q), color=c, lw=1, ls='--', alpha=0.8); ax.axhline(np.percentile(mfe, q), color=c, lw=1, ls='--', alpha=0.8)
    ax.plot([0, 70], [0, 70], color=DIAG, lw=1)
    ax.set_xlim(0, 70); ax.set_ylim(0, 120); ax.set_xlabel('MAE (punti)', color=TXT); ax.set_ylabel('MFE (punti)', color=TXT)

def draw_candles(fig):
    ax = fig.add_axes([0.06, 0.1, 0.9, 0.85]); style(ax, ticks=False)
    p = 100 + np.cumsum(rng.normal(0, 0.6, 70))
    for i in range(70):
        o, c = p[i - 1] if i else p[0], p[i]
        hi, lo = max(o, c) + abs(rng.normal(0, .4)), min(o, c) - abs(rng.normal(0, .4))
        col = GREEN if c >= o else RED
        ax.plot([i, i], [lo, hi], color=col, lw=0.8); ax.add_patch(plt.Rectangle((i - .3, min(o, c)), .6, abs(c - o) + .05, color=col))
    ax.set_xlim(-1, 70)

def draw_table(fig):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    for r in range(9):
        y = 0.9 - r * 0.1
        vals = [f"{rng.uniform(0.2, 0.4):.3f}", f"{rng.uniform(1.2, 1.6):.2f}", f"{rng.uniform(20, 35):.1f}%"]
        for j, v in enumerate(vals):
            ax.text(0.08 + j * 0.32, y, v, color=[PALE, TXT2, TXT][j], fontsize=12, family='DejaVu Sans Mono', transform=ax.transAxes)

# ── fotografia dello schermo ─────────────────────────────────────────────────
def homography(src, dst):
    A = []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    B = np.array(src).reshape(8)
    return np.linalg.solve(np.array(A, dtype=float), B)

def photograph(canvas, out_size, sharp_center, sharp_radius, tilt=(0.06, 0.03), dark_bottom=None, dark_left_bottom=None, vignette=0.55, gain=1.0):
    W, H = canvas.size
    # Prospettiva: lo schermo è inquadrato di tre quarti, leggermente dal basso.
    tx, ty = tilt
    src = [(0, 0), (W, 0), (W, H), (0, H)]
    dst = [(W * tx, H * ty * 1.4), (W * (1 - tx * 0.3), 0), (W, H), (0, H * (1 - ty * 0.6))]
    coeffs = homography(src, dst)
    img = canvas.convert('RGB').transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=BG)
    # Ritaglio interno (nessun bordo visibile) e formato finale.
    m = 0.07
    img = img.crop((int(W * m), int(H * m), int(W * (1 - m)), int(H * (1 - m))))
    img = img.resize(out_size, Image.LANCZOS)
    w, h = out_size
    # Profondità di campo: nitido attorno al soggetto, sfocato verso i bordi.
    blurred = img.filter(ImageFilter.GaussianBlur(7))
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = sharp_center[0] * w, sharp_center[1] * h
    rx, ry = sharp_radius[0] * w, sharp_radius[1] * h
    dist = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    mask = np.clip(1.6 - dist, 0, 1) ** 1.3
    img = Image.composite(img, blurred, Image.fromarray((mask * 255).astype('uint8')))
    arr = np.asarray(img).astype(np.float32)
    if THEME == 'light':
        return _photo_light(arr, xx, yy, w, h, dark_bottom, dark_left_bottom, vignette)
    # Bagliore dello schermo (bloom) sulle parti luminose.
    lum = arr.mean(axis=2, keepdims=True)
    bright = np.clip((lum - 110) / 145, 0, 1) * arr
    bloom = np.asarray(Image.fromarray(bright.astype('uint8')).filter(ImageFilter.GaussianBlur(14))).astype(np.float32)
    arr = np.clip(arr + bloom * 0.55, 0, 255)
    # Vignettatura + zone scure per il testo dell'app.
    vig = np.clip(1 - vignette * (((xx - w / 2) / (w * 0.75)) ** 2 + ((yy - h / 2) / (h * 0.75)) ** 2), 0.25, 1)
    arr *= vig[..., None]
    if dark_bottom is not None:
        t = np.clip((yy / h - dark_bottom) / (1 - dark_bottom), 0, 1)
        arr *= (1 - 0.93 * t ** 0.9)[..., None]
    if dark_left_bottom is not None:
        x0, y0 = dark_left_bottom
        t = np.clip((yy / h - y0) / (1 - y0), 0, 1) * np.clip((x0 - xx / w) / x0, 0, 1)
        arr *= (1 - 0.88 * np.clip(t * 2.2, 0, 1))[..., None]
    # Neri alzati verso il blu notte + grana fotografica.
    arr = arr * 0.97 * gain + np.array([3, 5, 11], dtype=np.float32)
    arr += rng.normal(0, 4.5, arr.shape[:2])[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype('uint8'))

def _photo_light(arr, xx, yy, w, h, quiet_bottom, quiet_left_bottom, vignette):
    # Schermo chiaro fotografato: bordi che sfumano verso un grigio-azzurro chiaro,
    # zone del testo bianche e pulite (l'app ci scrive sopra in scuro), grana leggera.
    edge = np.array([198, 206, 219], dtype=np.float32)
    white = np.array([232, 237, 244], dtype=np.float32)
    vig = np.clip(1 - vignette * 0.8 * (((xx - w / 2) / (w * 0.75)) ** 2 + ((yy - h / 2) / (h * 0.75)) ** 2), 0.35, 1)
    arr = arr * vig[..., None] + edge * (1 - vig[..., None])
    if quiet_bottom is not None:
        t = np.clip((yy / h - quiet_bottom) / (1 - quiet_bottom), 0, 1) ** 0.9 * 0.94
        arr = arr * (1 - t[..., None]) + white * t[..., None]
    if quiet_left_bottom is not None:
        x0, y0 = quiet_left_bottom
        t = np.clip(np.clip((yy / h - y0) / (1 - y0), 0, 1) * np.clip((x0 - xx / w) / x0, 0, 1) * 2.2, 0, 1) * 0.9
        arr = arr * (1 - t[..., None]) + white * t[..., None]
    arr += rng.normal(0, 3.2, arr.shape[:2])[..., None]
    img = Image.fromarray(np.clip(arr, 0, 255).astype('uint8'))
    img = ImageEnhance.Contrast(img).enhance(1.12)
    return ImageEnhance.Color(img).enhance(1.18)

def new_canvas(W, H):
    c = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(c)
    for x in range(0, W, 46): d.line([(x, 0), (x, H)], fill=CANVAS_GRID, width=1)
    for y in range(0, H, 46): d.line([(0, y), (W, y)], fill=CANVAS_GRID, width=1)
    return c

def dim(img, f):
    if THEME == 'light':
        r, g, b, a = img.split()
        a = a.point(lambda v: int(v * (0.5 + 0.5 * f)))
        return Image.merge('RGBA', (r, g, b, a))
    return ImageEnhance.Brightness(img).enhance(f)


# ── grafici aggiuntivi (uno per argomento) ───────────────────────────────────
def lbl(ax, x=None, y=None):
    if x: ax.set_xlabel(x, color=TXT)
    if y: ax.set_ylabel(y, color=TXT)

def main_ax(fig, rect=(0.09, 0.12, 0.87, 0.83)):
    ax = fig.add_axes(list(rect)); style(ax); return ax

def draw_discr_vs_quant(fig):
    ax = main_ax(fig); n = 600; x = np.arange(n)
    q = np.cumprod(1 + rng.normal(0.0011, 0.006, n))
    d = np.cumprod(1 + rng.normal(0.0004, 0.022, n) + np.where(rng.random(n) < 0.02, rng.normal(0, 0.06, n), 0))
    ax.plot(x, d, color=AMBER, lw=1.3, alpha=0.9, label='Discrezionale')
    ax.plot(x, q, color=LBLUE, lw=2.2, label='Quantitativo')
    ax.legend(loc='upper left', frameon=False, labelcolor=TXT, fontsize=10)
    lbl(ax, 'Trade', 'Equity (x)')

def draw_winrate_payoff(fig):
    ax = main_ax(fig)
    w = np.linspace(0.12, 0.9, 300); be = (1 - w) / w
    ax.fill_between(w * 100, be, 6, color=GREEN, alpha=0.12, lw=0)
    ax.fill_between(w * 100, 0, be, color=RED, alpha=0.10, lw=0)
    ax.plot(w * 100, be, color=HERO, lw=2)
    pw = rng.uniform(25, 75, 70); pp = (1 - pw / 100) / (pw / 100) * rng.uniform(0.6, 1.7, 70)
    good = pp > (1 - pw / 100) / (pw / 100)
    ax.scatter(pw[good], pp[good], s=30, color=GREEN, alpha=0.85, lw=0); ax.scatter(pw[~good], pp[~good], s=30, color=RED, alpha=0.75, lw=0)
    ax.scatter([42], [2.1], s=180, color=AMBER, edgecolor='#ffe39a', lw=1.2, zorder=5)
    ax.set_ylim(0, 5); ax.set_xlim(10, 90); lbl(ax, 'Win rate (%)', 'Payoff (R)')

def draw_overfit(fig):
    ax = main_ax(fig); k = np.arange(1, 21)
    is_ = 0.4 + 1.6 * (1 - np.exp(-k / 5)) + rng.normal(0, 0.03, k.size)
    oos = 0.35 + 0.9 * np.exp(-((k - 5) / 4.2) ** 2) - 0.03 * np.maximum(k - 8, 0) + rng.normal(0, 0.03, k.size)
    ax.axvspan(9, 20.5, color=RED, alpha=0.07)
    ax.plot(k, is_, color=LBLUE, lw=2.2, marker='o', ms=4, label='In-Sample')
    ax.plot(k, oos, color=GREEN, lw=2.2, marker='o', ms=4, label='Out-of-Sample')
    ax.axvline(5, color=HERO, ls='--', lw=1.2)
    ax.legend(loc='upper left', frameon=False, labelcolor=TXT); ax.set_xlim(0.5, 20.5)
    lbl(ax, 'Numero di parametri', 'Sharpe')

def draw_overfit_bars(fig):
    ax = main_ax(fig); k = np.arange(1, 13)
    v = 1.2 * np.exp(-((k - 3) / 3.5) ** 2) - 0.05 * k + 0.35 + rng.normal(0, 0.04, k.size)
    cols = [GREEN if x > 0.6 else (SAND if x > 0.3 else RED) for x in v]
    ax.bar(k, v, color=cols, width=0.7, alpha=0.9)
    ax.axhline(0, color='#2a3552', lw=1); lbl(ax, 'Complessità (n. regole)', 'Sharpe Out-of-Sample')

def draw_corr_matrix(fig):
    ax = fig.add_axes([0.13, 0.08, 0.84, 0.86]); style(ax); n = 8
    A = rng.normal(0, 1, (n, n)); C = np.corrcoef(A @ A.T + rng.normal(0, 2, (n, n)))
    for i in range(n):
        for j in range(n):
            if i < j: ax.add_patch(plt.Circle((j, i), 0.46 * abs(C[i, j]) ** 0.6, color=BLUE if C[i, j] > 0 else RED, alpha=0.35 + 0.6 * abs(C[i, j])))
            elif i > j: ax.text(j, i, f'{C[i, j]:.2f}', ha='center', va='center', fontsize=10, color=LBLUE if C[i, j] > 0 else RED)
            else: ax.add_patch(plt.Rectangle((j - 0.45, i - 0.45), 0.9, 0.9, color=_rgba(AMBER, 0.25)))
    names = ['EU', 'GU', 'UJ', 'XAU', 'NAS', 'SPX', 'DAX', 'WTI']
    ax.set_xticks(range(n)); ax.set_xticklabels(names); ax.set_yticks(range(n)); ax.set_yticklabels(names)
    ax.set_xlim(-0.5, n - 0.5); ax.set_ylim(n - 0.5, -0.5); ax.set_aspect('equal'); ax.grid(False)
    for k in range(n + 1): ax.axhline(k - 0.5, color=GRID, lw=0.6); ax.axvline(k - 0.5, color=GRID, lw=0.6)

def draw_mc_expect(fig):
    draw_montecarlo(fig, n=260)
    ax = fig.axes[0]; y1 = ax.get_ylim()[1]
    x = np.arange(220); ax.plot(x, 1 + (np.exp(x / 70) - 1) * 0.55, color=AMBER, lw=2, ls='--')
    ax.text(150, min(y1 * 0.97, 3.2), 'aspettativa', color=AMBER, fontsize=11)
    ax.set_ylim(top=max(y1, 3.3))

def draw_walkforward(fig):
    ax = fig.add_axes([0.08, 0.42, 0.88, 0.53]); style(ax)
    eq = np.cumprod(1 + rng.normal(0.001, 0.007, 800)); ax.plot(eq, color=LBLUE, lw=1.8); ax.set_xticklabels([])
    lbl(ax, None, 'Equity')
    ax2 = fig.add_axes([0.08, 0.1, 0.88, 0.27]); style(ax2, ticks=False); ax2.grid(False)
    for i in range(7):
        y = 6 - i; s0 = i * 90
        ax2.add_patch(plt.Rectangle((s0, y - 0.35), 240, 0.7, color='#1f5fd8', alpha=0.85))
        ax2.add_patch(plt.Rectangle((s0 + 240, y - 0.35), 90, 0.7, color=GREEN, alpha=0.85))
    ax2.set_xlim(0, 880); ax2.set_ylim(-0.6, 6.6); lbl(ax2, 'Finestre In-Sample / Out-of-Sample', None)

def draw_cloud3d(fig):
    ax = fig.add_axes([-0.02, 0.0, 1.04, 1.0], projection='3d'); ax.set_facecolor('none')
    a, b = np.meshgrid(np.linspace(0, 1, 18), np.linspace(0, 1, 18)); a, b = a.ravel(), b.ravel()
    z = 0.6 * np.exp(-((a - .62) ** 2 + (b - .55) ** 2) * 6) + 0.25 * (a + b) / 2 + rng.normal(0, 0.03, a.size)
    ax.scatter(a, b, z, c=SQ((z - z.min()) / (z.max() - z.min())), s=34, alpha=0.9, depthshade=False, edgecolor='none')
    k = np.argmax(z); ax.scatter([a[k]], [b[k]], [z[k] + 0.03], color=AMBER, s=260, depthshade=False, edgecolor='#ffe39a', lw=1.5)
    ax.view_init(elev=24, azim=-52)
    for ax_ in (ax.xaxis, ax.yaxis, ax.zaxis):
        ax_.set_pane_color((0, 0, 0, 0)); ax_._axinfo['grid']['color'] = GRID3D; ax_.line.set_color(LINE3D)
    ax.tick_params(colors=TXT, labelsize=9)
    ax.set_xlabel('Param A', color=TXT); ax.set_ylabel('Param B', color=TXT); ax.set_zlabel('Profit factor', color=TXT)

def draw_coverage(fig):
    ax = fig.add_axes([0.13, 0.12, 0.76, 0.82]); style(ax)
    mk = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'US500', 'NAS100', 'GER40', 'USOIL', 'BTCUSD', 'AUDUSD', 'USDCAD']
    yrs = np.arange(2008, 2026); M = np.clip(rng.uniform(0.7, 1, (len(mk), len(yrs))), 0, 1)
    M[8, :7] = 0; M[3, :2] *= 0.4; M[7, 3] = 0.2
    cm = LinearSegmentedColormap.from_list('cov', ['#0b1222', '#0f2a66', '#1a4fb8', '#2F7DFF', '#5aa6f0'] if THEME == 'dark' else ['#eef2f8', '#cfe0fb', '#7fb0f5', '#2F7DFF', '#1a4fb8'])
    ax.imshow(M, cmap=cm, aspect='auto', vmin=0, vmax=1.25, alpha=0.78)
    ax.set_yticks(range(len(mk))); ax.set_yticklabels(mk); ax.set_xticks(range(0, len(yrs), 3)); ax.set_xticklabels(yrs[::3]); ax.grid(False)
    lbl(ax, 'Anno', None)

def draw_costs(fig):
    ax = fig.add_axes([0.16, 0.12, 0.8, 0.82]); style(ax)
    mk = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'US500', 'NAS100', 'GER40', 'USOIL']
    sp = rng.uniform(0.4, 2.5, len(mk)); cm = rng.uniform(0.3, 1.2, len(mk)); y = np.arange(len(mk))
    ax.barh(y, sp, color=BLUE, height=0.6, label='Spread'); ax.barh(y, cm, left=sp, color=SAND, height=0.6, label='Commissioni')
    ax.set_yticks(y); ax.set_yticklabels(mk); ax.invert_yaxis(); ax.legend(loc='lower right', frameon=False, labelcolor=TXT)
    lbl(ax, 'Costo per trade (pip)', None)

def draw_swap(fig):
    ax = main_ax(fig, (0.1, 0.16, 0.86, 0.79))
    mk = ['EUR', 'GBP', 'JPY', 'XAU', 'AUD', 'CAD', 'CHF', 'NZD', 'OIL', 'BTC']
    lo = rng.normal(0, 3, len(mk)); sh = -lo * rng.uniform(0.6, 1.4, len(mk)) + rng.normal(0, 1, len(mk)); x = np.arange(len(mk))
    ax.bar(x - 0.2, lo, 0.38, color=[GREEN if v > 0 else RED for v in lo]); ax.bar(x + 0.2, sh, 0.38, color=[GREEN if v > 0 else RED for v in sh], alpha=0.55)
    ax.axhline(0, color=ZERO, lw=1); ax.set_xticks(x); ax.set_xticklabels(mk); lbl(ax, None, 'Swap (punti/notte)')

def draw_sessions(fig):
    ax = main_ax(fig); n = 96 * 3; x = np.arange(n)
    p = 1.085 + np.cumsum(rng.normal(0, 0.0004, n))
    for d in range(3):
        b = d * 96
        ax.axvspan(b + 0, b + 32, color='#123c8c', alpha=0.25); ax.axvspan(b + 32, b + 60, color='#1f5fd8', alpha=0.22); ax.axvspan(b + 52, b + 84, color=SAND, alpha=0.10)
        ax.axvline(b, color=AMBER, ls='--', lw=1.2)
    ax.plot(x, p, color=PALE, lw=1.5); ax.set_xlim(0, n); lbl(ax, 'Ora (UTC)', 'Prezzo')

def draw_multiseries(fig):
    ax = main_ax(fig); n = 700; x = np.arange(n)
    for i in range(14):
        s_ = np.cumprod(1 + rng.normal(0.0002, 0.008 + 0.004 * rng.random(), n))
        ax.plot(x, s_, color=SQ_COOL(0.25 + 0.7 * rng.random()), lw=0.9, alpha=0.6)
    ax.plot(x, np.cumprod(1 + rng.normal(0.0004, 0.007, n)), color=HERO, lw=2)
    lbl(ax, 'Barre', 'Prezzo normalizzato')

def draw_regression(fig):
    ax = main_ax(fig); n = 260
    x = rng.normal(0, 1, n); y = 0.55 * x + rng.normal(0, 0.7, n)
    xs = np.linspace(-3, 3, 100); b = np.polyfit(x, y, 1); yh = np.polyval(b, xs)
    ax.fill_between(xs, yh - 0.25 - 0.08 * xs ** 2, yh + 0.25 + 0.08 * xs ** 2, color=BLUE, alpha=0.18, lw=0)
    ax.scatter(x, y, s=22, color=LBLUE, alpha=0.75, lw=0); ax.plot(xs, yh, color=HERO, lw=2.2)
    ax.text(-2.8, 2.6, f'β = {b[0]:.2f}   t = 6.41   p < 0.001', color=TXT, fontsize=11)
    lbl(ax, 'Fattore (z-score)', 'Rendimento successivo (%)')

def draw_tstat(fig):
    ax = main_ax(fig); t = rng.normal(0.3, 1.1, 5000)
    counts, edges = np.histogram(t, bins=50, range=(-4, 5)); c = (edges[:-1] + edges[1:]) / 2
    ax.bar(c, counts, width=(edges[1] - edges[0]) * 0.85, color=[GREEN if v > 2 else (RED if v < -2 else BLUE) for v in c])
    for v in (-2, 2): ax.axvline(v, color=HERO, ls='--', lw=1.2)
    lbl(ax, 't-statistic', 'Numero di studi')

def draw_hypothesis(fig):
    ax = main_ax(fig); x = np.linspace(-4, 7, 600)
    h0 = np.exp(-x ** 2 / 2); h1 = np.exp(-(x - 2.8) ** 2 / 2)
    ax.fill_between(x, 0, h0, color=SAND, alpha=0.18, lw=0); ax.plot(x, h0, color=SAND, lw=2, label='H0: nessun edge')
    ax.fill_between(x, 0, h1, color=BLUE, alpha=0.22, lw=0); ax.plot(x, h1, color=LBLUE, lw=2.2, label='H1: edge')
    crit = 1.96; m = x > crit
    ax.fill_between(x[m], 0, h0[m], color=RED, alpha=0.55, lw=0); ax.fill_between(x[m], 0, h1[m], color=GREEN, alpha=0.18, lw=0)
    ax.axvline(crit, color=HERO, ls='--', lw=1.2); ax.legend(loc='upper right', frameon=False, labelcolor=TXT)
    lbl(ax, 'Statistica del test', 'Densità')

def draw_cond_hist(fig):
    ax = main_ax(fig)
    a = rng.normal(0.35, 1, 6000); b = rng.normal(-0.05, 1.1, 6000)
    ax.hist(b, bins=60, range=(-4, 4), color=SAND, alpha=0.45, label='Condizione assente')
    ax.hist(a, bins=60, range=(-4, 4), color=BLUE, alpha=0.7, label='Condizione presente')
    ax.axvline(a.mean(), color=LBLUE, ls='--', lw=1.4); ax.axvline(b.mean(), color=SAND, ls='--', lw=1.4)
    ax.legend(loc='upper left', frameon=False, labelcolor=TXT); lbl(ax, 'Rendimento per trade (R)', 'Frequenza')

def draw_random_vs_yours(fig):
    ax = main_ax(fig); r = rng.normal(0.95, 0.35, 897)
    counts, edges = np.histogram(r, bins=44, range=(-0.2, 2.6)); c = (edges[:-1] + edges[1:]) / 2
    ax.bar(c, counts, width=(edges[1] - edges[0]) * 0.85, color=NEUTRAL, alpha=0.95)
    thr = np.percentile(r, 95); ax.axvline(thr, color=HERO, ls='--', lw=1.4)
    ax.axvline(2.15, color=AMBER, lw=3); ax.text(2.18, counts.max() * 0.92, 'il tuo risultato', color=AMBER, fontsize=11)
    ax.text(thr + 0.03, counts.max() * 0.78, 'soglia da battere', color=TXT2, fontsize=10)
    lbl(ax, 'Profit factor (897 strategie casuali)', 'Frequenza')

def draw_percentile_bands(fig):
    ax = main_ax(fig); P = mc_paths(500, 240, 0.0008, 0.011); x = np.arange(P.shape[1])
    for lo, hi, a in ((5, 95, 0.16), (25, 75, 0.32)):
        ax.fill_between(x, np.percentile(P, lo, axis=0), np.percentile(P, hi, axis=0), color=BLUE, alpha=a, lw=0)
    for q, c in ((5, RED), (95, GREEN)): ax.plot(x, np.percentile(P, q, axis=0), color=c, lw=1.4, ls='--')
    ax.plot(x, np.median(P, axis=0), color=HERO, lw=2.4); lbl(ax, 'Trade', 'Equity (x)')

def draw_table_heat(fig):
    ax = fig.add_axes([0.02, 0.04, 0.96, 0.92]); ax.axis('off'); ax.set_xlim(0, 7.1); ax.set_ylim(0, 7.9)
    cols = ['MAE', 'MFE', 'MFE/MAE', 'Stop', 'Target', 'Win %']; rows = ['P10', 'P25', 'P50', 'P75', 'P90', 'P95']
    for j, c in enumerate(cols): ax.text(1.1 + j, 7.25, c, color=TXT2, fontsize=14, weight='bold')
    for i, r in enumerate(rows):
        y = 6.3 - i; ax.text(0.15, y, r, color=TXT2, fontsize=15, va='center'); ax.plot([0.1, 7.05], [y - 0.5, y - 0.5], color=GRID, lw=1)
        for j in range(len(cols)):
            v = rng.uniform(0.15, 1); c = LBLUE if j < 3 else (GREEN if j == 5 else SAND)
            ax.add_patch(plt.Rectangle((1.05 + j, y - 0.28), 0.86 * v, 0.56, color=_rgba(c, 0.38)))
            ax.text(1.12 + j, y, f'{v * 60:.1f}', color=TXT2, fontsize=14, va='center')
    ax.add_patch(plt.Rectangle((0.08, 3.8), 6.98, 1.0, fill=False, ec=AMBER, lw=1.8))

def draw_pred_actual(fig):
    ax = main_ax(fig); n = 500
    yt = rng.normal(0, 1, n); yp = 0.62 * yt + rng.normal(0, 0.55, n)
    ax.scatter(yp, yt, s=16, c=SQ_COOL(np.clip(0.4 + 0.3 * yt, 0.2, 1)), alpha=0.7, lw=0)
    ax.plot([-3, 3], [-3, 3], color=DIAG, lw=1, ls='--'); b = np.polyfit(yp, yt, 1); xs = np.linspace(-3, 3, 50)
    ax.plot(xs, np.polyval(b, xs), color=AMBER, lw=2); ax.set_xlim(-3, 3); ax.set_ylim(-3, 3)
    lbl(ax, 'Previsione del modello', 'Rendimento reale')

def draw_graph(fig):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off'); n = 70
    pos = rng.normal(0, 1, (n, 2)); hubs = rng.choice(n, 6, replace=False)
    edges = set()
    for i in range(n):
        for j in rng.choice(n, 2, replace=False):
            if i != j: edges.add((min(i, j), int(max(i, j))))
    for h in hubs:
        for j in rng.choice(n, 7, replace=False): edges.add((min(h, j), int(max(h, j))))
    E = list(edges)
    for _ in range(220):  # layout a molle molto semplice
        d = pos[:, None, :] - pos[None, :, :]; dist = np.linalg.norm(d, axis=2) + 1e-3
        rep = (d / dist[..., None] ** 3).sum(1) * 0.02
        att = np.zeros_like(pos)
        for i, j in E:
            v = pos[j] - pos[i]; att[i] += v * 0.02; att[j] -= v * 0.02
        pos += rep + att - pos * 0.005
    pos = (pos - pos.min(0)) / (pos.max(0) - pos.min(0)); pos = pos * 0.86 + 0.07
    for i, j in E: ax.plot(*zip(pos[i], pos[j]), color=EDGE, lw=0.8, alpha=0.45)
    sizes = np.full(n, 40.0); sizes[hubs] = 260
    cols = [AMBER if i in hubs else LBLUE for i in range(n)]
    ax.scatter(pos[:, 0], pos[:, 1], s=sizes * 3.5, c=cols, alpha=0.08, lw=0)
    ax.scatter(pos[:, 0], pos[:, 1], s=sizes, c=cols, alpha=0.95, lw=0)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)

def draw_is_oos(fig):
    ax = main_ax(fig); n = 900; x = np.arange(n)
    eq = np.cumprod(1 + rng.normal(0.0009, 0.007, n)); split = 600
    ax.axvspan(0, split, color=IS_BG, alpha=0.55); ax.axvspan(split, n, color=OOS_BG, alpha=0.55)
    ax.axvline(split, color=HERO, ls='--', lw=1.4); ax.plot(x, eq, color=LBLUE, lw=2)
    y1 = ax.get_ylim()[1]; ax.text(split * 0.35, y1 * 0.97, 'In-Sample', color=TXT2, fontsize=12); ax.text(split + 80, y1 * 0.97, 'Out-of-Sample', color=TXT2, fontsize=12)
    ax.set_xlim(0, n); lbl(ax, 'Trade', 'Equity (x)')

# ── live: trading ────────────────────────────────────────────────────────────
def draw_breakout(fig):
    ax = main_ax(fig); n = 96
    lo_, hi_ = 99.2, 101.0; p = [100.1]
    for i in range(1, n):
        if i < 62: p.append(np.clip(p[-1] + rng.normal(0, 0.32), lo_ + 0.15, hi_ - 0.15))
        else: p.append(p[-1] + abs(rng.normal(0.22, 0.25)) * (1 if i < 88 else rng.choice([-1, 1])))
    p = np.array(p)
    ax.axhspan(lo_, hi_, xmin=0, xmax=62 / (n + 2), color=BLUE, alpha=0.10)
    for y_, c_ in ((hi_, GREEN), (lo_, RED)): ax.hlines(y_, 0, 62, color=c_, ls='--', lw=1.3)
    for i in range(n):
        o, c = (p[i - 1] if i else p[0]), p[i]
        h, l = max(o, c) + abs(rng.normal(0, .12)), min(o, c) - abs(rng.normal(0, .12))
        col = GREEN if c >= o else RED
        ax.plot([i, i], [l, h], color=col, lw=0.9)
        ax.add_patch(plt.Rectangle((i - .32, min(o, c)), .64, abs(c - o) + .02, color=col))
    k = 63; ax.scatter([k], [p[k]], s=200, color=AMBER, edgecolor='#ffe39a', lw=1.3, zorder=6)
    tgt = hi_ + (hi_ - lo_) * 2.2; ax.axhline(tgt, color=AMBER, lw=1.1, ls=':', alpha=0.9)
    ax.text(2, hi_ + 0.08, 'Massimo di ieri', color=TXT2, fontsize=10); ax.text(2, lo_ - 0.25, 'Minimo di ieri', color=TXT2, fontsize=10)
    ax.text(66, tgt + 0.08, 'Target', color=AMBER, fontsize=10)
    ax.set_xlim(-1, n + 1); ax.set_ylim(lo_ - 0.6, tgt + 0.5); lbl(ax, 'Barre (H1)', 'Prezzo')

def draw_prop(fig):
    ax = main_ax(fig); n = 420; x = np.arange(n)
    def walk(vol, end):
        w = np.cumsum(rng.normal(0, vol, n)); return 100 * np.exp(w - np.linspace(0, w[-1], n) + np.linspace(0, np.log(end), n))
    prop = walk(0.0062, 1.112); real = walk(0.003, 1.045)
    ax.axhspan(80, 90, color=RED, alpha=0.10); ax.axhline(90, color=RED, ls='--', lw=1.3)
    ax.axhline(110, color=GREEN, ls='--', lw=1.3)
    ax.plot(x, real, color=SAND, lw=1.8, label='Conto reale'); ax.plot(x, prop, color=LBLUE, lw=2.2, label='Conto prop')
    ax.text(6, 110.5, 'Profit target  +10%', color=GREEN, fontsize=10); ax.text(6, 88.4, 'Max drawdown  −10%', color=RED, fontsize=10)
    ax.legend(loc='upper left', bbox_to_anchor=(0, 0.93), frameon=False, labelcolor=TXT)
    ax.set_xlim(0, n); ax.set_ylim(84, max(118, prop.max() + 2)); lbl(ax, 'Giorni di trading', 'Capitale (%)')

def draw_cycle(fig):
    ax = fig.add_axes([0.08, 0.06, 0.84, 0.88], projection='polar'); ax.set_facecolor('none')
    h = np.arange(24); th = (h + 0.5) / 24 * 2 * np.pi
    v = 0.35 + 0.9 * np.exp(-((h - 8.5) / 1.6) ** 2) + 1.1 * np.exp(-((h - 14.5) / 1.8) ** 2) + 0.25 * np.exp(-((h - 1) / 1.5) ** 2) + rng.uniform(0, 0.08, 24)
    cols = [BARS(0.25 + 0.75 * (x_ - v.min()) / (v.max() - v.min())) for x_ in v]
    ax.bar(th, v, width=2 * np.pi / 24 * 0.82, color=cols, alpha=0.95, bottom=0.25)
    for hh in (8, 14): ax.bar([(hh + 0.5) / 24 * 2 * np.pi], [v[hh]], width=2 * np.pi / 24 * 0.82, color=AMBER, bottom=0.25, alpha=0.95)
    ax.set_theta_zero_location('N'); ax.set_theta_direction(-1)
    ax.set_xticks(np.arange(0, 24, 3) / 24 * 2 * np.pi); ax.set_xticklabels([f'{x_:02d}:00' for x_ in range(0, 24, 3)], color=TICK, fontsize=10)
    ax.set_yticklabels([]); ax.grid(color=GRID, lw=0.7); ax.spines['polar'].set_color(SPINE)
    ax.text(0, 0, 'volatilità\nmedia oraria', ha='center', va='center', color=TXT, fontsize=10)

# ── live: mente (cervello, neuroni, particelle) ──────────────────────────────
from matplotlib.collections import LineCollection

def _rgba(c, a=1.0):
    r, g, b, _ = matplotlib.colors.to_rgba(c); return (r, g, b, a)

def _mix(c1, c2, t):
    a, b = np.array(matplotlib.colors.to_rgba(c1)), np.array(matplotlib.colors.to_rgba(c2))
    t = np.asarray(t)[..., None]; return a * (1 - t) + b * t

def _glow():
    return THEME == 'dark'

_BRAIN_PARTS = [  # centro, semiassi (0-3 corteccia, 4-5 cervelletto)
    ((0.0, 0.37, 0.06), (1.0, 0.47, 0.68)), ((0.0, -0.37, 0.06), (1.0, 0.47, 0.68)),
    ((0.14, 0.47, -0.30), (0.54, 0.31, 0.29)), ((0.14, -0.47, -0.30), (0.54, 0.31, 0.29)),
    ((-0.70, 0.24, -0.43), (0.34, 0.30, 0.22)), ((-0.70, -0.24, -0.43), (0.34, 0.30, 0.22)),
]
_STEM = (np.array([-0.24, 0, -0.42]), np.array([-0.36, 0, -0.98]), 0.105)

def _part_r(P, k):
    c, s = np.array(_BRAIN_PARTS[k][0]), np.array(_BRAIN_PARTS[k][1])
    sz = np.where(P[:, 2] < c[2], s[2] * 0.78, s[2]) if k < 2 else s[2]
    return np.sqrt(((P[:, 0] - c[0]) / s[0]) ** 2 + ((P[:, 1] - c[1]) / s[1]) ** 2 + ((P[:, 2] - c[2]) / sz) ** 2)

def _stem_r(P):
    a, b, rad = _STEM; ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1) / rad, t

def _brain_shell(density=0.32):
    """Punti sulla superficie di un cervello (emisferi con circonvoluzioni, lobi
    temporali, cervelletto con lamelle, tronco): campionati direttamente sulle
    superfici e tenuti solo dove nessun'altra parte li copre."""
    counts = [900_000, 900_000, 260_000, 260_000, 200_000, 200_000]
    Ps, Ns, Ks = [], [], []
    for k, n in enumerate(counts):
        n = int(n * density); c, s = np.array(_BRAIN_PARTS[k][0]), np.array(_BRAIN_PARTS[k][1])
        d = rng.normal(0, 1, (n, 3)); d /= np.linalg.norm(d, axis=1, keepdims=True)
        ss = np.tile(s, (n, 1))
        if k < 2: ss[d[:, 2] < 0, 2] *= 0.78
        P = c + d * ss; N = d / ss; N /= np.linalg.norm(N, axis=1, keepdims=True)
        ok = np.ones(n, bool)
        for j in range(len(_BRAIN_PARTS)):
            if j != k: ok &= _part_r(P, j) >= 0.999
        ok &= _stem_r(P)[0] >= 1
        Ps.append(P[ok]); Ns.append(N[ok]); Ks.append(np.full(ok.sum(), 0 if k < 4 else 1))
    n = int(120_000 * density); a, b, rad = _STEM; t = rng.uniform(0, 1, n); ang = rng.uniform(0, 2 * np.pi, n)
    ax_ = (b - a) / np.linalg.norm(b - a); e1 = np.cross(ax_, [0, 1, 0]); e1 /= np.linalg.norm(e1); e2 = np.cross(ax_, e1)
    rr = (np.cos(ang)[:, None] * e1 + np.sin(ang)[:, None] * e2)
    P = a + t[:, None] * (b - a) + rr * rad; ok = np.ones(n, bool)
    for j in range(len(_BRAIN_PARTS)): ok &= _part_r(P, j) >= 1
    Ps.append(P[ok]); Ns.append(rr[ok]); Ks.append(np.full(ok.sum(), 2))
    P, N, kind = np.concatenate(Ps), np.concatenate(Ns), np.concatenate(Ks)
    # circonvoluzioni: insieme di livello zero di un campo casuale
    K = 16; D = rng.normal(0, 1, (K, 3)); D /= np.linalg.norm(D, axis=1, keepdims=True)
    f = rng.uniform(15, 21, K); ph = rng.uniform(0, 2 * np.pi, K)
    g = (np.sin((P @ D.T) * f + ph)).sum(1) / np.sqrt(K / 2)
    sulc = (kind == 0) & (np.abs(g) < 0.26)
    return P, N, kind, g, sulc

def _view(P, az, el):
    az, el = np.radians(az), np.radians(el)
    Rz = np.array([[np.cos(az), -np.sin(az), 0], [np.sin(az), np.cos(az), 0], [0, 0, 1]])
    Rx = np.array([[1, 0, 0], [0, np.cos(el), -np.sin(el)], [0, np.sin(el), np.cos(el)]])
    Q = P @ (Rx @ Rz).T
    return Q[:, 0], Q[:, 2], -Q[:, 1]   # u, v, profondità (più alto = più vicino)

def _set_frame(ax, fig, u, v, pad=0.08, cx=0.5, cy=0.5):
    W, H = fig.get_size_inches(); asp = W / H
    w = (u.max() - u.min()) * (1 + pad * 2); h = (v.max() - v.min()) * (1 + pad * 2)
    if w / h < asp: w = h * asp
    else: h = w / asp
    mu, mv = (u.max() + u.min()) / 2, (v.max() + v.min()) / 2
    ax.set_xlim(mu - w * cx, mu + w * (1 - cx)); ax.set_ylim(mv - h * cy, mv + h * (1 - cy))

def draw_brain(fig, az=-18, el=10, active=((0.72, -0.25, 0.25),), burst=True, cx=0.5, cy=0.5):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    P, N, kind, g, sulc = _brain_shell()
    u, v, z = _view(P, az, el)
    # z-buffer: si vede solo la superficie più vicina (opaca)
    cell = (u.max() - u.min()) / 300
    iu = ((u - u.min()) / cell).astype(int); iv = ((v - v.min()) / cell).astype(int)
    zb = np.full((iu.max() + 1, iv.max() + 1), -9.0); np.maximum.at(zb, (iu, iv), z)
    vis = (z >= zb[iu, iv] - 0.04) & ~sulc
    P, N, kind, g, u, v, z = P[vis], N[vis], kind[vis], g[vis], u[vis], v[vis], z[vis]
    _, _, nz = _view(N, az, el)
    zn = (z - z.min()) / (z.max() - z.min())
    rim = 1 - np.abs(nz)                                     # bordi illuminati (silhouette)
    nu, nv, _ = _view(N, az, el); lam = np.clip(-0.45 * nu + 0.7 * nv + 0.55 * nz, 0, 1)  # luce dall'alto
    crown = np.clip((np.abs(g) - 0.24) / 1.2, 0, 1)
    light = np.clip(0.1 + 0.5 * lam + 0.55 * rim ** 2.5 + 0.3 * crown * (kind == 0) - 0.15 * (1 - crown) * (kind == 0), 0, 1)
    light[kind == 1] *= 0.75 + 0.25 * np.sin(P[kind == 1, 2] * 70 + P[kind == 1, 0] * 20)  # lamelle
    light[kind == 2] *= 0.75 * np.clip((P[kind == 2, 2] + 1.0) / 0.55, 0.05, 1)
    act = np.zeros(len(P))
    for c in active: act = np.maximum(act, np.exp(-((P - np.array(c)) ** 2).sum(1) / 0.06))
    base = SQ_COOL(0.18 + 0.8 * light)
    hot = _mix(AMBER, '#fff3d0' if _glow() else '#c25a00', np.clip(act * 1.4 - 0.4, 0, 1))
    col = base * (1 - act[:, None] * 0.92) + hot * act[:, None] * 0.92
    col[:, 3] = np.clip(0.25 + 0.75 * light + act, 0, 1) * (0.9 if _glow() else 1.0)
    o = np.argsort(z); s = (0.5 + 1.6 * light + 2.5 * act)
    if _glow(): ax.scatter(u[o], v[o], s=s[o] * 7, c=col[o] * np.array([1, 1, 1, 0.012]), lw=0)
    ax.scatter(u[o], v[o], s=s[o], c=col[o], lw=0)
    if burst:  # esplosione di particelle dalla zona attiva
        for c in active:
            m = 900; d = rng.normal(0, 1, (m, 3)); d /= np.linalg.norm(d, axis=1, keepdims=True)
            out = np.array(c) / (np.linalg.norm(c) + 1e-6); d = d + out * 1.3; d /= np.linalg.norm(d, axis=1, keepdims=True)
            r0 = rng.gamma(1.5, 0.15, m) + 0.05; ln = 0.02 + 0.1 * r0
            A = np.array(c) + d * r0[:, None]; B = np.array(c) + d * (r0 + ln)[:, None]
            ua, va, _ = _view(A, az, el); ub, vb, _ = _view(B, az, el)
            fade = np.clip(1 - r0 / 1.1, 0, 1)
            cc = _mix(AMBER, PALE, np.clip(r0 / 0.22, 0, 1)); cc[:, 3] = 0.1 + 0.7 * fade ** 1.8
            ax.add_collection(LineCollection(np.stack([np.c_[ua, va], np.c_[ub, vb]], 1), colors=cc, linewidths=0.6 + 1.2 * fade))
            uc, vc, _ = _view(np.array([c]), az, el)
            if _glow():
                for sz, al in ((5000, 0.035), (1500, 0.08), (350, 0.25)): ax.scatter(uc, vc, s=sz, color=AMBER, alpha=al, lw=0)
    nodes = rng.uniform([-0.9, -0.6, -0.35], [0.9, 0.6, 0.6], (400, 3))
    inside = (((nodes - [0, 0, 0.06]) / [0.92, 0.78, 0.6]) ** 2).sum(1) < 1; nodes = nodes[inside][:110]
    un, vn, zn_ = _view(nodes, az, el); segs, ec = [], []
    for i in range(len(nodes)):
        for j in np.argsort(((nodes - nodes[i]) ** 2).sum(1))[1:4]:
            near = max(np.exp(-((nodes[i] - np.array(c)) ** 2).sum() / 0.08) for c in active)
            segs.append([(un[i], vn[i]), (un[j], vn[j])]); ec.append(_rgba(AMBER if near > 0.5 else LBLUE, 0.35 if near > 0.5 else 0.22))
    ax.add_collection(LineCollection(segs, colors=ec, linewidths=0.7))
    na = np.array([max(np.exp(-((p - np.array(c)) ** 2).sum() / 0.08) for c in active) for p in nodes])
    ncol = _mix(PALE, AMBER, np.clip(na * 1.5, 0, 1))
    if _glow(): ax.scatter(un, vn, s=160, c=ncol * [1, 1, 1, 0.08], lw=0)
    ax.scatter(un, vn, s=10 + 18 * na, c=ncol, lw=0)
    dust = rng.uniform([-1.4, -1.2, -1.3], [1.4, 1.2, 1.1], (900, 3)); ud, vd, zd = _view(dust, az, el)
    ax.scatter(ud, vd, s=rng.uniform(0.3, 3, 900), color=LBLUE, alpha=0.25 if _glow() else 0.35, lw=0)
    _set_frame(ax, fig, u, v, pad=0.06, cx=cx, cy=cy)

def _tree(segs, widths, p, ang, length, width, depth, wiggle=0.35):
    pts = [np.array(p, float)]; a = ang
    for _ in range(6):
        a += rng.normal(0, wiggle * 0.35); pts.append(pts[-1] + length / 6 * np.array([np.cos(a), np.sin(a)]))
    for i in range(6): segs.append([pts[i], pts[i + 1]]); widths.append(width * (1 - i / 9))
    if depth > 0:
        for sgn in (-1, 1):
            if rng.random() < 0.9:
                _tree(segs, widths, pts[-1], a + sgn * rng.uniform(0.25, 0.7), length * rng.uniform(0.62, 0.8), width * 0.66, depth - 1, wiggle)
    return pts[-1]

def _neuron(ax, c, size=1.0, dendrites=7, depth=4, col=None, glow_alpha=0.07):
    col = col or PALE; segs, widths = [], []
    for k in range(dendrites):
        _tree(segs, widths, c, 2 * np.pi * k / dendrites + rng.normal(0, 0.25), 0.22 * size * rng.uniform(0.8, 1.3), 2.6 * size, depth)
    w = np.array(widths)
    if _glow(): ax.add_collection(LineCollection(segs, colors=[_rgba(col, glow_alpha)], linewidths=w * 4))
    ax.add_collection(LineCollection(segs, colors=[_rgba(col, 0.8)], linewidths=w))
    ax.scatter([c[0]], [c[1]], s=260 * size ** 2, color=col, lw=0, zorder=4)

def _burst(ax, c, n=5000, scale=1.0):
    th = rng.uniform(0, 2 * np.pi, n); r = (rng.gamma(1.5, 0.22, n) + 0.03) * scale
    ln = (0.02 + 0.16 * r / scale) * scale; d = np.c_[np.cos(th), np.sin(th)]
    A = np.array(c) + d * r[:, None]; B = np.array(c) + d * (r + ln)[:, None]
    fade = np.clip(1 - r / (1.5 * scale), 0, 1)
    cc = _mix('#fff3d0' if _glow() else AMBER, AMBER, np.clip(r / (0.08 * scale), 0, 1))
    far = np.clip((r / scale - 0.03) / 0.14, 0, 1); cc = cc * (1 - far[:, None]) + _mix(PALE, BLUE, np.clip(r / scale / 0.9, 0, 1)) * far[:, None]
    cc[:, 3] = (0.1 + 0.75 * fade ** 2)
    ax.add_collection(LineCollection(np.stack([A, B], 1), colors=cc, linewidths=0.5 + 1.3 * fade))
    for rr in (0.55, 0.95): ax.add_patch(plt.Circle(c, rr * scale, fill=False, color=LBLUE, lw=0.8, alpha=0.22))
    if _glow():
        for sz, al in ((9000 * scale, 0.03), (2600 * scale, 0.07), (700 * scale, 0.2), (160, 0.6)): ax.scatter([c[0]], [c[1]], s=sz, color=AMBER, alpha=al, lw=0, zorder=5)
    ax.scatter([c[0]], [c[1]], s=120, color='white' if _glow() else AMBER, lw=0, zorder=6)

def draw_neuron_burst(fig, c=(0.1, 0.05), scale=1.0, sats=0):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    W, H = fig.get_size_inches(); asp = W / H
    ax.set_xlim(-1.05 * asp, 1.05 * asp); ax.set_ylim(-1.05, 1.05)
    a0 = rng.uniform(0, 2 * np.pi)
    for i in range(sats):  # neuroni vicini collegati, con impulsi in arrivo
        ang = a0 + 2 * np.pi * i / sats + rng.normal(0, 0.25); dist = rng.uniform(0.7, 0.95)
        p = np.array(c) + dist * np.array([np.cos(ang) * 1.15, np.sin(ang)])
        p = np.clip(p, [-0.9 * asp, -0.85], [0.9 * asp, 0.85])
        m = (np.array(c) + p) / 2 + rng.normal(0, 0.12, 2); t = np.linspace(0, 1, 60)[:, None]
        curve = (1 - t) ** 2 * np.array(c) + 2 * (1 - t) * t * m + t ** 2 * p
        ax.plot(curve[:, 0], curve[:, 1], color=LBLUE, lw=1.4, alpha=0.6)
        k = int(rng.uniform(18, 45)); tr = curve[k:k + 14]
        ax.add_collection(LineCollection(np.stack([tr[:-1], tr[1:]], 1), colors=[_rgba(AMBER, x_) for x_ in np.linspace(0.95, 0.05, len(tr) - 1)], linewidths=2.4))
        if _glow(): ax.scatter(*curve[k], s=600, color=AMBER, alpha=0.12, lw=0)
        ax.scatter(*curve[k], s=40, color=AMBER, lw=0, zorder=6)
        _neuron(ax, p, size=0.5 + 0.2 * rng.random(), dendrites=6, depth=3, col=LBLUE if i % 2 else PALE, glow_alpha=0.05)
    _neuron(ax, c, size=1.25 * scale, dendrites=8, depth=5 if scale >= 0.9 else 4)
    # assone con guaina mielinica e impulsi
    a = np.array(c, float); ang = rng.uniform(3.6, 4.1); pts = [a]
    for _ in range(40): ang += rng.normal(0, 0.05); pts.append(pts[-1] + 0.045 * np.array([np.cos(ang), np.sin(ang)]))
    pts = np.array(pts)
    for i in range(3, 39, 4):
        ax.plot(pts[i:i + 3, 0], pts[i:i + 3, 1], color=BLUE, lw=7, alpha=0.75, solid_capstyle='round')
    ax.plot(pts[:, 0], pts[:, 1], color=PALE, lw=1.6, alpha=0.9)
    for i in (12, 27):
        if _glow(): ax.scatter(*pts[i], s=900, color=AMBER, alpha=0.12, lw=0)
        ax.scatter(*pts[i], s=70, color=AMBER, lw=0, zorder=6)
    _burst(ax, c, n=int(3200 * scale), scale=scale)
    dust = rng.uniform([-1.1 * asp, -1.1], [1.1 * asp, 1.1], (700, 2))
    ax.scatter(dust[:, 0], dust[:, 1], s=rng.uniform(0.3, 3, 700), color=LBLUE, alpha=0.3, lw=0)

def draw_synapse(fig):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    W, H = fig.get_size_inches(); asp = W / H; X, Y = 1.0 * asp, 1.0
    ax.set_xlim(-X, X); ax.set_ylim(-Y, Y)
    pts = []
    while len(pts) < 13:
        p = rng.uniform([-X * 0.9, -Y * 0.85], [X * 0.9, Y * 0.85])
        if all(np.linalg.norm(p - q) > 0.42 for q in pts): pts.append(p)
    pts = np.array(pts); fire = int(np.argmin(np.linalg.norm(pts - np.array([0.25, 0.1]), axis=1)))
    E = []
    for i in range(len(pts)):
        for j in np.argsort(np.linalg.norm(pts - pts[i], axis=1))[1:4]:
            if (j, i) not in E: E.append((i, int(j)))
    for i, j in E:
        a, b = pts[i], pts[j]; m = (a + b) / 2 + rng.normal(0, 0.12, 2)
        t = np.linspace(0, 1, 60)[:, None]; curve = (1 - t) ** 2 * a + 2 * (1 - t) * t * m + t ** 2 * b
        hot = fire in (i, j)
        ax.plot(curve[:, 0], curve[:, 1], color=LBLUE if hot else EDGE, lw=1.6 if hot else 1.0, alpha=0.75 if hot else 0.45)
        if hot or rng.random() < 0.45:  # impulso con scia
            k = int(rng.uniform(15, 50)); tr = curve[max(0, k - 14):k + 1]
            segs = np.stack([tr[:-1], tr[1:]], 1); al = np.linspace(0.05, 0.95, len(segs))
            cc = np.array([_rgba(AMBER if hot else PALE, x_) for x_ in al])
            ax.add_collection(LineCollection(segs, colors=cc, linewidths=2.4))
            if _glow(): ax.scatter(*curve[k], s=600, color=AMBER if hot else PALE, alpha=0.12, lw=0)
            ax.scatter(*curve[k], s=38, color=AMBER if hot else PALE, lw=0, zorder=6)
    for k, p in enumerate(pts):
        if k == fire: continue
        _neuron(ax, p, size=0.55 + 0.25 * rng.random(), dendrites=6, depth=3, col=PALE if rng.random() < 0.6 else LBLUE, glow_alpha=0.05)
    _neuron(ax, pts[fire], size=0.95, dendrites=7, depth=4, col=PALE)
    _burst(ax, pts[fire], n=1400, scale=0.5)
    dust = rng.uniform([-X, -Y], [X, Y], (900, 2))
    ax.scatter(dust[:, 0], dust[:, 1], s=rng.uniform(0.3, 3, 900), color=LBLUE, alpha=0.28, lw=0)

def draw_eeg(fig, ev=(5.6, 7.1)):
    ax = main_ax(fig, (0.1, 0.1, 0.87, 0.86)); ax.grid(axis='y', lw=0)
    ch = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2']; fs = 128; t = np.arange(0, 10, 1 / fs)
    for k, name in enumerate(ch):
        pink = np.convolve(rng.normal(0, 1, t.size), np.ones(9) / 9, 'same')
        alpha = (0.6 + 0.4 * np.sin(2 * np.pi * 0.12 * t + k)) * np.sin(2 * np.pi * (9.5 + 0.3 * k % 2) * t + rng.uniform(0, 6))
        burst = np.where((t > ev[0]) & (t < ev[1]), 2.2 * np.sin(2 * np.pi * 21 * t) * np.sin(np.pi * (t - ev[0]) / (ev[1] - ev[0])) ** 2, 0)
        y = 0.28 * (alpha + 0.8 * pink + burst) - k
        m = (t > ev[0]) & (t < ev[1])
        ax.plot(t, np.where(m, np.nan, y), color=[LBLUE, PALE][k % 2], lw=0.8, alpha=0.9)
        ax.plot(t[m], y[m], color=AMBER, lw=1.0)
    ax.axvspan(*ev, color=AMBER, alpha=0.07)
    ax.set_yticks(-np.arange(len(ch))); ax.set_yticklabels(ch); ax.set_ylim(-len(ch) + 0.3, 0.8); ax.set_xlim(0, 10)
    lbl(ax, 'Tempo (s)', None)

def draw_raster(fig):
    ax = fig.add_axes([0.11, 0.42, 0.85, 0.53]); style(ax); ax.set_xticklabels([])
    trials = 34; spikes, rew = [], []
    for k in range(trials):
        base = rng.uniform(-1, 2, rng.poisson(16)); cue = rng.uniform(0.05, 0.3, rng.poisson(7)); r = rng.uniform(1.0, 1.25, rng.poisson(9))
        spikes.append(np.r_[base, cue]); rew.append(r)
    ax.eventplot(spikes, colors=LBLUE, lineoffsets=np.arange(trials), linelengths=0.75, linewidths=1.1)
    ax.eventplot(rew, colors=AMBER, lineoffsets=np.arange(trials), linelengths=0.75, linewidths=1.3)
    for x_, c in ((0, HERO), (1.0, AMBER)): ax.axvline(x_, color=c, ls='--', lw=1.2)
    ax.set_xlim(-1, 2); ax.set_ylim(-1, trials); lbl(ax, None, 'Prova')
    ax2 = fig.add_axes([0.11, 0.1, 0.85, 0.27]); style(ax2)
    allsp = np.concatenate(spikes + rew); counts, edges = np.histogram(allsp, bins=60, range=(-1, 2)); c_ = (edges[:-1] + edges[1:]) / 2
    ax2.bar(c_, counts, width=(edges[1] - edges[0]) * 0.85, color=[AMBER if 1.0 <= x_ <= 1.25 else BARS(0.6) for x_ in c_])
    ax2.set_xlim(-1, 2); lbl(ax2, 'Tempo dallo stimolo (s)', 'Spike/s')

def draw_spectrogram(fig):
    ax = fig.add_axes([0.1, 0.12, 0.76, 0.82]); style(ax)
    t = np.linspace(0, 60, 240); f = np.linspace(1, 40, 120); T, F = np.meshgrid(t, f)
    Z = 1.8 / F ** 0.7 + 0.9 * np.exp(-((F - 10) / 1.6) ** 2) * (0.6 + 0.4 * np.sin(T / 6)) \
        + 0.7 * np.exp(-((F - 21) / 3) ** 2) * np.exp(-((T - 38) / 6) ** 2) + rng.normal(0, 0.05, T.shape)
    im = ax.imshow(Z, origin='lower', extent=[0, 60, 1, 40], aspect='auto', cmap=SQ_COOL, alpha=0.95)
    for y_, n_ in ((2.5, 'δ'), (6, 'θ'), (10, 'α'), (20, 'β'), (34, 'γ')): ax.text(61.5, y_, n_, color=TXT2, fontsize=13, va='center')
    cb = fig.colorbar(im, cax=fig.add_axes([0.9, 0.12, 0.025, 0.82])); cb.outline.set_color(SPINE); cb.ax.tick_params(colors=TICK, labelsize=8)
    lbl(ax, 'Tempo (s)', 'Frequenza (Hz)')

def draw_bandpower(fig):
    ax = fig.add_axes([0.2, 0.08, 0.72, 0.86]); style(ax)
    bands = ['δ', 'θ', 'α', 'β', 'γ']; v = rng.uniform(0.3, 1, 5); v[2] = 1.15
    ax.bar(range(5), v, color=[AMBER if i == 2 else BARS(0.4 + 0.12 * i) for i in range(5)], width=0.7)
    ax.set_xticks(range(5)); ax.set_xticklabels(bands, fontsize=12); lbl(ax, None, 'Potenza relativa')

# ── grafici unici: un protagonista diverso per ogni copertina ─────────────────
from matplotlib.patches import Wedge, Patch

def _chaikin(pts, it=4):
    P = np.asarray(pts, float)
    for _ in range(it):
        Q = 0.75 * P[:-1] + 0.25 * P[1:]; R = 0.25 * P[:-1] + 0.75 * P[1:]
        P = np.vstack([P[:1], np.column_stack([Q, R]).reshape(-1, 2), P[-1:]])
    return P

def _frame_ax(fig, pad=1.0):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    W, H = fig.get_size_inches(); asp = W / H
    ax.set_xlim(-pad * asp, pad * asp); ax.set_ylim(-pad, pad); return ax, asp

def _dust(ax, xr, yr, n=700, alpha=0.28):
    d = rng.uniform([xr[0], yr[0]], [xr[1], yr[1]], (n, 2))
    ax.scatter(d[:, 0], d[:, 1], s=rng.uniform(0.3, 3, n), color=LBLUE, alpha=alpha, lw=0)

def _glow_line(ax, x, y, c, lw=2.0, glow=7):
    if _glow(): ax.plot(x, y, color=c, lw=glow, alpha=0.07, solid_capstyle='round')
    ax.plot(x, y, color=c, lw=lw, solid_capstyle='round')

# trading (live)
def draw_underwater(fig):
    ax = main_ax(fig); P = mc_paths(150, 260, 0.0008, 0.011); x = np.arange(P.shape[1])
    dd = (P / np.maximum.accumulate(P, axis=1) - 1) * 100; worst = dd.min(1)
    wn = (worst - worst.min()) / (np.ptp(worst) + 1e-9)
    for i in np.argsort(wn): ax.plot(x, dd[i], color=SQ_COOL(0.25 + 0.7 * wn[i]), lw=0.7, alpha=0.4)
    p5 = np.percentile(dd, 5, axis=0); ax.fill_between(x, p5, 0, color=BLUE, alpha=0.07, lw=0)
    ax.plot(x, np.median(dd, axis=0), color=HERO, lw=2.4); ax.plot(x, p5, color=RED, lw=1.5, ls='--')
    ax.text(8, worst.min() * 0.93, f'DD massimo al 95%: {np.percentile(worst, 5):.1f}%', color=AMBER, fontsize=12)
    ax.set_xlim(0, x[-1]); ax.set_ylim(worst.min() * 1.05, 1.5); lbl(ax, 'Trade', 'Drawdown (%)')

def draw_bar3d(fig):
    ax = fig.add_axes([-0.04, 0.0, 1.08, 1.0], projection='3d'); ax.set_facecolor('none')
    n = 8; xs, ys = np.meshgrid(np.arange(n), np.arange(n)); xs, ys = xs.ravel().astype(float), ys.ravel().astype(float)
    z = 0.35 + 1.15 * np.exp(-(((xs - 4.6) / 2.3) ** 2 + ((ys - 3.3) / 2.1) ** 2)) + rng.normal(0, 0.05, xs.size)
    zn = (z - z.min()) / np.ptp(z); cols = SQ_COOL(0.2 + 0.75 * zn); cols[np.argmax(z)] = matplotlib.colors.to_rgba(AMBER)
    ax.bar3d(xs, ys, np.zeros_like(z), 0.72, 0.72, z, color=cols, shade=True, edgecolor=SURF_EDGE, linewidth=0.3)
    ax.view_init(elev=27, azim=-57)
    for a in (ax.xaxis, ax.yaxis, ax.zaxis):
        a.set_pane_color((0, 0, 0, 0)); a._axinfo['grid']['color'] = GRID3D; a.line.set_color(LINE3D)
    ax.tick_params(colors=TXT, labelsize=9)
    ax.set_xlabel('Stop (pip)', color=TXT, labelpad=8); ax.set_ylabel('Target (R)', color=TXT, labelpad=8); ax.set_zlabel('Profit factor', color=TXT)

def draw_radar(fig):
    ax = fig.add_axes([0.14, 0.1, 0.72, 0.8], projection='polar'); ax.set_facecolor('none')
    lab = ['Sharpe', 'Profit factor', 'Win rate', 'Recovery', 'Expectancy', 'Stabilità', 'Drawdown']
    th = np.linspace(0, 2 * np.pi, len(lab), endpoint=False); th2 = np.r_[th, th[:1]]
    a = rng.uniform(0.6, 0.95, len(lab)); b = rng.uniform(0.3, 0.55, len(lab))
    for vals, c, ls, fa in ((b, SAND, '--', 0.08), (a, LBLUE, '-', 0.25)):
        v = np.r_[vals, vals[:1]]; ax.plot(th2, v, color=c, lw=2.2, ls=ls); ax.fill(th2, v, color=c, alpha=fa)
    ax.scatter(th, a, s=46, color=AMBER, zorder=5)
    ax.set_xticks(th); ax.set_xticklabels(lab, color=TXT2, fontsize=12); ax.set_yticklabels([]); ax.set_ylim(0, 1)
    ax.grid(color=GRID, lw=0.9); ax.spines['polar'].set_color(SPINE)

def draw_contour(fig):
    ax = main_ax(fig)
    f = lambda x, y: 1.0 * np.exp(-((x - 6.5) ** 2 + (y - 6) ** 2) / 6) + 0.6 * np.exp(-((x - 2.5) ** 2 + (y - 3) ** 2) / 3) \
        + 0.35 * np.exp(-((x - 7.5) ** 2 + (y - 2) ** 2) / 2) + 0.05 * np.sin(x) * np.cos(y * 1.3)
    X, Y = np.meshgrid(np.linspace(0, 10, 220), np.linspace(0, 10, 220)); Z = f(X, Y)
    ax.contourf(X, Y, Z, levels=16, cmap=SQ_COOL, alpha=0.92); ax.contour(X, Y, Z, levels=16, colors=[EDGE], linewidths=0.5, alpha=0.6)
    for s in rng.uniform(0.8, 9.2, (6, 2)):
        p = s.copy(); path = [p.copy()]
        for _ in range(70):
            e = 1e-3; g = np.array([f(p[0] + e, p[1]) - f(p[0] - e, p[1]), f(p[0], p[1] + e) - f(p[0], p[1] - e)]) / (2 * e)
            p = p + 0.35 * g / (np.linalg.norm(g) + 0.05); path.append(p.copy())
        path = np.array(path); ax.plot(path[:, 0], path[:, 1], color=PALE, lw=1.4, marker='o', ms=2.2)
        ax.scatter(*path[-1], marker='*', s=260, color=AMBER, edgecolor='#ffe39a', lw=1, zorder=6)
    ax.set_xlim(0, 10); ax.set_ylim(0, 10); lbl(ax, 'Param A', 'Param B')

def draw_rings(fig):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off'); ax.set_aspect('equal'); ax.set_xlim(-2.3, 1.3); ax.set_ylim(-1.35, 1.35)
    items = [('Lezioni completate', 0.78, BLUE), ('Live seguite', 0.56, LBLUE), ('Diario compilato', 0.91, AMBER), ('Community', 0.64, PALE)]
    for i, (name, p, c) in enumerate(items):
        r = 1.1 - i * 0.25
        ax.add_patch(Wedge((0, 0), r, 0, 360, width=0.18, color=_rgba(c, 0.13)))
        ax.add_patch(Wedge((0, 0), r, 90 - 360 * p, 90, width=0.18, color=c))
        ax.text(-1.35, 0.78 - i * 0.5, name, color=TXT2, fontsize=13, ha='right')
        ax.text(-1.35, 0.6 - i * 0.5, f'{int(p * 100)}%', color=c, fontsize=22, ha='right', weight='bold')
    ax.text(0, 0.04, 'IST', color=HERO, fontsize=30, ha='center', va='center', weight='bold')
    ax.text(0, -0.2, 'app', color=TXT, fontsize=12, ha='center', va='center')

def draw_waterfall(fig):
    ax = main_ax(fig, (0.11, 0.16, 0.85, 0.79))
    steps = [('Profitto\nlordo', 4200), ('Commissioni', -380), ('Challenge', -540), ('Profit\nsplit', -820), ('Swap', -120), ('Slippage', -160)]
    cum = 0
    for i, (n, v) in enumerate(steps):
        ax.bar(i, abs(v), bottom=cum if v > 0 else cum + v, color=GREEN if v > 0 else RED, width=0.62, alpha=0.9)
        ax.text(i, max(cum, cum + v) + 70, f'{v:+,}'.replace(',', '.'), ha='center', color=TXT2, fontsize=10)
        ax.plot([i + 0.31, i + 0.69], [cum + v] * 2, color=SPINE, ls='--', lw=1); cum += v
    ax.bar(len(steps), cum, color=LBLUE, width=0.62); ax.text(len(steps), cum + 70, f'{cum:,}'.replace(',', '.'), ha='center', color=AMBER, fontsize=11, weight='bold')
    ax.set_xticks(range(len(steps) + 1)); ax.set_xticklabels([s[0] for s in steps] + ['Netto'], fontsize=10)
    ax.set_ylim(0, 4800); lbl(ax, None, 'Euro')

def draw_violin(fig):
    ax = main_ax(fig); yrs = ['2020', '2021', '2022', '2023', '2024', '2025']
    data = [rng.normal(rng.uniform(0.5, 1.6), rng.uniform(2.5, 4.2), 70) for _ in yrs]
    parts = ax.violinplot(data, showmeans=False, showmedians=False, showextrema=False)
    for b in parts['bodies']: b.set_facecolor(BLUE); b.set_edgecolor(LBLUE); b.set_alpha(0.55)
    for i, d in enumerate(data):
        q1, q3 = np.percentile(d, [25, 75]); ax.vlines(i + 1, q1, q3, color=HERO, lw=3.5); ax.scatter(i + 1, np.median(d), color=AMBER, s=30, zorder=4)
    ax.axhline(10, color=AMBER, ls='--', lw=1.6); ax.text(0.6, 10.6, 'aspettativa: +10% al mese', color=AMBER, fontsize=12)
    ax.axhline(0, color=ZERO, lw=1); ax.set_xticks(range(1, 7)); ax.set_xticklabels(yrs); ax.set_ylim(-12, 13.5)
    lbl(ax, 'Anno', 'Rendimento mensile (%)')

def draw_rmultiple(fig):
    ax = main_ax(fig, (0.09, 0.12, 0.8, 0.83)); n = 110
    r = np.where(rng.random(n) < 0.42, rng.uniform(1.2, 3.2, n), -1.0 + rng.normal(0, 0.05, n))
    ax.bar(np.arange(n), r, color=[GREEN if v > 0 else RED for v in r], width=0.75, alpha=0.85); ax.axhline(0, color=ZERO, lw=1)
    ax.text(2, 3.45, f'Expectancy = {r.mean():+.2f}R', color=AMBER, fontsize=13); ax.set_ylim(-1.6, 3.9); ax.set_xlim(-1, n)
    ax2 = ax.twinx(); style(ax2); ax2.grid(False); ax2.plot(np.arange(n), np.cumsum(r), color=HERO, lw=2.2); ax2.set_ylabel('R cumulati', color=TXT)
    lbl(ax, 'Trade', 'R per trade')

def draw_hexbin(fig):
    ax = fig.add_axes([0.1, 0.12, 0.76, 0.82]); style(ax); n = 70000
    t = rng.uniform(0, 24, n); vol = 0.4 + 1.2 * np.exp(-((t - 9) / 1.5) ** 2) + 1.4 * np.exp(-((t - 15) / 1.7) ** 2)
    y = rng.normal(0, 1, n) * vol * 6
    hb = ax.hexbin(t, y, gridsize=44, cmap=SQ_COOL, mincnt=1, bins='log', linewidths=0)
    cb = fig.colorbar(hb, cax=fig.add_axes([0.89, 0.12, 0.025, 0.82])); cb.outline.set_color(SPINE); cb.ax.tick_params(colors=TICK, labelsize=8)
    ax.set_xlim(0, 24); ax.set_ylim(-26, 26); ax.set_xticks(range(0, 25, 3)); lbl(ax, 'Ora del giorno', 'Variazione (pip)')

def draw_boxplot(fig):
    ax = main_ax(fig); per = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
    for i in range(len(per)):
        d = rng.normal(rng.uniform(-1, 2), rng.uniform(5, 8), 80); m = rng.normal(rng.uniform(0.8, 1.4), rng.uniform(1.5, 2.2), 80)
        for data, off, c in ((d, -0.18, AMBER), (m, 0.18, LBLUE)):
            b = ax.boxplot(data, positions=[i + off], widths=0.3, patch_artist=True,
                           flierprops=dict(marker='o', markersize=2.5, markerfacecolor=c, markeredgecolor='none', alpha=0.5))
            for p in b['boxes']: p.set_facecolor(_rgba(c, 0.35)); p.set_edgecolor(c)
            for k in ('whiskers', 'caps'):
                for l in b[k]: l.set_color(c)
            for l in b['medians']: l.set_color(HERO); l.set_linewidth(2)
    ax.set_xticks(range(len(per))); ax.set_xticklabels(per); ax.axhline(0, color=ZERO, lw=1)
    ax.legend(handles=[Patch(facecolor=_rgba(AMBER, .35), edgecolor=AMBER, label='Discrezionale'), Patch(facecolor=_rgba(LBLUE, .35), edgecolor=LBLUE, label='Meccanico')],
              loc='upper left', frameon=False, labelcolor=TXT)
    lbl(ax, 'Trimestre', 'Rendimento mensile (%)')

def draw_calendar(fig):
    ax = fig.add_axes([0.03, 0.04, 0.94, 0.92]); ax.axis('off'); ax.set_aspect('equal')
    months = ['Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre']
    for k, mname in enumerate(months):
        ox, oy = (k % 3) * 6.6, (1 - k // 3) * 7.4
        ax.text(ox, oy + 5.9, mname, color=TXT2, fontsize=12)
        for j, dname in enumerate('LMMGV'): ax.text(ox + j * 1.1 + 0.45, oy + 5.1, dname, color=TICK, fontsize=9, ha='center')
        for w in range(5):
            for d in range(5):
                if rng.random() < 0.1: c = _rgba(NEUTRAL, 0.35)
                else:
                    v = rng.normal(0.25, 1.0); c = _rgba(GREEN if v > 0 else RED, 0.25 + 0.75 * min(1, abs(v) / 1.8))
                ax.add_patch(plt.Rectangle((ox + d * 1.1, oy + (4 - w) * 1.0), 0.92, 0.84, color=c))
    ax.text(0, -1.0, 'Giorni positivi 61%  ·  Miglior giorno +2.4R  ·  Peggiore −1.0R', color=TXT, fontsize=11)
    ax.set_xlim(-0.4, 19.6); ax.set_ylim(-1.6, 14.2)

def draw_ranges(fig):
    ax = main_ax(fig); n = 60; p = 100 + np.cumsum(rng.normal(0.03, 0.5, n))
    hi = p + np.abs(rng.normal(0.5, 0.25, n)); lo = p - np.abs(rng.normal(0.5, 0.25, n)); op = p + rng.normal(0, 0.25, n)
    for m in range(0, n, 20):
        s = slice(m, m + 20); ax.add_patch(plt.Rectangle((m - 0.5, lo[s].min() - 0.15), 19.6, hi[s].max() - lo[s].min() + 0.3, fill=False, ec=AMBER, ls='--', lw=1.4))
        ax.text(m + 0.2, hi[s].max() + 0.35, 'HTR', color=AMBER, fontsize=11)
    for w in range(0, n, 5):
        s = slice(w, w + 5); ax.add_patch(plt.Rectangle((w - 0.4, lo[s].min()), 4.8, hi[s].max() - lo[s].min(), color=BLUE, alpha=0.11, lw=0))
    for i in range(n):
        c = GREEN if p[i] >= op[i] else RED
        ax.vlines(i, lo[i], hi[i], color=c, lw=1.3); ax.hlines(op[i], i - 0.32, i, color=c, lw=1.3); ax.hlines(p[i], i, i + 0.32, color=c, lw=1.3)
    ax.set_xlim(-1, n); lbl(ax, 'Giorni', 'Prezzo')

def draw_polyfit(fig):
    import warnings
    ax = main_ax(fig); x = np.sort(rng.uniform(0, 1, 26)); y = np.sin(2.4 * np.pi * x) * 0.8 + rng.normal(0, 0.28, x.size)
    xs = np.linspace(0, 1, 500)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore'); c15 = np.polyfit(x, y, 15)
    c3 = np.polyfit(x, y, 3)
    ax.plot(xs, np.polyval(c15, xs), color=RED, lw=2, label='Sovra-ottimizzato (15 parametri)')
    ax.plot(xs, np.polyval(c3, xs), color=LBLUE, lw=2.8, label='Semplice (3 parametri)')
    ax.scatter(x, y, s=50, color=HERO, zorder=5)
    ax.set_ylim(-2.2, 2.4); ax.set_xlim(-0.02, 1.02); ax.legend(loc='upper right', frameon=False, labelcolor=TXT)
    lbl(ax, 'Variabile', 'Risultato')

def draw_weekhour(fig):
    ax = fig.add_axes([0.11, 0.12, 0.76, 0.66]); style(ax)
    h = np.arange(24); base = 0.25 + 0.9 * np.exp(-((h - 8.5) / 1.4) ** 2) + 1.1 * np.exp(-((h - 14.5) / 1.6) ** 2) + 0.3 * np.exp(-((h - 1) / 1.6) ** 2)
    M = np.array([base * rng.uniform(0.8, 1.2) + rng.normal(0, 0.05, 24) for _ in range(5)])
    heat = LinearSegmentedColormap.from_list('heat_' + THEME, ['#120d05', '#5a3a06', '#F5B000', '#fff1c2'] if THEME == 'dark' else ['#fbf3df', '#f7d27a', '#e09a00', '#6b4300'])
    im = ax.imshow(M, cmap=heat, aspect='auto', extent=[0, 24, 4.5, -0.5])
    ax.set_yticks(range(5)); ax.set_yticklabels(['Lun', 'Mar', 'Mer', 'Gio', 'Ven']); ax.set_xticks(range(0, 25, 3)); ax.grid(False)
    cb = fig.colorbar(im, cax=fig.add_axes([0.89, 0.12, 0.025, 0.66])); cb.outline.set_color(SPINE); cb.ax.tick_params(colors=TICK, labelsize=8)
    ax2 = fig.add_axes([0.11, 0.8, 0.76, 0.16]); ax2.axis('off'); ax2.set_xlim(0, 24); ax2.set_ylim(0, 1)
    for k, (a, b, name, c) in enumerate(((0, 9, 'Asia', SAND), (7, 16, 'Londra', LBLUE), (13, 22, 'New York', BLUE))):
        y = 0.2 + k * 0.3; ax2.plot([a, b], [y, y], color=c, lw=4, solid_capstyle='round'); ax2.text(a, y + 0.08, name, color=TXT2, fontsize=11)
    lbl(ax, 'Ora (UTC)', None)

def draw_sensitivity(fig):
    ax = main_ax(fig); x = np.arange(5, 61, 5)
    for name, c, peak, h in (('Asia', SAND, 20, 1.15), ('Londra', LBLUE, 30, 1.55), ('New York', BLUE, 40, 1.35)):
        y = 0.9 + (h - 0.9) * np.exp(-((x - peak) / 16) ** 2) + rng.normal(0, 0.03, x.size)
        ax.plot(x, y, color=c, lw=2.4, marker='o', ms=6, label=name)
    ax.axvspan(22, 38, color=AMBER, alpha=0.08); ax.axvline(30, color=AMBER, ls='--', lw=1.4)
    ax.legend(loc='upper right', frameon=False, labelcolor=TXT); lbl(ax, 'Durata del range (minuti)', 'Profit factor')

def draw_hour_dual(fig):
    ax = main_ax(fig, (0.09, 0.12, 0.8, 0.83)); h = np.arange(24)
    n = 20 + 140 * np.exp(-((h - 9) / 1.6) ** 2) + 160 * np.exp(-((h - 15) / 1.8) ** 2) + rng.uniform(0, 15, 24)
    ax.bar(h, n, color=[BARS(0.3 + 0.7 * v / n.max()) for v in n], width=0.75)
    ax2 = ax.twinx(); style(ax2); ax2.grid(False)
    wr = 45 + 12 * np.exp(-((h - 9.5) / 2) ** 2) + 8 * np.exp(-((h - 15) / 2) ** 2) + rng.normal(0, 1.5, 24)
    ax2.plot(h, wr, color=AMBER, lw=2.4, marker='o', ms=5); ax2.set_ylabel('Win rate (%)', color=TXT); ax2.set_ylim(30, 72)
    ax.set_xlim(-0.6, 23.6); lbl(ax, 'Ora di ingresso (UTC)', 'Numero di trade')

def draw_volprofile(fig):
    ax = main_ax(fig, (0.08, 0.1, 0.66, 0.85)); n = 70; p = 100 + np.cumsum(rng.normal(0, 0.35, n))
    for i in range(n):
        o, c = (p[i - 1] if i else p[0]), p[i]; hh, ll = max(o, c) + abs(rng.normal(0, .15)), min(o, c) - abs(rng.normal(0, .15))
        col = GREEN if c >= o else RED; ax.plot([i, i], [ll, hh], color=col, lw=0.9); ax.add_patch(plt.Rectangle((i - .32, min(o, c)), .64, abs(c - o) + .02, color=col))
    ax.plot(np.cumsum(p) / np.arange(1, n + 1), color=PALE, lw=1.6); ax.text(n - 9, (np.cumsum(p) / np.arange(1, n + 1))[-1] + 0.25, 'VWAP', color=PALE, fontsize=10)
    edges = np.linspace(p.min() - 1, p.max() + 1, 38); counts, _ = np.histogram(np.r_[p, rng.normal(np.median(p), 1.0, 500)], bins=edges)
    cen = (edges[:-1] + edges[1:]) / 2; poc = int(np.argmax(counts))
    order = np.argsort(-counts); keep = order[np.cumsum(counts[order]) <= 0.7 * counts.sum()]
    ax.axhspan(cen[keep].min(), cen[keep].max(), color=BLUE, alpha=0.07); ax.axhline(cen[poc], color=AMBER, ls=':', lw=1.3)
    ax.set_xlim(-1, n); lbl(ax, 'Barre (M15)', 'Prezzo')
    ax2 = fig.add_axes([0.76, 0.1, 0.21, 0.85]); style(ax2, ticks=False); ax2.grid(False)
    ax2.barh(cen, counts, height=(edges[1] - edges[0]) * 0.85, color=[AMBER if i == poc else BARS(0.55) for i in range(len(cen))])
    ax2.set_ylim(ax.get_ylim()); ax2.set_xlabel('Volume', color=TXT)

# trading (lezioni che ripetevano il grafico di una locandina)
def draw_parallel(fig):
    ax = main_ax(fig, (0.05, 0.1, 0.9, 0.82)); names = ['Periodo', 'Soglia', 'Stop', 'Target', 'Profit factor', 'Drawdown']; k = len(names); n = 220
    V = rng.uniform(0, 1, (n, k)); pf = 0.6 * (1 - np.abs(V[:, 0] - 0.6)) + 0.4 * (1 - np.abs(V[:, 2] - 0.3)) + rng.normal(0, 0.05, n)
    V[:, 4] = (pf - pf.min()) / np.ptp(pf); V[:, 5] = np.clip(1 - V[:, 4] * 0.7 + rng.normal(0, 0.08, n), 0, 1)
    order = np.argsort(V[:, 4])
    for i in order: ax.plot(range(k), V[i], color=SQ_COOL(0.2 + 0.6 * V[i, 4]), lw=0.8, alpha=0.35)
    for i in order[-12:]: ax.plot(range(k), V[i], color=AMBER, lw=1.9, alpha=0.9)
    for j in range(k): ax.axvline(j, color=SPINE, lw=1.3)
    ax.set_xticks(range(k)); ax.set_xticklabels(names, fontsize=11, color=TXT2); ax.set_yticks([]); ax.grid(False); ax.set_xlim(-0.15, k - 0.85)
    for s in ('left', 'right', 'top'): ax.spines[s].set_visible(False)

def draw_forest(fig):
    ax = main_ax(fig, (0.22, 0.1, 0.74, 0.86)); k = 11
    eff = rng.normal(2.2, 1.6, k); se = rng.uniform(0.6, 1.8, k); y = np.arange(k)[::-1] + 2.0
    for e, s, yy in zip(eff, se, y):
        ax.hlines(yy, e - 1.96 * s, e + 1.96 * s, color=LBLUE, lw=1.7); ax.scatter(e, yy, s=40 + 70 / s, marker='s', color=PALE, zorder=4)
    w = 1 / se ** 2; pooled = np.average(eff, weights=w); pse = np.sqrt(1 / w.sum())
    ax.fill([pooled - 1.96 * pse, pooled, pooled + 1.96 * pse, pooled], [0.8, 1.25, 0.8, 0.35], color=AMBER)
    ax.axvline(0, color=ZERO, lw=1.2); ax.axvline(pooled, color=AMBER, ls='--', lw=1)
    ax.set_yticks(list(y) + [0.8]); ax.set_yticklabels([f'Studio {2008 + i}' for i in range(k)] + ['Stima combinata'])
    ax.set_ylim(0, k + 2.6); lbl(ax, 'Effetto stimato (rendimento annuo, %)', None)

def draw_ecdf(fig):
    ax = main_ax(fig)
    for _ in range(70):
        d = np.sort(rng.normal(0, 1, 300)); ax.plot(d, np.linspace(0, 1, d.size), color=NEUTRAL, lw=0.8, alpha=0.45)
    s = np.sort(rng.normal(0.55, 1, 300)); ax.plot(s, np.linspace(0, 1, s.size), color=LBLUE, lw=2.8, label='La tua strategia')
    ax.plot([], [], color=NEUTRAL, lw=2, label='Strategie casuali')
    x0 = 0.25; ys = np.mean(s <= x0); yr = np.mean(rng.normal(0, 1, 4000) <= x0)
    ax.annotate('', xy=(x0, ys), xytext=(x0, yr), arrowprops=dict(arrowstyle='<->', color=AMBER, lw=2))
    ax.text(x0 + 0.12, (ys + yr) / 2, f'KS = {yr - ys:.2f}', color=AMBER, fontsize=13)
    ax.legend(loc='upper left', frameon=False, labelcolor=TXT); ax.set_xlim(-3.2, 3.6); lbl(ax, 'Rendimento per trade (R)', 'Probabilità cumulata')

def draw_tree(fig):
    ax = fig.add_axes([0.02, 0.03, 0.96, 0.94]); ax.axis('off'); ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    N = {'r': (0.5, 0.9, 'Trend D1 sopra la media 50', None), 'a': (0.27, 0.64, 'Sessione di Londra', None), 'b': (0.73, 0.64, 'Volatilità sopra la mediana', None),
         'aa': (0.13, 0.37, 'Rottura del range', None), 'ab': (0.4, 0.37, 'PF 0.94\n418 trade', 0.94), 'ba': (0.6, 0.37, 'PF 1.08\n276 trade', 1.08),
         'bb': (0.86, 0.37, 'Pullback al 38%', None), 'aaa': (0.06, 0.1, 'PF 1.46\n312 trade', 1.46), 'aab': (0.21, 0.1, 'PF 0.88\n190 trade', 0.88),
         'bba': (0.79, 0.1, 'PF 1.31\n201 trade', 1.31), 'bbb': (0.94, 0.1, 'PF 0.97\n144 trade', 0.97)}
    for k_, (x, y, _, _) in N.items():
        if len(k_) > 1 or k_ != 'r':
            par = 'r' if len(k_) == 1 else k_[:-1]; px, py = N[par][0], N[par][1]
            ax.plot([px, x], [py - 0.045, y + 0.045], color=EDGE, lw=1.4)
            ax.text((px + x) / 2 + (0.012 if x > px else -0.012), (py + y) / 2, 'sì' if k_[-1] == 'a' else 'no', color=TICK, fontsize=14, ha='left' if x > px else 'right')
    for k_, (x, y, t, pf) in N.items():
        if pf is None: fc, ec, lw = _rgba(BLUE, 0.2), LBLUE, 1.3
        else:
            c = GREEN if pf > 1.2 else (RED if pf < 1 else SAND); fc, ec, lw = _rgba(c, 0.22), c, 1.3
            if pf == 1.46: ec, lw = AMBER, 2.6
        ax.text(x, y, t.replace(' sopra', '\nsopra').replace('Sessione di', 'Sessione\ndi').replace('Rottura del', 'Rottura\ndel').replace('Pullback al', 'Pullback\nal'), ha='center', va='center', color=TXT2, fontsize=15,
                bbox=dict(boxstyle='round,pad=0.55', fc=fc, ec=ec, lw=lw))

def draw_odds(fig):
    ax = main_ax(fig, (0.33, 0.12, 0.62, 0.83))
    items = [('+2% al mese', 41), ('+5% al mese', 12), ('+10% al mese', 2.1), ('+20% al mese', 0.35), ('raddoppiare in 6 mesi', 0.08), ('raddoppiare in 1 mese', 0.004)]
    y = np.arange(len(items))[::-1]; v = np.array([i[1] for i in items])
    ax.barh(y, v, color=[BARS(0.85), BARS(0.6), SAND, RED, RED, RED], height=0.6); ax.set_xscale('log'); ax.set_xlim(0.002, 160)
    for yy, vv in zip(y, v): ax.text(vv * 1.3, yy, f'{vv:g}%'.replace('.', ','), va='center', color=TXT2, fontsize=12)
    ax.set_yticks(y); ax.set_yticklabels([i[0] for i in items], fontsize=12); lbl(ax, 'Probabilità (scala logaritmica, %)', None)

# mente (live e lezioni del Mental Coach)
def draw_brain_top(fig):
    draw_brain(fig, az=-90, el=86, active=((0.7, 0.25, 0.4), (0.7, -0.25, 0.4)))

def draw_brain_lines(fig, az=-32, el=20):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    P, N, kind, g, sulc = _brain_shell(density=1.0)
    u, v, z = _view(P, az, el)
    cell = (u.max() - u.min()) / 300
    iu = ((u - u.min()) / cell).astype(int); iv = ((v - v.min()) / cell).astype(int)
    zb = np.full((iu.max() + 1, iv.max() + 1), -9.0); np.maximum.at(zb, (iu, iv), z)
    vis = z >= zb[iu, iv] - 0.03
    zl = np.linspace(-1.0, 0.72, 30); xl = np.linspace(-1.0, 1.0, 26)
    onz = np.min(np.abs(P[:, 2:3] - zl[None, :]), axis=1) < 0.0045
    onx = np.min(np.abs(P[:, 0:1] - xl[None, :]), axis=1) < 0.0035
    m = vis & (onz | onx)
    hgt = (P[m, 2] + 1.0) / 1.75
    act = np.exp(-((P[m] - np.array([0.72, -0.3, 0.25])) ** 2).sum(1) / 0.05)
    col = SQ_COOL(0.3 + 0.65 * hgt); hot = _mix(AMBER, '#fff3d0' if _glow() else '#c25a00', np.clip(act, 0, 1))
    col = col * (1 - act[:, None]) + hot * act[:, None]
    if _glow(): ax.scatter(u[m], v[m], s=7, c=col * [1, 1, 1, 0.05], lw=0)
    ax.scatter(u[m], v[m], s=0.9 + 2 * act, c=col, lw=0)
    _dust(ax, (u.min() - 0.3, u.max() + 0.3), (v.min() - 0.3, v.max() + 0.3), 600)
    _set_frame(ax, fig, u, v, pad=0.06)

def draw_fmri(fig):
    K = 16; D = rng.normal(0, 1, (K, 3)); D /= np.linalg.norm(D, axis=1, keepdims=True); f = rng.uniform(15, 22, K); ph = rng.uniform(0, 2 * np.pi, K)
    blobs = [((0.28, 0.42, 0.3), 0.2), ((-0.32, 0.12, 0.05), 0.16), ((0.08, -0.45, -0.25), 0.15)]
    n = 170; yy, xx = np.mgrid[-1:1:n * 1j, -1:1:n * 1j]
    for i, zk in enumerate(np.linspace(-0.55, 0.55, 9)):
        ax = fig.add_axes([0.03 + (i % 3) * 0.32, 0.68 - (i // 3) * 0.32, 0.3, 0.3]); ax.axis('off')
        s = np.sqrt(max(0.08, 1 - (zk / 0.8) ** 2)); r = (xx / (0.72 * s)) ** 2 + (yy / (0.9 * s)) ** 2; mask = r < 1
        g = sum(np.sin((xx * D[k, 0] + yy * D[k, 1] + zk * D[k, 2]) * f[k] + ph[k]) for k in range(K)) / np.sqrt(K / 2)
        inten = np.where(r > 0.86, 0.85, 0.22 + 0.5 * np.clip(np.abs(g) / 1.4, 0, 1)); inten[np.abs(xx) < 0.012] *= 0.4
        rgba = SQ_COOL(0.08 + 0.8 * inten)
        act = sum(np.exp(-((xx - b[0]) ** 2 + (yy - b[1]) ** 2 + (zk - b[2]) ** 2) / rad ** 2) for b, rad in blobs) * mask
        a = np.clip(act * 1.7 - 0.3, 0, 1)
        hot = _mix(AMBER, '#fff3d0' if _glow() else '#b34700', np.clip(act * 1.4 - 0.5, 0, 1))
        rgba = rgba * (1 - a[..., None]) + hot * a[..., None]; rgba[..., 3] = mask.astype(float)
        ax.imshow(rgba, origin='lower', extent=[-1, 1, -1, 1]); ax.set_xlim(-1, 1); ax.set_ylim(-1, 1)
        ax.text(-0.98, -0.98, f'z = {int(zk * 60):+d} mm', color=TICK, fontsize=9)

def draw_chord(fig):
    ax, asp = _frame_ax(fig, 1.42); ax.set_aspect('equal')
    names = ['PFC', 'OFC', 'ACC', 'INS', 'AMY', 'HIP', 'THA', 'STR', 'NAc', 'VTA', 'SN', 'HYP', 'CER', 'V1', 'PCC', 'TPJ', 'M1', 'S1']
    n = len(names); seg = 2 * np.pi / n; key = {'PFC', 'NAc', 'VTA', 'STR'}
    ang = np.array([np.pi / 2 - (i + 0.5) * seg for i in range(n)])
    for i, nm in enumerate(names):
        a0, a1 = np.degrees(ang[i] - seg / 2 + 0.03), np.degrees(ang[i] + seg / 2 - 0.03)
        ax.add_patch(Wedge((0, 0), 1.08, a0, a1, width=0.08, color=AMBER if nm in key else SQ_COOL(0.35 + 0.6 * i / n)))
        x, y = 1.2 * np.cos(ang[i]), 1.2 * np.sin(ang[i]); rot = np.degrees(ang[i])
        if x < 0: rot += 180
        ax.text(x, y, nm, color=AMBER if nm in key else TXT2, fontsize=16, ha='left' if x >= 0 else 'right', va='center', rotation=rot, rotation_mode='anchor')
    pairs = [(rng.integers(n), rng.integers(n)) for _ in range(46)]
    path = [('VTA', 'NAc'), ('VTA', 'PFC'), ('NAc', 'PFC'), ('STR', 'PFC'), ('VTA', 'STR'), ('AMY', 'PFC')]
    t = np.linspace(0, 1, 60)[:, None]
    def curve(i, j):
        p0 = np.array([np.cos(ang[i]), np.sin(ang[i])]) * 1.03; p1 = np.array([np.cos(ang[j]), np.sin(ang[j])]) * 1.03
        return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * (p0 + p1) * 0.12 + t ** 2 * p1
    for i, j in pairs:
        if i != j: c = curve(i, j); ax.plot(c[:, 0], c[:, 1], color=LBLUE, lw=rng.uniform(0.6, 1.8), alpha=0.32)
    for a_, b_ in path:
        c = curve(names.index(a_), names.index(b_)); _glow_line(ax, c[:, 0], c[:, 1], AMBER, lw=2.4, glow=8)

def draw_tracto(fig):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    P, N, kind, g, sulc = _brain_shell(density=0.14); u, v, z = _view(P, 0, 4)
    ax.scatter(u, v, s=0.6, color=LBLUE, alpha=0.05 if _glow() else 0.07, lw=0)
    bundles = [
        ([(0.62, 0.12), (0.3, 0.3), (0, 0.34), (-0.35, 0.3), (-0.62, 0.1)], 170, 0.035),
        ([(0.72, 0.2), (0.35, 0.46), (0, 0.52), (-0.42, 0.44), (-0.76, 0.16)], 90, 0.03),
        ([(0.5, 0.06), (0.1, 0.22), (-0.35, 0.14), (-0.47, -0.1), (-0.2, -0.32), (0.16, -0.4)], 120, 0.03),
        ([(0.82, -0.05), (0.4, -0.12), (0, -0.15), (-0.5, -0.05), (-0.86, 0.02)], 110, 0.03),
        ([(0.72, -0.08), (0.46, -0.2), (0.36, -0.36), (0.47, -0.47)], 60, 0.025),
    ]
    segs, cols = [], []
    def add(ctrl, sd, amber_p=0.05):
        L = _chaikin(np.array(ctrl) + rng.normal(0, sd, 2), 4); L = L + rng.normal(0, 0.004, L.shape)
        d = np.diff(L, axis=0); hz = np.abs(d[:, 0]) / (np.linalg.norm(d, axis=1) + 1e-9)
        cc = _mix(BLUE, LBLUE, hz) if rng.random() > amber_p else np.tile(matplotlib.colors.to_rgba(AMBER), (len(d), 1))
        cc[:, 3] = 0.55; segs.extend(np.stack([L[:-1], L[1:]], 1)); cols.extend(cc)
    for ctrl, k, sd in bundles:
        for _ in range(k): add(ctrl, sd)
    for _ in range(160):  # fascio corticospinale: dalla corteccia al tronco
        s = (rng.uniform(-0.3, 0.4), 0.0); s = (s[0], 0.5 + 0.18 * np.sqrt(max(0, 1 - (s[0] / 0.75) ** 2)))
        add([s, ((s[0] - 0.25) / 2, 0.0), (-0.28, -0.45), (-0.34, -0.9)], 0.01, 0.03)
    if _glow(): ax.add_collection(LineCollection(segs, colors=[(c[0], c[1], c[2], 0.04) for c in cols], linewidths=3))
    ax.add_collection(LineCollection(segs, colors=cols, linewidths=0.8))
    _set_frame(ax, fig, u, v, pad=0.06)

def draw_cleft(fig):
    ax, asp = _frame_ax(fig, 1.0); ax.set_aspect('equal')
    th = np.linspace(0, 2 * np.pi, 400); bx, by = 0.95 * np.cos(th), 0.5 + 0.48 * np.sin(th)
    neck = np.abs(bx) < 0.28; top = by > 0.85
    ax.fill(bx, by, color=_rgba(BLUE, 0.12)); ax.fill_between([-0.28, 0.28], 0.9, 1.1, color=_rgba(BLUE, 0.12), lw=0)
    for x_ in (-0.28, 0.28): _glow_line(ax, [x_, x_], [0.88, 1.1], PALE, lw=2)
    m = ~(neck & top); _glow_line(ax, np.where(m, bx, np.nan), np.where(m, by, np.nan), PALE, lw=2)
    ves = []
    while len(ves) < 24:
        p = rng.uniform([-0.8, 0.2], [0.8, 0.85])
        if (p[0] / 0.85) ** 2 + ((p[1] - 0.5) / 0.4) ** 2 < 1 and all(np.hypot(*(p - q)) > 0.13 for q in ves): ves.append(p)
    for p in ves:
        ax.add_patch(plt.Circle(p, 0.055, fill=False, color=LBLUE, lw=1.3))
        d = p + rng.normal(0, 0.018, (6, 2)); ax.scatter(d[:, 0], d[:, 1], s=6, color=AMBER, lw=0)
    fus = np.linspace(-0.55, 0.55, 4)
    for fx in fus:
        a = np.linspace(np.pi * 1.15, np.pi * 1.85, 30); ax.plot(fx + 0.06 * np.cos(a), 0.06 + 0.06 * np.sin(a) + 0.02, color=LBLUE, lw=1.3)
    k = 900; src = rng.choice(fus, k) + rng.normal(0, 0.05, k); depth = rng.uniform(0, 1, k) ** 0.8
    px = src + rng.normal(0, 0.12, k) * depth; py = 0.02 - 0.42 * depth
    col = _mix(AMBER, PALE, depth); col[:, 3] = 0.85 - 0.4 * depth
    ax.add_collection(LineCollection(np.stack([np.c_[px, py + 0.03], np.c_[px, py]], 1), colors=col, linewidths=1.0))
    if _glow(): ax.scatter(px, py, s=14, c=col * [1, 1, 1, 0.12], lw=0)
    ax.scatter(px, py, s=3, c=col, lw=0)
    xm = np.linspace(-asp, asp, 300); ym = -0.48 + 0.025 * np.sin(4 * xm)
    ax.fill_between(xm, ym, -1.0, color=_rgba(BLUE, 0.08), lw=0); _glow_line(ax, xm, ym, PALE, lw=2)
    for rx in np.linspace(-0.9, 0.9, 13):
        ry = -0.48 + 0.025 * np.sin(4 * rx); lit = np.min(np.abs(fus - rx)) < 0.12
        ax.add_patch(plt.Rectangle((rx - 0.022, ry - 0.01), 0.044, 0.07, color=AMBER if lit else LBLUE))
        if lit and _glow(): ax.scatter([rx], [ry + 0.03], s=500, color=AMBER, alpha=0.12, lw=0)
    _dust(ax, (-asp, asp), (-1, 1), 400)

def draw_action_potential(fig):
    ax = main_ax(fig); t = np.linspace(0, 30, 3000); v = np.full_like(t, -70.0)
    for t0 in (4.0, 13.5, 22.5):
        dt = t - t0; v += 15 * np.exp(-((dt + 0.5) / 0.6) ** 2) + 110 * np.exp(-((dt - 0.4) / 0.32) ** 2) - 14 * np.exp(-((dt - 2.0) / 0.9) ** 2)
    v += rng.normal(0, 0.35, t.size)
    ax.fill_between(t, -70, v, where=v > -70, color=BLUE, alpha=0.16, lw=0); ax.plot(t, v, color=LBLUE, lw=2.2)
    ax.axhline(-55, color=AMBER, ls='--', lw=1.3); ax.text(0.4, -52.5, 'Soglia', color=AMBER, fontsize=11); ax.axhline(-70, color=ZERO, lw=1)
    t0 = 13.5
    for txt, xy, xt in (('Depolarizzazione', (t0 + 0.25, 10), (t0 - 7.5, 28)), ('Ripolarizzazione', (t0 + 0.75, -10), (t0 + 3, 18)), ('Iperpolarizzazione', (t0 + 2.0, -83), (t0 + 3.5, -90))):
        ax.annotate(txt, xy=xy, xytext=xt, color=TXT2, fontsize=11, arrowprops=dict(arrowstyle='->', color=TXT, lw=1))
    ax.set_ylim(-96, 52); ax.set_xlim(0, 30); lbl(ax, 'Tempo (ms)', 'Potenziale di membrana (mV)')

def draw_wave_rings(fig):
    ax, asp = _frame_ax(fig, 1.12); ax.set_aspect('equal')
    bands = [('δ delta · 3 Hz', 3, 0.32, BLUE), ('θ theta · 6 Hz', 6, 0.47, BLUE), ('α alpha · 10 Hz', 10, 0.62, AMBER), ('β beta · 20 Hz', 20, 0.77, LBLUE), ('γ gamma · 40 Hz', 40, 0.92, PALE)]
    th = np.linspace(0, 2 * np.pi, 3000)
    for name, f, R, c in bands:
        amp = 0.04 * (1 + 0.5 * np.sin(th * 2 + rng.uniform(0, 6))); r = R + amp * np.sin(f * th + rng.uniform(0, 6))
        _glow_line(ax, r * np.cos(th), r * np.sin(th), c, lw=1.6, glow=6)
        ax.text(0, R + 0.075, name, color=c if c == AMBER else TXT2, fontsize=12, ha='center', va='center')
    _burst(ax, (0, 0), n=500, scale=0.2)
    _dust(ax, (-1.12 * asp, 1.12 * asp), (-1.12, 1.12), 500)

def draw_comfort(fig):
    ax, asp = _frame_ax(fig, 1.0); ax.set_aspect('equal'); cx, cy, R = -0.35, -0.02, 0.48
    r = R * 0.96 * np.sqrt(rng.random(1800)); a = rng.uniform(0, 2 * np.pi, 1800)
    ax.scatter(cx + r * np.cos(a), cy + r * np.sin(a), s=rng.uniform(1, 5, 1800), color=LBLUE, alpha=0.6, lw=0)
    if _glow(): ax.add_patch(plt.Circle((cx, cy), R, fill=False, color=PALE, lw=10, alpha=0.05))
    ax.add_patch(plt.Circle((cx, cy), R, fill=False, color=PALE, lw=1.6, ls='--'))
    ax.text(cx, cy + R + 0.07, 'ZONA DI COMFORT', color=TXT2, fontsize=11, ha='center')
    k = 190; ang = rng.normal(0, 0.85, k); r1 = R + rng.gamma(1.3, 0.32, k); L = 0.05 + 0.1 * (r1 - R)
    A = np.c_[cx + (r1 - L) * np.cos(ang), cy + (r1 - L) * np.sin(ang)]; B = np.c_[cx + r1 * np.cos(ang), cy + r1 * np.sin(ang)]
    far = np.clip((r1 - R) / 1.0, 0, 1); col = _mix(AMBER, PALE, far); col[:, 3] = 0.9 - 0.4 * far
    ax.add_collection(LineCollection(np.stack([A, B], 1), colors=col, linewidths=1.2 + 0.8 * far))
    ax.scatter(B[:, 0], B[:, 1], s=6 + 30 * far, c=col, lw=0)
    big = np.argsort(-r1)[:5]
    if _glow(): ax.scatter(B[big, 0], B[big, 1], s=700, color=AMBER, alpha=0.1, lw=0)
    _dust(ax, (-asp, asp), (-1, 1), 500)

def draw_habit(fig):
    ax, asp = _frame_ax(fig, 1.0); s = 0.15; pts = []
    for j in range(-8, 9):
        for i in range(-12, 13):
            x, y = i * s + (j % 2) * s / 2, j * s * 0.866
            if abs(x) < asp * 0.98 and abs(y) < 0.98: pts.append((x, y))
    pts = np.array(pts) + rng.normal(0, 0.012, (len(pts), 2))
    d = np.linalg.norm(pts[:, None] - pts[None], axis=2); E = np.argwhere((d < s * 1.25) & (d > 0))
    ax.add_collection(LineCollection([(pts[i], pts[j]) for i, j in E if i < j], colors=[_rgba(EDGE, 0.45)], linewidths=0.9))
    ax.scatter(pts[:, 0], pts[:, 1], s=16, color=PALE, alpha=0.55, lw=0)
    cur = int(np.argmin(np.abs(pts[:, 0] + asp * 0.9) + np.abs(pts[:, 1] + 0.25))); path = [cur]
    while pts[cur, 0] < asp * 0.85 and len(path) < 60:
        nb = [j for j in np.where((d[cur] < s * 1.25) & (d[cur] > 0))[0] if j not in path]
        if not nb: break
        cur = max(nb, key=lambda j: pts[j, 0] + rng.normal(0, 0.06) - 0.4 * abs(pts[j, 1] - 0.1 * np.sin(pts[j, 0] * 2))); path.append(cur)
    L = _chaikin(pts[path], 3)
    _glow_line(ax, L[:, 0], L[:, 1], LBLUE, lw=5.5, glow=18)
    ax.scatter(pts[path, 0], pts[path, 1], s=60, color=PALE, lw=0, zorder=5)
    for q in (0.2, 0.45, 0.7, 0.9):
        k = int(q * (len(L) - 1)); tr = L[max(0, k - 18):k + 1]
        ax.add_collection(LineCollection(np.stack([tr[:-1], tr[1:]], 1), colors=[_rgba(AMBER, a) for a in np.linspace(0.05, 0.95, len(tr) - 1)], linewidths=3))
        if _glow(): ax.scatter(*L[k], s=600, color=AMBER, alpha=0.12, lw=0)
        ax.scatter(*L[k], s=46, color=AMBER, lw=0, zorder=6)
    for e in (path[0], path[-1]): ax.scatter(*pts[e], s=120, color=AMBER, lw=0, zorder=6)

def draw_attractor(fig):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    n = 42000; x, y, z = 0.1, 0.0, 0.0; dt = 0.005; out = np.empty((n, 3))
    for i in range(n):
        dx, dy, dz = 10 * (y - x), x * (28 - z) - y, x * y - 8 / 3 * z
        x, y, z = x + dx * dt, y + dy * dt, z + dz * dt; out[i] = (x, y, z)
    out = out[1500:]; u, v = out[:, 0], out[:, 2]
    sp = np.linalg.norm(np.diff(out, axis=0), axis=1); spn = (sp - sp.min()) / np.ptp(sp)
    seg = np.stack([np.c_[u[:-1], v[:-1]], np.c_[u[1:], v[1:]]], 1); col = SQ_COOL(0.3 + 0.7 * spn); col[:, 3] = 0.75
    if _glow(): ax.add_collection(LineCollection(seg, colors=col * [1, 1, 1, 0.06], linewidths=3))
    ax.add_collection(LineCollection(seg, colors=col, linewidths=0.6))
    if _glow():
        for sz, al in ((2200, 0.06), (600, 0.15)): ax.scatter(u[-1], v[-1], s=sz, color=AMBER, alpha=al, lw=0)
    ax.scatter(u[-1], v[-1], s=60, color=AMBER, lw=0)
    _dust(ax, (u.min() - 5, u.max() + 5), (v.min() - 5, v.max() + 5), 500)
    _set_frame(ax, fig, u, v, pad=0.08)

def draw_calcium(fig):
    ax = fig.add_axes([0.1, 0.12, 0.76, 0.82]); style(ax); Nn, T = 60, 400; t = np.arange(T)
    peaks = np.sort(rng.uniform(40, 360, Nn)); M = np.zeros((Nn, T))
    for i in range(Nn):
        for t0, amp in [(peaks[i], 1.0)] + [(rng.uniform(0, T), rng.uniform(0.2, 0.5)) for _ in range(2)]:
            dtt = np.clip(t - t0, 0, None); M[i] += amp * np.where(t >= t0, np.exp(-dtt / 14) * (1 - np.exp(-dtt / 2)), 0)
    M += rng.normal(0, 0.04, M.shape)
    im = ax.imshow(M, aspect='auto', cmap=SQ_COOL, vmin=0, vmax=0.9, extent=[0, 40, Nn, 0]); ax.grid(False)
    cb = fig.colorbar(im, cax=fig.add_axes([0.89, 0.12, 0.025, 0.82])); cb.outline.set_color(SPINE); cb.ax.tick_params(colors=TICK, labelsize=8); cb.set_label('ΔF/F', color=TXT)
    lbl(ax, 'Tempo (s)', 'Neurone')

def draw_dendrite(fig):
    ax, asp = _frame_ax(fig, 1.0); segs, widths = [], []; soma = np.array([0.0, -0.3])
    trunk = [soma]; a = np.pi / 2
    for _ in range(26): a += rng.normal(0, 0.05); trunk.append(trunk[-1] + 0.03 * np.array([np.cos(a), np.sin(a)]))
    trunk = np.array(trunk)
    for i in range(len(trunk) - 1): segs.append([trunk[i], trunk[i + 1]]); widths.append(4.2 - 2.6 * i / len(trunk))
    for i in range(4, len(trunk) - 3, 3):
        for sgn in (-1, 1):
            if rng.random() < 0.75: _tree(segs, widths, trunk[i], np.pi / 2 + sgn * rng.uniform(0.7, 1.2), 0.12, 1.6, 2)
    for k in range(5): _tree(segs, widths, trunk[-1], np.pi / 2 + (k - 2) * 0.35 + rng.normal(0, 0.1), 0.13, 1.9, 4)
    for k in range(6): _tree(segs, widths, soma, np.pi * 1.5 + (k - 2.5) * 0.48 + rng.normal(0, 0.1), 0.16, 2.2, 3)
    w = np.array(widths)
    if _glow(): ax.add_collection(LineCollection(segs, colors=[_rgba(PALE, 0.06)], linewidths=w * 4))
    ax.add_collection(LineCollection(segs, colors=[_rgba(PALE, 0.85)], linewidths=w))
    ends = np.array([s_[1] for s_ in segs]); pick = rng.choice(len(ends), 260)
    sp = ends[pick] + rng.normal(0, 0.008, (260, 2)); ax.scatter(sp[:, 0], sp[:, 1], s=4, color=LBLUE, lw=0)
    ax.add_patch(plt.Polygon([soma + (-0.07, -0.04), soma + (0.07, -0.04), soma + (0, 0.09)], color=AMBER))
    if _glow():
        for sz, al in ((3000, 0.05), (900, 0.12)): ax.scatter(*soma, s=sz, color=AMBER, alpha=al, lw=0)
    ax_pts = [soma]; a = -np.pi / 2
    for _ in range(18): a += rng.normal(0, 0.04); ax_pts.append(ax_pts[-1] + 0.04 * np.array([np.cos(a), np.sin(a)]))
    ax_pts = np.array(ax_pts); ax.plot(ax_pts[:, 0], ax_pts[:, 1], color=PALE, lw=1.4)
    for i in range(2, 17, 3): ax.plot(ax_pts[i:i + 2, 0], ax_pts[i:i + 2, 1], color=BLUE, lw=6, alpha=0.8, solid_capstyle='round')
    _dust(ax, (-asp, asp), (-1, 1), 500)

def draw_galaxy(fig):
    ax, asp = _frame_ax(fig, 0.8); ax.set_aspect('equal'); n = 9000
    th = rng.uniform(0, 3.4 * np.pi, n); arm = rng.integers(0, 2, n); r = 0.06 * np.exp(0.26 * th)
    r = r / r.max() * 1.0; ang = th + arm * np.pi + rng.normal(0, 0.35, n) / (1 + th * 0.25)
    r = r * (1 + rng.normal(0, 0.08, n)); x, y = r * np.cos(ang), r * np.sin(ang) * 0.6
    c, s_ = np.cos(0.45), np.sin(0.45); X, Y = x * c - y * s_, x * s_ + y * c
    rn = np.clip(r, 0, 1); col = _mix(AMBER, LBLUE, np.clip(rn / 0.25, 0, 1)); far = np.clip((rn - 0.4) / 0.6, 0, 1)
    col = col * (1 - far[:, None]) + _mix(LBLUE, BLUE, far) * far[:, None]; col[:, 3] = 0.85 - 0.25 * far
    if _glow(): ax.scatter(X, Y, s=14, c=col * [1, 1, 1, 0.05], lw=0)
    ax.scatter(X, Y, s=rng.uniform(0.6, 3.2, n), c=col, lw=0)
    sel = np.where((rn > 0.3) & (rn < 0.95))[0]; nodes = np.c_[X, Y][rng.choice(sel, 24, replace=False)]
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            if np.hypot(*(nodes[i] - nodes[j])) < 0.38: ax.plot(*zip(nodes[i], nodes[j]), color=LBLUE, lw=0.8, alpha=0.5)
    for p in nodes: _neuron(ax, p, size=0.3, dendrites=5, depth=2, col=PALE, glow_alpha=0.04)
    if _glow():
        for sz, al in ((9000, 0.04), (2500, 0.08), (600, 0.2)): ax.scatter(0, 0, s=sz, color=AMBER, alpha=al, lw=0)
    _dust(ax, (-0.8 * asp, 0.8 * asp), (-0.8, 0.8), 600)

def draw_hrv(fig):
    ax = fig.add_axes([0.1, 0.42, 0.86, 0.53]); style(ax); ax.set_xticklabels([])
    t = np.linspace(0, 120, 1200); chaotic = 74 + np.convolve(rng.normal(0, 2.2, t.size), np.ones(15) / 15, 'same') * 4
    coh = 70 + 6 * np.sin(2 * np.pi * t / 10); w = 1 / (1 + np.exp(-(t - 60) / 4))
    hr = chaotic * (1 - w) + coh * w + rng.normal(0, 0.3, t.size)
    ax.axvspan(60, 120, color=AMBER, alpha=0.06); ax.plot(t, hr, color=LBLUE, lw=1.9); ax.set_xlim(0, 120)
    top = hr.max() + 2; ax.set_ylim(hr.min() - 2, top + 3); ax.text(64, top, 'coerenza cardiaca', color=AMBER, fontsize=12); ax.text(3, top, 'stress', color=TXT2, fontsize=12)
    lbl(ax, None, 'Battito (bpm)')
    ax2 = fig.add_axes([0.1, 0.1, 0.86, 0.27]); style(ax2)
    br = np.where(t < 60, np.sin(2 * np.pi * t / 3.6 + np.cumsum(rng.normal(0, 0.05, t.size))) * rng.uniform(0.4, 0.8), np.sin(2 * np.pi * t / 10))
    ax2.fill_between(t, 0, br, color=BLUE, alpha=0.3, lw=0); ax2.plot(t, br, color=PALE, lw=1.2); ax2.set_xlim(0, 120)
    lbl(ax2, 'Tempo (s)', 'Respiro')

def draw_molecule(fig):
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    ring = [(1.4 * np.cos(np.radians(a)), 1.4 * np.sin(np.radians(a)), 0) for a in (180, 120, 60, 0, -60, -120)]
    A = [('C', *p) for p in ring]
    A += [('C', -2.9, 0, 0.2), ('C', -3.65, 1.3, 0.7), ('N', -5.15, 1.25, 0.35)]
    A += [('O', 1.38, 2.39, 0), ('O', 2.76, 0, 0)]
    B = [(0, 1, 2), (1, 2, 1), (2, 3, 2), (3, 4, 1), (4, 5, 2), (5, 0, 1), (0, 6, 1), (6, 7, 1), (7, 8, 1), (2, 9, 1), (3, 10, 1)]
    H = [(1, 120), (4, -60), (5, -120)]
    for idx, a in H:
        x, y, zz = A[idx][1:]; A.append(('H', x + 1.0 * np.cos(np.radians(a)), y + 1.0 * np.sin(np.radians(a)), zz)); B.append((idx, len(A) - 1, 1))
    for idx, off in ((6, (0.2, -0.9, 0.8)), (6, (0.2, -0.6, -0.9)), (7, (0.1, 0.8, 0.9)), (7, (-0.2, 0.7, -0.8)), (8, (-0.6, 0.8, 0.5)), (8, (-0.6, -0.7, -0.4)), (9, (0.9, 0.3, 0)), (10, (0.5, -0.85, 0))):
        x, y, zz = A[idx][1:]; A.append(('H', x + off[0], y + off[1], zz + off[2])); B.append((idx, len(A) - 1, 1))
    P = np.array([a[1:] for a in A]); P -= P.mean(0); u, v, z = _view(P, -20, 28); zn = (z - z.min()) / np.ptp(z)
    colors = {'C': PALE, 'O': RED, 'N': BLUE, 'H': HERO if _glow() else '#5b6884'}; size = {'C': 2600, 'O': 2900, 'N': 2900, 'H': 800}
    for i, j, kb in B:
        d = np.array([u[j] - u[i], v[j] - v[i]]); nrm = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-9) * 0.09
        offs = [0] if kb == 1 else [-1, 1]
        for o in offs: ax.plot([u[i] + o * nrm[0], u[j] + o * nrm[0]], [v[i] + o * nrm[1], v[j] + o * nrm[1]], color=LBLUE, lw=4.5, alpha=0.5 + 0.4 * (zn[i] + zn[j]) / 2, zorder=2)
    for k in np.argsort(z):
        el = A[k][0]; s_ = size[el] * (0.7 + 0.5 * zn[k])
        cloud = np.c_[u[k], v[k]] + rng.normal(0, 0.36 if el != 'H' else 0.2, (220, 2))
        ax.scatter(cloud[:, 0], cloud[:, 1], s=2.5, color=colors[el], alpha=0.35, lw=0, zorder=3)
        if _glow(): ax.scatter(u[k], v[k], s=s_ * 3, color=colors[el], alpha=0.08, lw=0, zorder=3)
        ax.scatter(u[k], v[k], s=s_, color=colors[el], alpha=0.95, lw=0, zorder=4)
    ax.text(u.min(), v.min() - 1.1, 'C₈H₁₁NO₂  ·  dopamina', color=TXT2, fontsize=20)
    _dust(ax, (u.min() - 2, u.max() + 2), (v.min() - 2, v.max() + 2), 500)
    _set_frame(ax, fig, u, np.r_[v, v.min() - 1.4], pad=0.07)

# ── scorta: copertine pronte da assegnare alle nuove live ─────────────────────
import matplotlib.patheffects as pe

def _style3d(ax, labels):
    for a in (ax.xaxis, ax.yaxis, ax.zaxis):
        a.set_pane_color((0, 0, 0, 0)); a._axinfo['grid']['color'] = GRID3D; a.line.set_color(LINE3D)
    ax.tick_params(colors=TXT, labelsize=9)
    for f, t in zip((ax.set_xlabel, ax.set_ylabel, ax.set_zlabel), labels): f(t, color=TXT, labelpad=8)

def draw_plateau_wire(fig):
    ax = fig.add_axes([-0.04, 0.0, 1.08, 1.0], projection='3d'); ax.set_facecolor('none')
    X, Y = np.meshgrid(np.linspace(-1, 1, 34), np.linspace(-1, 1, 34)); R = np.sqrt((X - 0.15) ** 2 + (Y + 0.05) ** 2)
    Z = 0.9 / (1 + np.exp((R - 0.42) * 14)) + 0.25 * np.exp(-((X + 0.6) ** 2 + (Y - 0.6) ** 2) * 9) + 0.04 * np.sin(5 * X) * np.cos(4 * Y) + rng.normal(0, 0.01, X.shape)
    ax.plot_wireframe(X, Y, Z, rstride=1, cstride=1, color=LBLUE, linewidth=0.6, alpha=0.75)
    top = Z > 0.8; ax.scatter(X[top], Y[top], Z[top] + 0.012, s=9, color=AMBER, depthshade=False)
    ax.view_init(elev=30, azim=-60); _style3d(ax, ('Param A', 'Param B', 'Profit factor'))

def draw_stacked_area(fig):
    ax = main_ax(fig); n = 500; x = np.arange(n)
    parts = []
    for k in range(5):
        w_ = np.cumsum(rng.normal(0.025 + 0.008 * k, 0.14, n)); parts.append(w_ - min(w_.min(), 0))
    ax.stackplot(x, parts, colors=[SQ_COOL(0.22 + 0.17 * k) for k in range(5)], alpha=0.92, labels=['Breakout', 'Mean reversion', 'Sessioni', 'Trend', 'Stagionalità'])
    ax.plot(x, np.sum(parts, axis=0), color=HERO, lw=1.8)
    ax.legend(loc='upper left', frameon=False, labelcolor=TXT, fontsize=11); ax.set_xlim(0, n - 1); lbl(ax, 'Giorni', 'Profitto cumulato (R)')

def draw_lollipop(fig):
    ax = main_ax(fig); m = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']; x = np.arange(12)
    v = rng.normal(2.0, 3.0, 12); c = [GREEN if vi > 0 else RED for vi in v]
    for xi, vi, ci in zip(x, v, c): ax.plot([xi, xi], [0, vi], color=ci, lw=2.6)
    ax.scatter(x, v, s=180, color=c, zorder=3)
    for xi, vi in zip(x, v): ax.text(xi, vi + (0.6 if vi > 0 else -1.1), f'{vi:+.1f}%', ha='center', color=TXT2, fontsize=10)
    ax.axhline(0, color=ZERO, lw=1.2); ax.set_xticks(x); ax.set_xticklabels(m); ax.set_ylim(min(v) - 2, max(v) + 2); lbl(ax, None, 'Rendimento mensile (%)')

def draw_kelly(fig):
    ax = main_ax(fig); f = np.linspace(0, 0.42, 400); p, b = 0.58, 1.0
    g = (p * np.log(1 + b * f) + (1 - p) * np.log(1 - f)) * 100; fk = (p * b - (1 - p)) / b
    gmax = (p * np.log(1 + b * fk) + (1 - p) * np.log(1 - fk)) * 100
    ax.fill_between(f * 100, g, 0, where=g > 0, color=BLUE, alpha=0.16, lw=0); ax.fill_between(f * 100, g, 0, where=g < 0, color=RED, alpha=0.14, lw=0)
    ax.plot(f * 100, g, color=LBLUE, lw=2.8); ax.axhline(0, color=ZERO, lw=1)
    ax.axvline(fk * 100, color=AMBER, ls='--', lw=1.4); ax.scatter([fk * 100], [gmax], s=220, color=AMBER, edgecolor='#ffe39a', lw=1.2, zorder=5)
    ax.axvline(fk * 50, color=GREEN, ls=':', lw=1.6); ax.text(fk * 50 + 0.4, gmax * 0.25, 'mezzo Kelly', color=GREEN, fontsize=12, rotation=90)
    ax.text(fk * 100 + 0.6, gmax * 1.06, f'Kelly = {fk * 100:.0f}%', color=AMBER, fontsize=13); ax.text(34, -1.4, 'zona di rovina', color=RED, fontsize=13)
    ax.set_xlim(0, 42); ax.set_ylim(-2.3, gmax * 1.4); lbl(ax, 'Rischio per trade (% del capitale)', 'Crescita attesa per trade (%)')

def draw_rolling_sharpe(fig):
    ax = main_ax(fig); n = 700; x = np.arange(n); r = rng.normal(0.0006, 0.01, n) + 0.0012 * np.sin(x / 80)
    w = 90; rs = np.full(n, np.nan)
    for i in range(w, n): s = r[i - w:i]; rs[i] = s.mean() / (s.std() + 1e-9) * np.sqrt(252)
    ax.fill_between(x, rs - 0.6, rs + 0.6, color=BLUE, alpha=0.12, lw=0)
    ax.fill_between(x, 0, rs, where=rs > 0, color=GREEN, alpha=0.14, lw=0); ax.fill_between(x, 0, rs, where=rs < 0, color=RED, alpha=0.14, lw=0)
    ax.plot(x, rs, color=LBLUE, lw=2); ax.axhline(0, color=ZERO, lw=1); m = np.nanmean(rs)
    ax.axhline(m, color=AMBER, ls='--', lw=1.3); ax.text(w + 5, m + 0.2, f'Sharpe medio {m:.2f}', color=AMBER, fontsize=12)
    ax.set_xlim(0, n); lbl(ax, 'Giorni', 'Sharpe mobile (90 giorni)')

def draw_pairplot(fig):
    names = ['ATR', 'Gap', 'Volume']; k = 3; n = 420
    A = rng.normal(0, 1, (n, k)); A[:, 1] += 0.6 * A[:, 0]; A[:, 2] += -0.4 * A[:, 0] + 0.3 * A[:, 1]
    res = 0.5 * A[:, 0] - 0.3 * A[:, 2] + rng.normal(0, 1, n); col = SQ_COOL(np.clip(0.5 + 0.25 * res, 0.15, 1))
    for i in range(k):
        for j in range(k):
            ax = fig.add_axes([0.09 + j * 0.3, 0.68 - i * 0.3, 0.27, 0.27]); style(ax, label_size=7)
            if i == j: ax.hist(A[:, i], bins=24, color=BARS(0.6), alpha=0.9)
            else: ax.scatter(A[:, j], A[:, i], s=8, c=col, lw=0, alpha=0.8)
            if i == k - 1: ax.set_xlabel(names[j], color=TXT)
            if j == 0: ax.set_ylabel(names[i], color=TXT)
            if i < k - 1: ax.set_xticklabels([])
            if j > 0: ax.set_yticklabels([])

def draw_ridgeline(fig):
    ax = main_ax(fig, (0.1, 0.1, 0.86, 0.86)); ax.grid(False)
    m = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']; x = np.linspace(-6, 6, 400)
    for i, name in enumerate(m[::-1]):
        mu, sd = rng.normal(0.3, 0.6), rng.uniform(0.8, 1.8); y = np.exp(-((x - mu) / sd) ** 2 / 2) * (1 + 0.25 * np.sin(x * rng.uniform(1, 3)))
        y = y / y.max() * 1.7; base = i * 0.8; z = 100 - i
        ax.fill_between(x, base, base + y, color=SQ_COOL(0.25 + 0.6 * i / 11), alpha=0.95, lw=0, zorder=z)
        ax.plot(x, base + y, color=HERO, lw=1.0, zorder=z + 0.5); ax.text(-6.25, base + 0.1, name, ha='right', color=TXT2, fontsize=11)
    ax.set_yticks([]); ax.set_xlim(-6, 6); lbl(ax, 'Rendimento giornaliero (%)', None)

def draw_bubble(fig):
    ax = main_ax(fig); names = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'US500', 'NAS100', 'GER40', 'USOIL', 'BTCUSD', 'AUDUSD', 'USDCAD', 'JPN225']
    vol = rng.uniform(5, 40, 12); ret = rng.normal(6, 8, 12); size = rng.uniform(300, 3600, 12)
    ax.scatter(vol, ret, s=size, c=SQ_COOL(np.clip(0.3 + ret / 30, 0.2, 1)), alpha=0.6, edgecolor=LBLUE, lw=1)
    for n_, v_, r_ in zip(names, vol, ret): ax.text(v_, r_, n_, ha='center', va='center', color=TXT2, fontsize=10)
    b = int(np.argmax(ret / vol)); ax.scatter(vol[b], ret[b], s=size[b] * 1.3, facecolor='none', edgecolor=AMBER, lw=2.2)
    ax.axhline(0, color=ZERO, lw=1); lbl(ax, 'Volatilità annua (%)', 'Rendimento della strategia (%)')

def draw_funnel(fig):
    ax = fig.add_axes([0.03, 0.04, 0.94, 0.92]); ax.axis('off'); ax.set_xlim(-1.05, 2.05); ax.set_ylim(0, 1)
    st = [('Segnali generati', 1240), ('Filtro di sessione', 610), ('Filtro di volatilità', 352), ('Trade eseguiti', 198), ('Trade vincenti', 109)]
    for i, (name, v) in enumerate(st):
        w0 = v / st[0][1]; w1 = st[i + 1][1] / st[0][1] if i + 1 < len(st) else w0 * 0.85; y0 = 0.94 - i * 0.185; y1 = y0 - 0.16
        ax.add_patch(plt.Polygon([(-w0, y0), (w0, y0), (w1, y1), (-w1, y1)], color=AMBER if i == len(st) - 1 else SQ_COOL(0.3 + 0.15 * i), alpha=0.9))
        ax.text(0, (y0 + y1) / 2, f'{v:,}'.replace(',', '.'), ha='center', va='center', color='white', fontsize=18, weight='bold',
                path_effects=[pe.withStroke(linewidth=3, foreground='#0b0f18')])
        ax.text(1.08, (y0 + y1) / 2, name, ha='left', va='center', color=TXT2, fontsize=14)

def draw_bollinger(fig):
    ax = fig.add_axes([0.08, 0.36, 0.88, 0.6]); style(ax); ax.set_xticklabels([])
    n, w = 90, 20; p = 100 + np.cumsum(rng.normal(0, 0.6, n + w)); x = np.arange(n)
    ma = np.array([p[i:i + w].mean() for i in range(n)]); sd = np.array([p[i:i + w].std() for i in range(n)]); c_ = p[w:]
    ax.fill_between(x, ma - 2 * sd, ma + 2 * sd, color=BLUE, alpha=0.1, lw=0)
    for k_ in (-2, 2): ax.plot(x, ma + k_ * sd, color=LBLUE, lw=1.2)
    ax.plot(x, ma, color=AMBER, lw=1.4, ls='--')
    for i in range(n):
        o, c = (c_[i - 1] if i else c_[0]), c_[i]; hh, ll = max(o, c) + abs(rng.normal(0, .2)), min(o, c) - abs(rng.normal(0, .2)); col = GREEN if c >= o else RED
        ax.plot([i, i], [ll, hh], color=col, lw=0.9); ax.add_patch(plt.Rectangle((i - .32, min(o, c)), .64, abs(c - o) + .02, color=col))
    ax.set_xlim(-1, n); lbl(ax, None, 'Prezzo')
    d = np.diff(p); up = np.convolve(np.clip(d, 0, None), np.ones(14) / 14, 'same'); dn = np.convolve(np.clip(-d, 0, None), np.ones(14) / 14, 'same')
    rsi = (100 - 100 / (1 + up / (dn + 1e-9)))[-n:]
    ax2 = fig.add_axes([0.08, 0.08, 0.88, 0.23]); style(ax2)
    ax2.axhspan(70, 100, color=RED, alpha=0.08); ax2.axhspan(0, 30, color=GREEN, alpha=0.08)
    for y_ in (30, 70): ax2.axhline(y_, color=SPINE, ls='--', lw=1)
    ax2.plot(x, rsi, color=PALE, lw=1.6); ax2.set_ylim(0, 100); ax2.set_xlim(-1, n); lbl(ax2, 'Barre', 'RSI')

def draw_depth(fig):
    ax = main_ax(fig); mid = 100.0
    bids = np.linspace(mid - 0.01, mid - 2, 200); asks = np.linspace(mid + 0.01, mid + 2, 200)
    bq = np.cumsum(rng.gamma(1.2, 10, 200) * (1 + 6 * np.exp(-((bids - 99.2) / 0.05) ** 2)))
    aq = np.cumsum(rng.gamma(1.2, 10, 200) * (1 + 6 * np.exp(-((asks - 100.9) / 0.05) ** 2)))
    ax.fill_between(bids, 0, bq, color=GREEN, alpha=0.25, lw=0); ax.plot(bids, bq, color=GREEN, lw=2)
    ax.fill_between(asks, 0, aq, color=RED, alpha=0.25, lw=0); ax.plot(asks, aq, color=RED, lw=2)
    top = max(bq.max(), aq.max()); ax.axvline(mid, color=HERO, ls='--', lw=1.2); ax.text(mid + 0.04, top * 0.95, 'prezzo', color=TXT2, fontsize=11)
    ax.annotate('muro di acquisto', xy=(99.2, np.interp(99.2, bids[::-1], bq[::-1])), xytext=(98.2, top * 0.75), color=AMBER, fontsize=12, arrowprops=dict(arrowstyle='->', color=AMBER))
    ax.annotate('muro di vendita', xy=(100.9, np.interp(100.9, asks, aq)), xytext=(100.95, top * 0.85), color=AMBER, fontsize=12, arrowprops=dict(arrowstyle='->', color=AMBER))
    ax.set_xlim(98, 102); ax.set_ylim(0, top * 1.05); lbl(ax, 'Prezzo', 'Volume cumulato')

def _treemap(vals, x, y, w, h, out):
    if len(vals) == 1: out.append((x, y, w, h)); return
    tot = sum(vals); acc, k = 0, 0
    while k < len(vals) - 1 and acc + vals[k] < tot / 2: acc += vals[k]; k += 1
    k = max(k, 1); fa = sum(vals[:k]) / tot
    if w >= h: _treemap(vals[:k], x, y, w * fa, h, out); _treemap(vals[k:], x + w * fa, y, w * (1 - fa), h, out)
    else: _treemap(vals[:k], x, y, w, h * fa, out); _treemap(vals[k:], x, y + h * fa, w, h * (1 - fa), out)

def draw_treemap(fig):
    ax = fig.add_axes([0.03, 0.03, 0.94, 0.94]); ax.axis('off'); ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    items = sorted([('Breakout DAX', 22), ('Sessione Londra', 18), ('Oro trend', 14), ('Mean reversion NAS', 12), ('Swing EURUSD', 10), ('Stagionalità', 8), ('Gap S&P', 7), ('Petrolio', 5), ('Cash', 4)], key=lambda t: -t[1])
    rects = []; _treemap([v for _, v in items], 0, 0, 1, 1, rects)
    for (name, v), (x, y, w, h) in zip(items, rects):
        r_ = rng.normal(0.4, 0.8); c = SQ(np.clip(0.5 + r_ / 3, 0, 1)) if name != 'Cash' else matplotlib.colors.to_rgba(NEUTRAL)
        ax.add_patch(plt.Rectangle((x + 0.004, y + 0.004), w - 0.008, h - 0.008, color=c, alpha=0.85))
        fs = 15 if w * h > 0.06 else 11
        ax.text(x + 0.015, y + h - 0.02, name, color='white', fontsize=fs, va='top', weight='bold', path_effects=[pe.withStroke(linewidth=3, foreground='#0b0f18')])
        ax.text(x + 0.015, y + h - 0.02 - fs / 300 - 0.03, f'{v}% · {r_:+.1f}R', color='white', fontsize=fs - 3, va='top', path_effects=[pe.withStroke(linewidth=3, foreground='#0b0f18')])

# mente (scorta)
def draw_brain_orb(fig):
    ax, asp = _frame_ax(fig, 1.05); ax.set_aspect('equal'); az, el = -30, 20
    n = 5200; phi = np.arccos(1 - 2 * rng.random(n)); th = rng.uniform(0, 2 * np.pi, n)
    P = np.c_[np.sin(phi) * np.cos(th), np.sin(phi) * np.sin(th), np.cos(phi)] * 0.82
    u, v, z = _view(P, az, el); zn = (z - z.min()) / np.ptp(z); col = _mix(BLUE, PALE, zn); col[:, 3] = 0.12 + 0.7 * zn
    ax.scatter(u, v, s=0.8 + 3 * zn, c=col, lw=0)
    t = np.linspace(0, 2 * np.pi, 300)
    for k in range(4):
        a = k * np.pi / 4; ring = np.c_[np.cos(t) * np.cos(a), np.cos(t) * np.sin(a), np.sin(t)] * 0.82
        ru, rv, _ = _view(ring, az, el); ax.plot(ru, rv, color=LBLUE, lw=0.6, alpha=0.25)
    N = rng.normal(0, 1, (70, 3)); N = N / np.linalg.norm(N, axis=1, keepdims=True) * (rng.random(70) ** 0.5 * 0.66)[:, None]
    un, vn, _ = _view(N, az, el); fire = rng.choice(70, 7, replace=False)
    for i in range(70):
        for j in np.argsort(((N - N[i]) ** 2).sum(1))[1:4]:
            hot = i in fire or j in fire; ax.plot([un[i], un[j]], [vn[i], vn[j]], color=AMBER if hot else LBLUE, lw=1.1 if hot else 0.7, alpha=0.7 if hot else 0.4)
    ax.scatter(un, vn, s=14, color=PALE, lw=0, zorder=4)
    if _glow(): ax.scatter(un[fire], vn[fire], s=500, color=AMBER, alpha=0.12, lw=0)
    ax.scatter(un[fire], vn[fire], s=40, color=AMBER, lw=0, zorder=5)
    if _glow():
        for sz, al in ((6000, 0.04), (1800, 0.08)): ax.scatter(0, 0, s=sz, color=AMBER, alpha=al, lw=0)
    _dust(ax, (-1.05 * asp, 1.05 * asp), (-1.05, 1.05), 600)

def draw_hypnogram(fig):
    ax = fig.add_axes([0.14, 0.42, 0.82, 0.53]); style(ax); ax.set_xticklabels([])
    seq = []
    for c in range(5):
        deep = max(0, 30 - c * 8); rem = 10 + c * 6
        seq += [4] * (6 if c == 0 else 2) + [2] * 6 + [1] * 18 + [0] * deep + [1] * 10 + [3] * rem
    y = np.array(seq, float); t = np.arange(len(y)) / 60
    ax.step(t, y, where='post', color=PALE, lw=1.6)
    rem = y == 3; ax.fill_between(t, 2.85, 3.15, where=rem, step='post', color=AMBER, alpha=0.9, lw=0)
    ax.fill_between(t, -0.15, 0.15, where=y == 0, step='post', color=BLUE, alpha=0.9, lw=0)
    ax.set_yticks(range(5)); ax.set_yticklabels(['N3 profondo', 'N2', 'N1', 'REM', 'Veglia']); ax.set_ylim(-0.6, 4.6); ax.set_xlim(0, t[-1])
    ax2 = fig.add_axes([0.14, 0.1, 0.82, 0.25]); style(ax2); cyc = np.arange(1, 6)
    ax2.bar(cyc - 0.18, [max(0, 30 - c * 8) for c in range(5)], width=0.34, color=BLUE, label='Sonno profondo')
    ax2.bar(cyc + 0.18, [10 + c * 6 for c in range(5)], width=0.34, color=AMBER, label='REM')
    ax2.legend(loc='upper right', frameon=False, labelcolor=TXT, fontsize=10); lbl(ax2, 'Ciclo di sonno', 'Minuti')

def draw_yerkes(fig):
    ax = main_ax(fig); x = np.linspace(0, 10, 400); y = np.exp(-((x - 5) / 2.1) ** 2) * 100
    for a, b, c in ((0, 3, BLUE), (3, 7, GREEN), (7, 10, RED)): ax.axvspan(a, b, color=c, alpha=0.08)
    ax.plot(x, y, color=LBLUE, lw=3.2); ax.scatter([5], [100], s=260, color=AMBER, edgecolor='#ffe39a', lw=1.2, zorder=5)
    for xx, t in ((1.5, 'Noia'), (5, 'Zona ottimale'), (8.5, 'Ansia')): ax.text(xx, 108, t, ha='center', color=TXT2, fontsize=14)
    yy = np.exp(-((8.2 - 5) / 2.1) ** 2) * 100; ax.scatter([8.2], [yy], s=120, color=RED, zorder=5)
    ax.annotate('', xy=(5.6, 96), xytext=(8.0, yy + 4), arrowprops=dict(arrowstyle='->', color=AMBER, lw=2, connectionstyle='arc3,rad=0.3'))
    ax.set_xlim(0, 10); ax.set_ylim(0, 118); lbl(ax, 'Livello di stress (attivazione)', 'Performance (%)')

def draw_emotion_wheel(fig):
    ax = fig.add_axes([0.08, 0.08, 0.84, 0.84], projection='polar'); ax.set_facecolor('none')
    emo = ['Fiducia', 'Calma', 'Gioia', 'Attesa', 'Paura', 'Avidità', 'Rabbia', 'Frustrazione']
    th = np.linspace(0, 2 * np.pi, 8, endpoint=False); w = 2 * np.pi / 8 * 0.92
    for r0, h, s in ((0.15, 0.3, 1.0), (0.47, 0.25, 0.7), (0.74, 0.2, 0.45)):
        cols = [_rgba(LBLUE if i < 4 else (AMBER if emo[i] in ('Paura', 'Avidità') else RED), s * rng.uniform(0.6, 1)) for i in range(8)]
        ax.bar(th, h, width=w, bottom=r0, color=cols, edgecolor=EDGE, lw=0.8)
    for a, e in zip(th, emo): ax.text(a, 1.06, e, ha='center', va='center', color=AMBER if e in ('Paura', 'Avidità') else TXT2, fontsize=14)
    ax.set_ylim(0, 1.15); ax.set_xticks([]); ax.set_yticks([]); ax.spines['polar'].set_visible(False); ax.grid(False)

def draw_box_breath(fig):
    ax, asp = _frame_ax(fig, 1.0); ax.set_aspect('equal'); s = 0.6
    path = np.array([(-s, -s), (-s, s), (s, s), (s, -s), (-s, -s)]); L = np.vstack([np.linspace(path[i], path[i + 1], 120) for i in range(4)])
    _glow_line(ax, L[:, 0], L[:, 1], PALE, lw=2.2, glow=10)
    for (x, y, t, r) in ((-s - 0.08, 0, 'Inspira · 4 s', 90), (0, s + 0.08, 'Trattieni · 4 s', 0), (s + 0.08, 0, 'Espira · 4 s', -90), (0, -s - 0.08, 'Trattieni · 4 s', 0)):
        ax.text(x, y, t, ha='center', va='center', rotation=r, color=TXT2, fontsize=13)
    k = int(len(L) * 0.36); tr = L[max(0, k - 110):k + 1]
    ax.add_collection(LineCollection(np.stack([tr[:-1], tr[1:]], 1), colors=[_rgba(AMBER, a) for a in np.linspace(0.02, 0.95, len(tr) - 1)], linewidths=4))
    if _glow():
        for sz, al in ((2400, 0.06), (700, 0.16)): ax.scatter(*L[k], s=sz, color=AMBER, alpha=al, lw=0)
    ax.scatter(*L[k], s=90, color=AMBER, lw=0, zorder=5)
    r = 0.42 * np.sqrt(rng.random(500)); a = rng.uniform(0, 2 * np.pi, 500)
    ax.scatter(r * np.cos(a), r * np.sin(a), s=rng.uniform(0.5, 3, 500), color=LBLUE, alpha=0.35, lw=0)
    ax.text(0, 0, '4 · 4 · 4 · 4', ha='center', va='center', color=HERO, fontsize=26, weight='bold')
    _dust(ax, (-asp, asp), (-1, 1), 400)

def draw_iris(fig):
    ax, asp = _frame_ax(fig, 1.0); ax.set_aspect('equal'); n = 2600
    a = rng.uniform(0, 2 * np.pi, n); r0 = 0.25 + rng.random(n) * 0.04; rm = 0.42 + rng.random(n) * 0.06; r1 = 0.6 + rng.random(n) * 0.3; da = rng.normal(0, 0.05, n)
    A = np.c_[r0 * np.cos(a), r0 * np.sin(a)]; M = np.c_[rm * np.cos(a + da / 2), rm * np.sin(a + da / 2)]; B = np.c_[r1 * np.cos(a + da), r1 * np.sin(a + da)]
    ci = _mix(AMBER, LBLUE, rng.random(n) * 0.5); ci[:, 3] = 0.55
    co = _mix(LBLUE, BLUE, (r1 - 0.6) / 0.3); co[:, 3] = 0.45
    ax.add_collection(LineCollection(np.stack([A, M], 1), colors=ci, linewidths=0.9)); ax.add_collection(LineCollection(np.stack([M, B], 1), colors=co, linewidths=0.8))
    ax.add_patch(plt.Circle((0, 0), 0.24, color='#020409' if _glow() else '#0b1530'))
    ax.add_patch(plt.Circle((0, 0), 0.93, fill=False, color=EDGE, lw=3))
    ax.add_patch(matplotlib.patches.Ellipse((-0.08, 0.09), 0.09, 0.06, angle=30, color='white', alpha=0.85))
    for k in range(12):
        t = k * np.pi / 6; ax.plot([1.0 * np.cos(t), 1.07 * np.cos(t)], [1.0 * np.sin(t), 1.07 * np.sin(t)], color=TICK, lw=1.2)
    _dust(ax, (-asp, asp), (-1, 1), 500)

def draw_flow_channel(fig):
    ax = main_ax(fig); x = np.linspace(0, 10, 100)
    ax.fill_between(x, x + 1.6, 10, color=RED, alpha=0.08, lw=0); ax.fill_between(x, 0, x - 1.6, color=BLUE, alpha=0.08, lw=0)
    ax.fill_between(x, x - 1.6, x + 1.6, color=AMBER, alpha=0.14, lw=0); ax.plot(x, x, color=AMBER, ls='--', lw=1.2)
    ax.text(1.6, 8.3, 'ANSIA', color=RED, fontsize=16, weight='bold'); ax.text(7.2, 1.6, 'NOIA', color=LBLUE, fontsize=16, weight='bold')
    ax.text(6.0, 6.9, 'FLOW', color=AMBER, fontsize=20, weight='bold', rotation=45)
    pts = [(1, 1.4)]
    for _ in range(9): pts.append((pts[-1][0] + rng.uniform(0.7, 1.0), pts[-1][1] + rng.uniform(0.4, 1.3)))
    pts = np.array(pts); pts[:, 1] = np.clip(pts[:, 1], pts[:, 0] - 1.3, pts[:, 0] + 1.3)
    ax.plot(pts[:, 0], pts[:, 1], color=PALE, lw=2, marker='o', ms=6); ax.scatter(*pts[-1], marker='*', s=340, color=AMBER, edgecolor='#ffe39a', zorder=5)
    ax.set_xlim(0, 10); ax.set_ylim(0, 10); lbl(ax, 'Abilità', 'Sfida')

def draw_focus_gauge(fig):
    ax = fig.add_axes([0.05, 0.36, 0.9, 0.6]); ax.axis('off'); ax.set_aspect('equal'); ax.set_xlim(-1.25, 1.25); ax.set_ylim(-0.3, 1.15)
    for a0, a1, c in ((120, 180, RED), (60, 120, SAND), (0, 60, GREEN)): ax.add_patch(Wedge((0, 0), 1.0, a0, a1, width=0.18, color=_rgba(c, 0.55)))
    val = 0.78; ang = np.radians(180 - val * 180)
    for k in range(11):
        t = np.radians(180 - k * 18); ax.plot([0.74 * np.cos(t), 0.79 * np.cos(t)], [0.74 * np.sin(t), 0.79 * np.sin(t)], color=TICK, lw=1.2)
    _glow_line(ax, [0, 0.86 * np.cos(ang)], [0, 0.86 * np.sin(ang)], AMBER, lw=4, glow=12)
    ax.add_patch(plt.Circle((0, 0), 0.07, color=AMBER))
    ax.text(0, -0.18, '78', ha='center', color=HERO, fontsize=34, weight='bold'); ax.text(0, 0.42, 'indice di focus', ha='center', color=TXT, fontsize=12)
    ax2 = fig.add_axes([0.12, 0.06, 0.8, 0.24]); ax2.axis('off'); ax2.set_xlim(0, 1); ax2.set_ylim(0, 3)
    for i, (nm, v) in enumerate((('Disciplina', 0.82), ('Pazienza', 0.64), ('Controllo emotivo', 0.71))):
        y = 2.4 - i; ax2.text(0, y + 0.18, nm, color=TXT2, fontsize=12); ax2.add_patch(plt.Rectangle((0, y - 0.18), 1, 0.2, color=_rgba(LBLUE, 0.15)))
        ax2.add_patch(plt.Rectangle((0, y - 0.18), v, 0.2, color=LBLUE)); ax2.text(1.0, y + 0.18, f'{int(v * 100)}%', color=AMBER, fontsize=12, ha='right')

# ── interfaccia: sfondo della slide "Avvisi" in Home (senza immagini nel post) ──
def draw_broadcast(fig):
    ax, asp = _frame_ax(fig, 1.0); ax.set_aspect('equal'); c = np.array([-0.15, -0.05])
    th = np.linspace(-np.pi * 0.42, np.pi * 0.42, 400)
    for k in range(9):
        r = 0.16 + k * 0.11; a = 0.95 - k * 0.09
        _glow_line(ax, c[0] + r * np.cos(th), c[1] + r * np.sin(th), LBLUE if k % 3 else PALE, lw=1.8 - k * 0.1, glow=8)
        ax.lines[-1].set_alpha(a)
    for k in range(4):  # onde verso sinistra, più deboli
        r = 0.16 + k * 0.11; t2 = th + np.pi
        ax.plot(c[0] + r * np.cos(t2), c[1] + r * np.sin(t2), color=BLUE, lw=1.0, alpha=0.35 - k * 0.07)
    n = 900; ang = rng.normal(0, 0.45, n); rr = rng.gamma(2.2, 0.22, n) + 0.12
    P = c + np.c_[np.cos(ang), np.sin(ang)] * rr[:, None]
    far = np.clip(rr / 1.4, 0, 1); col = _mix(AMBER, LBLUE, far); col[:, 3] = 0.85 - 0.5 * far
    ax.scatter(P[:, 0], P[:, 1], s=2 + 10 * (1 - far), c=col, lw=0)
    if _glow():
        for sz, al in ((5000, 0.05), (1500, 0.1), (400, 0.3)): ax.scatter(*c, s=sz, color=AMBER, alpha=al, lw=0)
    ax.scatter(*c, s=120, color=AMBER, lw=0, zorder=6)
    _dust(ax, (-asp, asp), (-1, 1), 600)

DRAW = {
    'montecarlo': draw_montecarlo, 'hist': draw_hist, 'heatmap': draw_heatmap, 'equity_dd': draw_equity_dd,
    'surface': draw_surface, 'scatter': draw_scatter, 'candles': draw_candles, 'table': draw_table,
    'discr': draw_discr_vs_quant, 'winrate': draw_winrate_payoff, 'overfit': draw_overfit, 'overfit_bars': draw_overfit_bars,
    'corr': draw_corr_matrix, 'mc_expect': draw_mc_expect, 'walkforward': draw_walkforward, 'cloud3d': draw_cloud3d,
    'coverage': draw_coverage, 'costs': draw_costs, 'swap': draw_swap, 'sessions': draw_sessions, 'multiseries': draw_multiseries,
    'regression': draw_regression, 'tstat': draw_tstat, 'hypothesis': draw_hypothesis, 'cond_hist': draw_cond_hist,
    'random_vs_yours': draw_random_vs_yours, 'percentiles': draw_percentile_bands, 'table_heat': draw_table_heat,
    'pred_actual': draw_pred_actual, 'graph': draw_graph, 'is_oos': draw_is_oos,
    'breakout': draw_breakout, 'prop': draw_prop, 'cycle': draw_cycle,
    'brain': draw_brain, 'neuron_burst': draw_neuron_burst, 'synapse': draw_synapse,
    'eeg': draw_eeg, 'raster': draw_raster, 'spectrogram': draw_spectrogram, 'bandpower': draw_bandpower,
    'underwater': draw_underwater, 'bar3d': draw_bar3d, 'radar': draw_radar, 'contour': draw_contour, 'rings': draw_rings,
    'waterfall': draw_waterfall, 'violin': draw_violin, 'rmultiple': draw_rmultiple, 'hexbin': draw_hexbin, 'boxplot': draw_boxplot,
    'calendar': draw_calendar, 'ranges': draw_ranges, 'polyfit': draw_polyfit, 'weekhour': draw_weekhour, 'sensitivity': draw_sensitivity,
    'hour_dual': draw_hour_dual, 'volprofile': draw_volprofile, 'parallel': draw_parallel, 'forest': draw_forest, 'ecdf': draw_ecdf,
    'tree': draw_tree, 'odds': draw_odds, 'brain_top': draw_brain_top, 'brain_lines': draw_brain_lines, 'fmri': draw_fmri,
    'chord': draw_chord, 'tracto': draw_tracto, 'cleft': draw_cleft, 'action_potential': draw_action_potential, 'wave_rings': draw_wave_rings,
    'comfort': draw_comfort, 'habit': draw_habit, 'attractor': draw_attractor, 'calcium': draw_calcium, 'dendrite': draw_dendrite,
    'galaxy': draw_galaxy, 'hrv': draw_hrv, 'molecule': draw_molecule,
    'plateau_wire': draw_plateau_wire, 'stacked_area': draw_stacked_area, 'lollipop': draw_lollipop, 'kelly': draw_kelly,
    'rolling_sharpe': draw_rolling_sharpe, 'pairplot': draw_pairplot, 'ridgeline': draw_ridgeline, 'bubble': draw_bubble,
    'funnel': draw_funnel, 'bollinger': draw_bollinger, 'depth': draw_depth, 'treemap': draw_treemap,
    'brain_orb': draw_brain_orb, 'hypnogram': draw_hypnogram, 'yerkes': draw_yerkes, 'emotion_wheel': draw_emotion_wheel,
    'box_breath': draw_box_breath, 'iris': draw_iris, 'flow_channel': draw_flow_channel, 'focus_gauge': draw_focus_gauge,
    'broadcast': draw_broadcast,
}
FRAMELESS = {'surface', 'cloud3d', 'graph', 'brain', 'neuron_burst', 'synapse', 'bar3d', 'brain_top', 'brain_lines', 'chord', 'tracto',
             'cleft', 'wave_rings', 'comfort', 'habit', 'attractor', 'dendrite', 'galaxy', 'molecule', 'plateau_wire',
             'brain_orb', 'box_breath', 'iris', 'broadcast'}
MENTAL_SECONDARY = ['eeg', 'raster', 'spectrogram', 'bandpower', 'calcium', 'hrv', 'action_potential']
TRADING_SECONDARY = ['hist', 'equity_dd', 'heatmap', 'candles', 'montecarlo', 'percentiles', 'table', 'hexbin', 'rmultiple', 'violin', 'sensitivity', 'boxplot', 'hour_dual']
SECONDARY = ['hist', 'equity_dd', 'heatmap', 'candles', 'montecarlo', 'percentiles', 'table']

def render_cover(main, out, seed, secondaries=None, kw=None, pool=None):
    reseed(seed); draw_main = (lambda f: DRAW[main](f, **kw)) if kw else DRAW[main]
    sec = secondaries or list(rng.choice([s for s in (pool or SECONDARY) if s != main], 3, replace=False))
    W, H = 2250, 1500; c = new_canvas(W, H)
    panel(c, (-60, -60, 760, 560), dim(chart(800, 600, DRAW[sec[0]]), .5))
    panel(c, (-60, 600, 760, 1560), dim(chart(800, 940, DRAW[sec[1]]), .3))
    if main in FRAMELESS: c.alpha_composite(chart(1330, 1260, draw_main), (800, 90))
    else: panel(c, (820, 140, 2050, 1290), chart(1210, 1130, draw_main))
    panel(c, (2090, 200, 2400, 1150), dim(chart(290, 930, DRAW[sec[2]]), .5))
    img = photograph(c, (1536, 1024), sharp_center=(.64, .45), sharp_radius=(.4, .45), tilt=(.05, .025), dark_left_bottom=(.55, .5), vignette=.38, gain=1.15)
    img.save(out, quality=88)

def render_poster(main, out, seed, secondaries=None, kw=None):
    reseed(seed); draw_main = (lambda f: DRAW[main](f, **kw)) if kw else DRAW[main]
    sec = secondaries or list(rng.choice([s for s in SECONDARY if s != main], 4, replace=False))
    W, H = 1500, 2250; c = new_canvas(W, H)
    panel(c, (-40, -60, 700, 360), dim(chart(700, 400, DRAW[sec[0]]), .8))
    panel(c, (740, -60, 1560, 360), dim(chart(800, 400, DRAW[sec[1]]), .8))
    if main in FRAMELESS: c.alpha_composite(chart(1500, 1150, draw_main), (0, 330))
    else: panel(c, (60, 400, 1440, 1360), chart(1360, 940, draw_main))
    panel(c, (-40, 1440, 760, 2000), dim(chart(780, 540, DRAW[sec[2]]), .35))
    panel(c, (800, 1560, 1560, 2300), dim(chart(740, 720, DRAW[sec[3]]), .35))
    img = photograph(c, (1024, 1536), sharp_center=(.5, .41), sharp_radius=(.58, .29), dark_bottom=.6, gain=1.12)
    img.save(out, quality=88)

set_theme('dark')  # valori iniziali
