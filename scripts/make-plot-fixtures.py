# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Jessica Birky

# Makes the matplotlib figures the plot import's tests read
# (client/src/utils/plotImport/), each as a PDF and an SVG with matplotlib's
# default settings, and writes the data each one plots to truth.json:
#
#   python3 scripts/make-plot-fixtures.py
#
# Needs matplotlib and numpy. The figures are committed, so the tests don't.

import json
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
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

with open(os.path.join(OUT, 'truth.json'), 'w') as f:
    json.dump(truth, f, indent=1)
print('wrote', ', '.join(k for k in truth if k != 'matplotlib'), 'with matplotlib', matplotlib.__version__)
