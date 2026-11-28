# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Jessica Birky

"""The app in a headless Chromium with no server, for capture.py.

The build (vite.capture.mjs: cloud mode, a signed-in Clerk stub) is served
from disk, and /api is answered here from decks kept in
memory, so the editor saves and reloads as it would. Live editing's
WebSocket is refused, and the editor falls back to saving after its wait
(EditorPage's LIVE_WAIT_MS).
"""

import contextlib
import json
import mimetypes
import re
import uuid
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright

# The hosted site's address, so links in the shots read as they will. Every
# request to it is answered here (routed); none reaches the site.
ORIGIN = 'https://parallax-presentations.com'
NOW = '2026-11-27T12:00:00Z'

ME = {
    'id': 'user_tutorial', 'plan': 'free', 'planName': 'Free', 'presentationCount': 1, 'storageUsed': 12_000_000,
    'limits': {'maxPresentations': 5, 'storageBytes': 250_000_000, 'maxFileBytes': 50_000_000},
    'billing': False, 'isAdmin': False, 'survey': {'pending': False},
}


def tile(deck):
    """A dashboard card's fields (server/storage/deck-tile.js)."""
    slides = deck.get('slides') or []
    first = dict(slides[0]) if slides else None
    if first:
        for k in ('background', 'notes', 'outlineNotes'):
            first.pop(k, None)
    return {
        'id': deck['id'], 'title': deck.get('title', 'Untitled'), 'theme': deck.get('theme'),
        'transition': deck.get('transition'), 'slideCount': len(slides),
        'updatedAt': deck.get('updatedAt', NOW), 'createdAt': deck.get('createdAt', NOW),
        'thumbnail': slides[0].get('background') if slides else None, 'firstSlide': first,
        'themeColors': deck.get('themeColors'), 'textStyles': deck.get('textStyles'), 'globalFont': deck.get('globalFont'),
        'slideWidth': deck.get('slideWidth'), 'slideHeight': deck.get('slideHeight'), 'folderId': None,
    }


class Harness:
    def __init__(self, build_dir):
        self.build = build_dir
        self.decks = {}
        # Answers for paths this file doesn't know: {path: body} or {path: fn(method, body)}
        self.extra = {}
        self.calls = []

    def api(self, method, path, body):
        if path in self.extra:
            v = self.extra[path]
            return v(method, body) if callable(v) else v
        if path == '/api/presentations':
            if method == 'GET':
                return [tile(d) for d in self.decks.values()]
            deck = {'slides': [], **(body or {}), 'id': str(uuid.uuid4())}
            self.decks[deck['id']] = deck
            return deck
        m = re.match(r'^/api/presentations/([^/]+)$', path)
        if m and m.group(1) in self.decks:
            deck = self.decks[m.group(1)]
            if method in ('PUT', 'PATCH'):
                deck.update(body or {})
                deck['updatedAt'] = datetime.now(timezone.utc).isoformat()
            return {**deck, 'version': 1}
        if path == '/api/me':
            return ME
        if path == '/api/teams':
            return {'teams': []}
        if path == '/api/folders':
            return {'folders': []}
        if re.match(r'^/api/presentations/[^/]+/collaborators$', path):
            return {'role': 'owner', 'you': ME['id'], 'people': [], 'inviteToken': None, 'teamId': None,
                    'teamRole': None, 'locked': False, 'lockedMessage': None}
        if re.match(r'^/api/presentations/[^/]+/share$', path):
            return {'shared': method == 'POST', 'token': '7c1e2b40-5d3a-4f1e-9b62-0a8f3c51d2e7' if method == 'POST' else None}
        if path == '/api/github/config':
            return {'owner': '', 'repo': '', 'hasToken': False, 'pagesUrl': ''}
        if path == '/api/plans':
            return {'plans': []}
        return [] if method == 'GET' else {}

    def _route(self, route):
        req = route.request
        path = req.url[len(ORIGIN):].split('?')[0].split('#')[0]
        if path.startswith('/api/'):
            try:
                body = req.post_data_json
            except Exception:
                body = None
            self.calls.append((req.method, path))
            return route.fulfill(status=200, content_type='application/json', body=json.dumps(self.api(req.method, path, body)))
        f = self.build / path.lstrip('/')
        if not f.is_file():
            f = self.build / 'index.html'
        return route.fulfill(status=200, body=f.read_bytes(),
                             content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')

    @contextlib.contextmanager
    def run(self, width=1440, height=900, scale=2, storage=None):
        """A page at ORIGIN; storage: localStorage entries to set first."""
        with sync_playwright() as p:
            browser = p.chromium.launch(args=['--no-sandbox'])
            ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=scale,
                                      color_scheme='light', reduced_motion='reduce')
            ctx.route(f'{ORIGIN}/**', self._route)
            # A clock that runs as usual from a fixed afternoon, so dates and
            # times in the shots stay put, until a tutorial skips it ahead
            # (clock.fast_forward), as through a practice run's minutes
            ctx.clock.install(time=datetime(2026, 11, 20, 15, 10))
            if storage:
                ctx.add_init_script('(e => { try { for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v) } catch {} })('
                                    + json.dumps(storage) + ')')
            page = ctx.new_page()
            page.set_default_timeout(8000)
            page.on('pageerror', lambda e: print('  page error:', str(e)[:300]))
            try:
                yield page
            finally:
                browser.close()

    def open_editor(self, page, deck_id):
        """Opens a deck in the editor and waits out the live connection."""
        title = self.decks[deck_id].get('title', 'Untitled')
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-') or 'untitled'
        page.goto(f'{ORIGIN}/dashboard/{slug}')
        page.get_by_role('button', name='Present', exact=True).first.wait_for(timeout=30000)
        page.wait_for_timeout(800)
