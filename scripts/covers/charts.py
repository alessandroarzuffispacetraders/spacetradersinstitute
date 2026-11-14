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
    ax = fig.add_axes([0.14, 0.12, 0.72, 0.82]); style(ax); n = 8
    A = rng.normal(0, 1, (n, n)); C = np.corrcoef(A @ A.T + rng.normal(0, 2, (n, n)))
    im = ax.imshow(C, cmap=SQ, vmin=-1, vmax=1, alpha=0.82)
    for i in range(n):
        for j in range(n):
            ax.text(j, i, f'{C[i, j]:.2f}', ha='center', va='center', fontsize=8, color=CELL_A if abs(C[i, j]) > .5 else CELL_B)
    names = ['EU', 'GU', 'UJ', 'XAU', 'NAS', 'SPX', 'DAX', 'WTI']
    ax.set_xticks(range(n)); ax.set_xticklabels(names); ax.set_yticks(range(n)); ax.set_yticklabels(names); ax.grid(False)
    cb = fig.colorbar(im, cax=fig.add_axes([0.89, 0.12, 0.025, 0.82])); cb.outline.set_color(SPINE); cb.ax.tick_params(colors=TICK, labelsize=8)

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
    ax = fig.add_axes([0.13, 0.08, 0.84, 0.86]); style(ax)
    rows = ['P10', 'P25', 'P50', 'P75', 'P90', 'P95']; cols = ['MAE', 'MFE', 'MFE/MAE', 'Stop', 'Target', 'Win %']
    V = rng.uniform(0, 1, (len(rows), len(cols)))
    ax.imshow(V, cmap=SQ, aspect='auto', alpha=0.75)
    for i in range(len(rows)):
        for j in range(len(cols)):
            ax.text(j, i, f'{rng.uniform(5, 95):.1f}', ha='center', va='center', fontsize=11, color='#0b0f18')
    ax.set_xticks(range(len(cols))); ax.set_xticklabels(cols); ax.set_yticks(range(len(rows))); ax.set_yticklabels(rows); ax.grid(False)

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

DRAW = {
    'montecarlo': draw_montecarlo, 'hist': draw_hist, 'heatmap': draw_heatmap, 'equity_dd': draw_equity_dd,
    'surface': draw_surface, 'scatter': draw_scatter, 'candles': draw_candles, 'table': draw_table,
    'discr': draw_discr_vs_quant, 'winrate': draw_winrate_payoff, 'overfit': draw_overfit, 'overfit_bars': draw_overfit_bars,
    'corr': draw_corr_matrix, 'mc_expect': draw_mc_expect, 'walkforward': draw_walkforward, 'cloud3d': draw_cloud3d,
    'coverage': draw_coverage, 'costs': draw_costs, 'swap': draw_swap, 'sessions': draw_sessions, 'multiseries': draw_multiseries,
    'regression': draw_regression, 'tstat': draw_tstat, 'hypothesis': draw_hypothesis, 'cond_hist': draw_cond_hist,
    'random_vs_yours': draw_random_vs_yours, 'percentiles': draw_percentile_bands, 'table_heat': draw_table_heat,
    'pred_actual': draw_pred_actual, 'graph': draw_graph, 'is_oos': draw_is_oos,
}
FRAMELESS = {'surface', 'cloud3d', 'graph'}
SECONDARY = ['hist', 'equity_dd', 'heatmap', 'candles', 'montecarlo', 'percentiles', 'table']

def render_cover(main, out, seed, secondaries=None):
    reseed(seed)
    sec = secondaries or list(rng.choice([s for s in SECONDARY if s != main], 3, replace=False))
    W, H = 2250, 1500; c = new_canvas(W, H)
    panel(c, (-60, -60, 760, 560), dim(chart(800, 600, DRAW[sec[0]]), .5))
    panel(c, (-60, 600, 760, 1560), dim(chart(800, 940, DRAW[sec[1]]), .3))
    if main in FRAMELESS: c.alpha_composite(chart(1330, 1260, DRAW[main]), (800, 90))
    else: panel(c, (820, 140, 2050, 1290), chart(1210, 1130, DRAW[main]))
    panel(c, (2090, 200, 2400, 1150), dim(chart(290, 930, DRAW[sec[2]]), .5))
    img = photograph(c, (1536, 1024), sharp_center=(.64, .45), sharp_radius=(.4, .45), tilt=(.05, .025), dark_left_bottom=(.55, .5), vignette=.38, gain=1.15)
    img.save(out, quality=88)

def render_poster(main, out, seed, secondaries=None):
    reseed(seed)
    sec = secondaries or list(rng.choice([s for s in SECONDARY if s != main], 4, replace=False))
    W, H = 1500, 2250; c = new_canvas(W, H)
    panel(c, (-40, -60, 700, 360), dim(chart(700, 400, DRAW[sec[0]]), .8))
    panel(c, (740, -60, 1560, 360), dim(chart(800, 400, DRAW[sec[1]]), .8))
    if main in FRAMELESS: c.alpha_composite(chart(1500, 1150, DRAW[main]), (0, 330))
    else: panel(c, (60, 400, 1440, 1360), chart(1360, 940, DRAW[main]))
    panel(c, (-40, 1440, 760, 2000), dim(chart(780, 540, DRAW[sec[2]]), .35))
    panel(c, (800, 1560, 1560, 2300), dim(chart(740, 720, DRAW[sec[3]]), .35))
    img = photograph(c, (1024, 1536), sharp_center=(.5, .41), sharp_radius=(.58, .29), dark_bottom=.6, gain=1.12)
    img.save(out, quality=88)

set_theme('dark')  # valori iniziali
