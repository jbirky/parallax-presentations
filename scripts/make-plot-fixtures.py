# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Jessica Birky

# Makes the matplotlib figures the plot import's tests read
# (client/src/utils/plotImport/), each as a PDF and an SVG with matplotlib's
# default settings, and writes the data each one plots to truth.json:
#
#   python3 scripts/make-plot-fixtures.py
#
# Needs matplotlib, numpy and seaborn (and LaTeX for usetex.pdf). The figures
# are committed, so the tests don't.

import json
import os
import shutil
import numpy as np
import matplotlib
matplotlib.use('Agg')
# The same SVG ids each run, so the figures only change when they do
matplotlib.rcParams['svg.hashsalt'] = 'parallax-plot-fixtures'
import matplotlib.pyplot as plt

OUT = os.path.join(os.path.dirname(__file__), '..', 'client', 'src', 'utils', 'plotImport', 'fixtures')
rng = np.random.default_rng(7)
truth = {'matplotlib': matplotlib.__version__}
r = lambda a: [round(float(v), 12) for v in a]


def save(fig, ax, name, layers, legend=None):
    for ext in ('pdf', 'svg'):
        fig.savefig(os.path.join(OUT, f'{name}.{ext}'), metadata={'Date': None} if ext == 'svg' else {'CreationDate': None})
    truth[name] = {
        'layers': layers, 'legend': legend or [],
        'xlim': r(ax.get_xlim()), 'ylim': r(ax.get_ylim()),
        'xscale': ax.get_xscale(), 'yscale': ax.get_yscale(),
        'xlabel': ax.get_xlabel(), 'ylabel': ax.get_ylabel(),
    }
    plt.close(fig)


# Measurements with capped error bars, a model curve, a legend, axis labels
fig, ax = plt.subplots(figsize=(6, 4))
x = np.linspace(0.5, 9.5, 19)
y = 2.0 * np.exp(-x / 3) + rng.normal(0, 0.05, x.size)
e = 0.04 + 0.03 * rng.random(x.size)
ax.errorbar(x, y, yerr=e, fmt='o', capsize=3, label='measured')
xm = np.linspace(0, 10, 200)
ax.plot(xm, 2.0 * np.exp(-xm / 3), '-', label='model')
ax.set_xlabel('time (s)')
ax.set_ylabel('signal (V)')
ax.legend()
save(fig, ax, 'decay', {
    'measured': {'kind': 'points', 'x': r(x), 'y': r(y), 'yErr': r(e)},
    'model': {'kind': 'line', 'x': r(xm), 'y': r(2.0 * np.exp(-xm / 3))},
}, ['measured', 'model'])

# Two scatter series on log axes
fig, ax = plt.subplots(figsize=(6, 4))
xa = 10 ** rng.uniform(0, 3, 30)
ya = 3 * xa ** 1.5 * 10 ** rng.normal(0, 0.1, 30)
xb = 10 ** rng.uniform(0, 3, 25)
yb = 30 * xb ** 0.8 * 10 ** rng.normal(0, 0.1, 25)
ax.scatter(xa, ya, s=12, label='stars')
ax.scatter(xb, yb, s=12, marker='s', label='clusters')
ax.set_xscale('log')
ax.set_yscale('log')
ax.set_xlabel('mass')
ax.legend()
save(fig, ax, 'loglog', {
    'stars': {'kind': 'points', 'x': r(xa), 'y': r(ya)},
    'clusters': {'kind': 'points', 'x': r(xb), 'y': r(yb)},
}, ['stars', 'clusters'])

# Bars
fig, ax = plt.subplots(figsize=(6, 4))
cats = np.arange(6)
h = np.array([3.2, 5.1, 2.7, 6.4, 4.0, 1.9])
ax.bar(cats, h, width=0.6, color='#2ca02c')
ax.set_ylabel('count')
save(fig, ax, 'bars', {'bars': {'kind': 'bars', 'x': r(cats - 0.3), 'x2': r(cats + 0.3), 'y': r(h)}})

# Negative values (Type 3 text drops the minus signs), a dashed line, a grid
fig, ax = plt.subplots(figsize=(6, 4))
xs = np.linspace(-3, 3, 13)
ys = np.sin(xs) * 1.5
ax.plot(xs, ys, 'o', color='#9467bd', label='samples')
xl = np.linspace(-3, 3, 61)
ax.plot(xl, np.sin(xl) * 1.5, '--', color='#d62728', label='sine')
ax.grid(True)
save(fig, ax, 'negative', {
    'samples': {'kind': 'points', 'x': r(xs), 'y': r(ys)},
    'sine': {'kind': 'line', 'x': r(xl), 'y': r(np.sin(xl) * 1.5)},
}, [])

# Styles and setups that move or leave out the ticks a scale is read from:
# nine points each, named 'data' in a legend, beside a flat 'mean' line
from matplotlib.ticker import FuncFormatter
import seaborn as sns
xv = np.linspace(1, 9, 9)
yv = 3 + np.sin(xv) + rng.normal(0, 0.1, xv.size)


def setup(name, style='default', yv=yv, yscale=None, after=None, rc=None):
    with plt.style.context(style), matplotlib.rc_context(rc or {}):
        fig, ax = plt.subplots(figsize=(5, 3.5))
        ax.plot(xv, yv, 'o', label='data')
        if yscale:
            ax.set_yscale(yscale)
        else:
            ax.plot(xv, yv * 0 + float(np.mean(yv)), '-', label='mean')
        ax.legend()
        if after:
            after(fig, ax)
        save(fig, ax, name, {'data': {'kind': 'points', 'x': r(xv), 'y': r(yv)}}, ['data'])


setup('seaborn-white', 'seaborn-v0_8-white')          # no tick marks, no grid, Liberation Sans
setup('seaborn-darkgrid', 'seaborn-v0_8-darkgrid')    # no tick marks, a grid
setup('frameless-legend', 'seaborn-v0_8-ticks')       # a legend without a frame
setup('classic', 'classic')                           # ticks inward on every side, a point under the legend
setup('tick-right', after=lambda f, a: a.yaxis.tick_right())
setup('ticks-in', after=lambda f, a: a.tick_params(direction='in'))
setup('despine-offset', after=lambda f, a: sns.despine(ax=a, offset=10, trim=True))
setup('commas', yv=yv * 1000, after=lambda f, a: a.yaxis.set_major_formatter(FuncFormatter(lambda v, p: f'{v:,.0f}')))
setup('log-short', yv=2 + 6 * np.linspace(0, 1, 9) ** 2, yscale='log')  # labeled minor ticks only
setup('twinx', after=lambda f, a: a.twinx().plot(xv, xv ** 2, 'r-'))
if shutil.which('latex'):
    setup('usetex', rc={'text.usetex': True})          # LaTeX's glyphs, one by one

# Figures of several panels, kept as they are a panel at a time; the truth
# is the panel a graph is made of: the largest whose numbers read (the first,
# of ones the same size)
fig, (a, b) = plt.subplots(1, 2, figsize=(8, 3.5))
xp = np.linspace(0.5, 9.5, 12)
yp = 2 * np.exp(-xp / 3) + rng.normal(0, 0.05, xp.size)
a.errorbar(xp, yp, yerr=0.05, fmt='o', capsize=3, label='measured')
xq = np.linspace(0, 10, 100)
a.plot(xq, 2 * np.exp(-xq / 3), label='model')
a.set_title('(a) decay')
a.set_xlabel('time (s)')
a.legend()
xs2 = 10 ** rng.uniform(0, 2, 20)
b.loglog(xs2, xs2 ** 1.5, 's', label='stars')
b.loglog(xs2, 2 * xs2, '^', label='gas')
b.set_title('(b) scaling')
b.legend()
fig.suptitle('Two panels')
fig.tight_layout()
save(fig, a, 'pair', {
    'measured': {'kind': 'points', 'x': r(xp), 'y': r(yp), 'yErr': r(np.full(xp.size, 0.05))},
    'model': {'kind': 'line', 'x': r(xq), 'y': r(2 * np.exp(-xq / 3))},
}, ['measured', 'model'])

# Four panels sharing their axes (the top and right ones have no numbers of
# their own), and a legend for the figure
fig, axs = plt.subplots(2, 2, figsize=(7, 5), sharex=True, sharey=True)
tg = np.linspace(0, 6, 60)
noise = rng.normal(0, 0.1, (4, 10))
for i, ax in enumerate(axs.flat):
    ax.plot(tg, np.sin(tg + i), label='signal')
    ax.plot(tg[::6], np.sin(tg[::6] + i) + noise[i], 'o', label='samples')
fig.legend(*axs[0, 0].get_legend_handles_labels(), loc='upper center', ncol=2)
save(fig, axs[1, 0], 'grid', {
    'samples': {'kind': 'points', 'x': r(tg[::6]), 'y': r(np.sin(tg[::6] + 2) + noise[2])},
    'signal': {'kind': 'line', 'x': r(tg), 'y': r(np.sin(tg + 2))},
})

# An inset in a panel
fig, ax = plt.subplots(figsize=(6, 4))
ax.plot(tg, np.exp(-tg), label='decay')
ax.legend(loc='lower left')
ins = ax.inset_axes([0.55, 0.5, 0.4, 0.4])
ins.semilogy(tg, np.exp(-tg), 'r-')
save(fig, ax, 'inset', {'decay': {'kind': 'line', 'x': r(tg), 'y': r(np.exp(-tg))}}, ['decay'])

with open(os.path.join(OUT, 'truth.json'), 'w') as f:
    json.dump(truth, f, indent=1)
print('wrote', ', '.join(k for k in truth if k != 'matplotlib'), 'with matplotlib', matplotlib.__version__)
