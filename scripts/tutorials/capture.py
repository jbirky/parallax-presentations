# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Jessica Birky

"""Screenshots for the landing page's Tutorials tab.

Builds the app as the hosted site has it (vite.capture.mjs), opens it in a
headless Chromium with /api answered in memory (harness.py), and does each
tutorial's steps in the real editor, taking a screenshot where the tutorial
shows one. Writes:

  client/public/tutorials/<tutorial>/<shot>.webp
  client/src/tutorials/shots.json   size and pins of each shot

A pin is a box on a shot, in percent of its width and height, that the
tutorial numbers and explains (client/src/tutorials/catalog.js names them).

  python3 scripts/tutorials/capture.py              every tutorial
  python3 scripts/tutorials/capture.py first-talk   one of them
  python3 scripts/tutorials/capture.py --build-dir <dir> --skip-build

Needs Python Playwright with its Chromium, and Pillow with WebP.
"""

import argparse
import io
import json
import os
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image

from harness import Harness, ORIGIN
import tutorials

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / 'client' / 'public' / 'tutorials'
MANIFEST = ROOT / 'client' / 'src' / 'tutorials' / 'shots.json'

WIDTH, HEIGHT, SCALE = 1440, 900, 2


def build(out_dir):
    env = {**os.environ, 'VITE_PARALLAX_MODE': 'cloud', 'VITE_CLERK_PUBLISHABLE_KEY': 'pk_capture'}
    subprocess.run(['node', '../node_modules/vite/bin/vite.js', 'build', '-c', str(HERE / 'vite.capture.mjs'),
                    '--outDir', str(out_dir), '--emptyOutDir', '--logLevel', 'warn'],
                   cwd=ROOT / 'client', env=env, check=True)


def box_of(page, target):
    """A target's box in CSS pixels: a locator, a list of them, or (x, y, w, h)."""
    if isinstance(target, (tuple, list)) and len(target) == 4 and all(isinstance(v, (int, float)) for v in target):
        return tuple(target)
    targets = target if isinstance(target, list) else [target]
    boxes = []
    for t in targets:
        if not t.is_visible():
            raise RuntimeError(f'not on screen: {t}')
        b = t.bounding_box()
        if not b:
            raise RuntimeError(f'nothing to measure: {t}')
        boxes.append((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']))
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    return (x0, y0, x1 - x0, y1 - y0)


class Shooter:
    def __init__(self, harness, page, tutorial, manifest):
        self.h = harness
        self.page = page
        self.tutorial = tutorial
        self.manifest = manifest

    def shot(self, name, clip=None, pins=(), pad=0, min_width=0):
        """Saves the page (or the box round clip, padded) as <tutorial>/<name>.webp, with pins: [(id, target)]."""
        page = self.page
        page.wait_for_timeout(250)
        # The editor's save status settles first
        saving = page.get_by_text('Saving...', exact=True)
        if saving.count():
            saving.first.wait_for(state='hidden', timeout=5000)
        vw, vh = page.viewport_size['width'], page.viewport_size['height']
        if clip is None:
            x, y, w, h = 0, 0, vw, vh
        else:
            x, y, w, h = box_of(page, clip)
            x, y, w, h = x - pad, y - pad, w + 2 * pad, h + 2 * pad
            if w < min_width:
                x, w = x - (min_width - w) / 2, min_width
            x, y = max(0, x), max(0, y)
            w, h = min(w, vw - x), min(h, vh - y)
        x, y, w, h = round(x), round(y), round(w), round(h)
        png = page.screenshot(clip={'x': x, 'y': y, 'width': w, 'height': h}, animations='disabled', caret='hide')
        out = OUT / self.tutorial / f'{name}.webp'
        out.parent.mkdir(parents=True, exist_ok=True)
        Image.open(io.BytesIO(png)).convert('RGB').save(out, 'WEBP', quality=86, method=6)
        placed = {}
        for pin_id, target in pins:
            px, py, pw, ph = box_of(page, target)
            placed[pin_id] = [round((px - x) / w * 100, 2), round((py - y) / h * 100, 2),
                              round(pw / w * 100, 2), round(ph / h * 100, 2)]
        self.manifest[f'{self.tutorial}/{name}'] = {'w': w, 'h': h, 'pins': placed}
        print(f'  {self.tutorial}/{name}  {w}x{h}  {out.stat().st_size // 1024} KB  pins: {", ".join(placed) or "none"}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('only', nargs='*', help='tutorials to capture (default: all)')
    ap.add_argument('--build-dir', help='where the capture build goes (default: a temporary folder)')
    ap.add_argument('--skip-build', action='store_true', help='use the build already in --build-dir')
    args = ap.parse_args()

    names = args.only or list(tutorials.TUTORIALS)
    unknown = [n for n in names if n not in tutorials.TUTORIALS]
    if unknown:
        sys.exit(f'unknown tutorial: {", ".join(unknown)} (have {", ".join(tutorials.TUTORIALS)})')

    build_dir = pathlib.Path(args.build_dir or tempfile.mkdtemp(prefix='parallax-capture-'))
    if not args.skip_build:
        print(f'building into {build_dir}')
        build(build_dir)

    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    for name in names:
        print(name)
        # The shots this run takes replace the tutorial's old ones
        manifest = {k: v for k, v in manifest.items() if not k.startswith(f'{name}/')}
        for old in (OUT / name).glob('*.webp') if (OUT / name).exists() else []:
            old.unlink()
        harness = Harness(build_dir)
        storage = {'parallax-getting-started': json.dumps({'dismissed': True}), 'parallax-deck-count': '4'}
        with harness.run(WIDTH, HEIGHT, SCALE, storage=storage) as page:
            tutorials.TUTORIALS[name](Shooter(harness, page, name, manifest))
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    # A line a shot, so a recapture's diff shows which moved
    lines = [f' {json.dumps(k)}: {json.dumps(v)}' for k, v in sorted(manifest.items())]
    MANIFEST.write_text('{\n' + ',\n'.join(lines) + '\n}\n')
    print(f'wrote {MANIFEST.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
