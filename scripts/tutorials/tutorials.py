# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Jessica Birky

"""Each tutorial's steps, done in the editor, with the shots it shows.

A function per tutorial takes a capture.Shooter (s.page, s.h, s.shot) and
names its shots and pins as client/src/tutorials/catalog.js does.
"""

import re

from harness import ORIGIN

TALK = 'Dark matter in ten minutes'


# ── The editor, as a person uses it ───────────────────────────────────────

def new_deck(page, title, theme=None, create=True):
    page.goto(f'{ORIGIN}/dashboard')
    page.get_by_role('button', name='New Presentation').last.click()
    page.get_by_placeholder('My Presentation').fill(title)
    if theme:
        page.get_by_text(theme, exact=True).click()
    if create:
        page.get_by_role('button', name='Create').click()
        wait_editor(page)


def wait_editor(page):
    page.get_by_role('button', name='Present', exact=True).first.wait_for(timeout=30000)
    page.wait_for_timeout(1000)


def layouts_button(page):
    """The ▾ beside the toolbar's New slide."""
    return page.locator('button[aria-label="New slide from a layout"]:not(.add-slide-btn)').first


def open_layouts(page):
    layouts_button(page).click()
    page.get_by_text('Title and Content', exact=True).first.wait_for()
    page.wait_for_timeout(300)


def add_layout(page, name):
    open_layouts(page)
    page.get_by_text(name, exact=True).first.click()
    page.wait_for_timeout(600)


def fill(page, placeholder, *lines, leave=True):
    """Types into a layout's placeholder, a line at a time."""
    page.get_by_text(placeholder).first.dblclick()
    page.wait_for_timeout(200)
    for i, line in enumerate(lines):
        if i:
            page.keyboard.press('Enter')
        page.keyboard.type(line, delay=4)
    if leave:
        done(page)


def done(page):
    page.keyboard.press('Escape')
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)


def on_slide(page, text):
    """Text on the slide being edited, not its thumbnail."""
    return page.locator('.slide-canvas').get_by_text(text, exact=False).first


def go_slide(page, n):
    """Shows slide n (from 1), from the Slides panel."""
    page.locator('.slide-list .slide-item').nth(n - 1).click()
    page.wait_for_timeout(400)


def menu(page, top, item):
    page.get_by_role('menubar').get_by_text(top, exact=True).click()
    page.wait_for_timeout(200)
    page.get_by_role('menu').get_by_text(item, exact=False).first.click()
    page.wait_for_timeout(300)


# ── Your first talk ────────────────────────────────────────────────────────

def first_talk(s):
    page = s.page

    # Start a presentation, with a title and a theme
    new_deck(page, TALK, theme='Kourou', create=False)
    dialog = [page.get_by_role('heading', name='New Presentation'), page.get_by_role('button', name='Create')]
    s.shot('new-deck', clip=dialog, pad=26, pins=[
        ('title', page.get_by_placeholder('My Presentation')),
        ('theme', page.get_by_text('Kourou', exact=True).locator('xpath=..')),
        ('create', page.get_by_role('button', name='Create')),
    ])
    page.get_by_role('button', name='Create').click()
    wait_editor(page)

    # Slides from layouts
    add_layout(page, 'Title Slide')
    fill(page, 'Click to add title', TALK)
    fill(page, 'Click to add subtitle', 'Journal club · November 2026')
    open_layouts(page)
    s.shot('layouts', clip=[layouts_button(page), page.get_by_text('Typographic systems', exact=True),
                            page.get_by_text('Big Number', exact=True)], pad=24, pins=[
        ('arrow', layouts_button(page)),
        ('title-content', page.get_by_text('Title and Content', exact=True).first.locator('xpath=..')),
        ('typographic', page.get_by_text('Typographic systems', exact=True)),
    ])
    page.get_by_text('Title and Content', exact=True).first.click()
    page.wait_for_timeout(600)

    # Typing into placeholders, with math from the text toolbar
    fill(page, 'Click to add title', 'Galaxies spin too fast')
    fill(page, 'Click to add text', 'Outer stars orbit as fast as inner ones', 'Visible mass predicts ', leave=False)
    page.once('dialog', lambda d: d.accept('v(r) = \\sqrt{G\\,M(r)/r}'))
    sigma = page.get_by_title('Insert inline math ($…$)')
    sigma.click()
    page.keyboard.type(', which falls with radius', delay=4)
    page.wait_for_timeout(300)
    box = page.locator('.ProseMirror').first
    s.shot('type', clip=(200, 46, 1000, 724), pins=[
        ('box', box),
        ('sigma', sigma),
        ('math', page.locator('.ProseMirror .math-node').first),
    ])
    done(page)

    # More slides, for the outline
    for title in ('Two clues, forty years apart', 'How much of the matter is dark?', 'Lensing sees it too', 'Questions'):
        add_layout(page, 'Title and Content')
        fill(page, 'Click to add title', title)

    # The outline: sections, minutes and notes
    page.get_by_role('tab', name='Outline').click()
    page.wait_for_timeout(600)
    for n, minutes in enumerate([1, 2, 2.5, 2, 2, 0.5], start=1):
        page.get_by_label(f'Minutes for slide {n}').fill(str(minutes))
    length = page.get_by_label('Talk length in minutes')
    length.fill('10')
    notes = page.locator('[data-ph="Add a note"]')
    # Last first, as a filled note's blank line goes from the list
    for i, text in [(3, 'Planck: about 84% of matter is dark'), (2, 'Zwicky, 1933: Coma’s galaxies'), (0, 'Open on the puzzle')]:
        notes.nth(i).click()
        page.keyboard.type(text, delay=4)
    page.locator('body').click(position={'x': 700, 'y': 880})
    page.wait_for_timeout(400)
    panel = page.get_by_role('list', name='Outline')
    s.shot('outline', clip=(0, 46, 600, 520), pins=[
        ('tab', page.get_by_role('tab', name='Outline')),
        ('length', length),
        ('minutes', page.get_by_label('Minutes for slide 3')),
        ('note', page.get_by_text('Zwicky, 1933: Coma’s galaxies')),
    ])

    # The theme, any time
    page.get_by_role('tab', name='Slides').click()
    page.wait_for_timeout(300)
    go_slide(page, 2)
    page.get_by_role('button', name='Theme', exact=True).first.click()
    page.wait_for_timeout(900)
    s.shot('theme', clip=(200, 46, 1240, 854), pins=[
        ('button', page.get_by_role('button', name='Theme', exact=True).first),
        ('custom', page.get_by_text('Customize colors')),
        ('mine', page.get_by_text('My themes', exact=False).first),
    ])
    page.get_by_role('button', name='Theme', exact=True).first.click()
    page.wait_for_timeout(400)

    # Speaker notes, and the ways to present
    go_slide(page, 1)
    page.locator('.notes-strip-empty').click()
    page.keyboard.type('Start with the puzzle. Ask who has seen a rotation curve.', delay=4)
    page.wait_for_timeout(300)
    page.get_by_title('Present options').click()
    page.wait_for_timeout(400)
    s.shot('present', pins=[
        ('notes', page.get_by_text('Start with the puzzle.').first),
        ('presenter', page.get_by_text('Presenter Mode', exact=True)),
        ('practice', page.get_by_text('Practice Talk', exact=True)),
        ('live', page.get_by_text('Live Present', exact=True)),
    ])
    with page.expect_popup() as popped:
        page.get_by_text('Presenter Mode', exact=True).click()
    win = popped.value
    win.wait_for_load_state()
    win.wait_for_timeout(2500)
    s.page = win
    s.shot('speaker-view', pins=[
        ('notes', [win.get_by_text(re.compile(r'^speaker notes$', re.I)), win.get_by_text('Start with the puzzle.', exact=False).first]),
        ('timer', win.get_by_text('Next →').locator('xpath=..')),
        ('upcoming', win.get_by_text(re.compile(r'^upcoming slides$', re.I))),
    ])
    s.page = page
    win.close()


# ── Cite your sources ──────────────────────────────────────────────────────

BIBTEX = r"""@article{rubin1970,
  author = {Rubin, Vera C. and Ford, W. Kent, Jr.},
  title = {Rotation of the Andromeda Nebula from a Spectroscopic Survey of Emission Regions},
  journal = {The Astrophysical Journal},
  year = {1970}, volume = {159}, pages = {379},
  doi = {10.1086/150317}
}
@article{zwicky1933,
  author = {Zwicky, Fritz},
  title = {Die Rotverschiebung von extragalaktischen Nebeln},
  journal = {Helvetica Physica Acta},
  year = {1933}, volume = {6}, pages = {110--127}
}
@article{planck2020,
  author = {{Planck Collaboration}},
  title = {Planck 2018 results. VI. Cosmological parameters},
  journal = {Astronomy \& Astrophysics},
  year = {2020}, volume = {641}, pages = {A6},
  doi = {10.1051/0004-6361/201833910}
}"""


def bibliography(page):
    menu(page, 'Tools', 'Citations and bibliography')
    page.get_by_role('button', name='Library', exact=True).wait_for()
    page.wait_for_timeout(400)


def close_bibliography(page):
    # The header's ×, not an entry's (which removes it)
    page.get_by_text('Bibliography', exact=True).locator('xpath=..').get_by_role('button').last.click()
    page.wait_for_timeout(300)


def modal_of(page, title):
    """The dialog holding a title, as a box: the child of its fixed overlay."""
    b = page.get_by_text(title, exact=True).first.evaluate("""el => {
      while (el.parentElement && getComputedStyle(el.parentElement).position !== 'fixed') el = el.parentElement
      const r = el.getBoundingClientRect()
      return [r.x, r.y, r.width, r.height]
    }""")
    return tuple(b)


def citations(s):
    page = s.page
    new_deck(page, TALK, theme='Kourou')
    add_layout(page, 'Title and Content')
    fill(page, 'Click to add title', 'Galaxies spin too fast')

    # Import a .bib, pasted
    bibliography(page)
    page.get_by_role('button', name='Import BibTeX', exact=True).click()
    page.wait_for_timeout(300)
    area = page.locator('textarea').first
    area.fill(BIBTEX)
    area.evaluate('el => { el.scrollTop = 0; el.setSelectionRange(0, 0) }')
    page.wait_for_timeout(300)
    dialog = modal_of(page, 'Bibliography')
    s.shot('import', clip=dialog, pad=0, pins=[
        ('tab', page.get_by_role('button', name='Import BibTeX', exact=True)),
        ('paste', area),
        ('import', page.get_by_role('button', name='Import Entries')),
        ('zotero', page.get_by_role('button', name='Zotero', exact=True)),
    ])
    page.get_by_role('button', name='Import Entries').click()
    page.wait_for_timeout(600)
    close_bibliography(page)


    # Cite at the cursor: with the cursor in the text, cite from the library
    fill(page, 'Click to add text', 'Outer stars orbit as fast as inner ones', 'Clusters hold more mass than we see', leave=False)
    bibliography(page)
    cites = page.get_by_role('button', name='Cite', exact=True)
    s.shot('library', clip=modal_of(page, 'Bibliography'), pins=[
        ('entry', page.get_by_text('Zwicky, 1933', exact=False).first),
        ('cite', cites.nth(1)),
        ('count', page.get_by_text('cited', exact=False).first),
    ])
    cites.nth(1).click()
    page.wait_for_timeout(400)
    close_bibliography(page)
    # Then the end of the first line
    on_slide(page, 'Outer stars orbit').dblclick()
    page.keyboard.press('Control+Home')
    page.keyboard.press('End')
    bibliography(page)
    page.get_by_role('button', name='Cite', exact=True).first.click()
    page.wait_for_timeout(400)
    close_bibliography(page)
    done(page)
    page.locator('body').click(position={'x': 700, 'y': 820})
    page.wait_for_timeout(500)
    markers = page.locator('.slide-canvas [data-cite]')
    s.shot('marker', clip=(200, 46, 1000, 724), pins=[
        ('marker', [markers.first, markers.last]),
    ])

    # The references slide, made for you
    ref = page.locator('.slide-thumbnail').filter(has_text='REF').first
    ref.click()
    page.wait_for_timeout(900)
    preview = page.get_by_text('Auto-generated', exact=True).locator('xpath=..')
    s.shot('references', clip=(0, 46, 1200, 724), pins=[
        ('thumb', ref),
        ('slide', preview),
        ('auto', page.get_by_text('Auto-generated', exact=True)),
    ])

    # Numbered or author and year
    bibliography(page)
    page.get_by_role('button', name='Settings', exact=True).last.click()
    page.wait_for_timeout(400)
    style = page.locator('select').filter(has=page.locator('option', has_text='Author')).first
    s.shot('style', clip=modal_of(page, 'Bibliography'), pins=[
        ('style', style),
        ('order', [page.get_by_text('Presentation order', exact=True), page.get_by_text('Alphabetical order', exact=True)]),
    ])



# ── Rehearse, present and share ────────────────────────────────────────────

SLIDES = [
    ('Title Slide', TALK, 'Journal club · November 2026', 1),
    ('Title and Content', 'Galaxies spin too fast', 'Outer stars orbit as fast as inner ones', 2),
    ('Title and Content', 'Two clues, forty years apart', 'Zwicky, 1933: the Coma cluster', 2.5),
    ('Title and Content', 'How much of the matter is dark?', 'About 84%, from the cosmic microwave background', 2),
    ('Title and Content', 'Lensing sees it too', 'Mass bends light whether it shines or not', 2),
    ('Title and Content', 'Questions', 'Thank you', 0.5),
]


def build_talk(page):
    """The sample talk: six slides with their minutes, and notes on the first."""
    new_deck(page, TALK, theme='Kourou')
    for layout, title, body, _ in SLIDES:
        add_layout(page, layout)
        fill(page, 'Click to add title', title)
        fill(page, 'Click to add subtitle' if layout == 'Title Slide' else 'Click to add text', body)
    page.get_by_role('tab', name='Outline').click()
    page.wait_for_timeout(400)
    for n, (*_, minutes) in enumerate(SLIDES, start=1):
        page.get_by_label(f'Minutes for slide {n}').fill(str(minutes))
    page.get_by_label('Talk length in minutes').fill('10')
    page.get_by_role('tab', name='Slides').click()
    page.wait_for_timeout(300)
    go_slide(page, 1)
    page.locator('.notes-strip-empty').click()
    page.keyboard.type('Start with the puzzle. Ask who has seen a rotation curve.', delay=4)
    page.locator('body').click(position={'x': 700, 'y': 160})
    page.wait_for_timeout(600)


def present_menu(page):
    page.get_by_title('Present options').click()
    page.wait_for_timeout(400)


def present_share(s):
    page = s.page
    # A repository already set up, as Sync › GitHub… keeps it
    s.h.extra['/api/github/config'] = {'owner': 'you', 'repo': 'talks', 'hasToken': True, 'pagesUrl': 'https://you.github.io/talks'}
    build_talk(page)

    # Practice Talk: a timed rehearsal in its own window
    present_menu(page)
    with page.expect_popup() as popped:
        page.get_by_text('Practice Talk', exact=True).click()
    win = popped.value
    win.wait_for_load_state()
    win.wait_for_timeout(2500)
    hud = next(f for f in win.frames if f.get_by_role('button', name='Finish').count())

    def spend(seconds, then_next=True):
        win.clock.fast_forward(seconds * 1000)
        win.wait_for_timeout(400)
        if then_next:
            win.keyboard.press('ArrowRight')
            win.wait_for_timeout(700)

    # A minute or two on each slide, a little over on some
    for seconds in (65, 140, 130):
        spend(seconds)
    spend(70, then_next=False)
    s.page = win
    s.shot('practice', pins=[
        ('slide', hud.get_by_text('Slide 4', exact=False).first.locator('xpath=..')),
        ('talk', hud.get_by_text('Talk', exact=True).first.locator('xpath=..')),
        ('finish', hud.get_by_role('button', name='Finish')),
    ])
    spend(80)
    spend(115)
    spend(45, then_next=False)
    hud.get_by_role('button', name='Finish').click()
    win.wait_for_timeout(1200)
    s.page = page
    win.close()
    page.wait_for_timeout(800)

    # The runs, kept with the talk
    menu(page, 'Tools', 'Practice runs')
    dialog = page.get_by_role('dialog', name='Practice runs')
    dialog.wait_for()
    s.shot('runs', clip=dialog, pins=[
        ('table', dialog.locator('table').first),
        ('use', dialog.get_by_role('button').filter(has_text='plan').first),
    ])
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    if dialog.count() and dialog.is_visible():
        dialog.get_by_role('button').first.click()

    # A link anyone can open
    page.get_by_role('button', name='Share', exact=True).click()
    page.wait_for_timeout(300)
    page.get_by_text('Share link…', exact=True).click()
    page.wait_for_timeout(400)
    page.get_by_role('button', name='Enable Sharing').click()
    page.wait_for_timeout(500)
    s.shot('share', clip=modal_of(page, 'Share Presentation'), pad=0, pins=[
        ('link', page.locator('input[readonly]').first),
        ('stop', page.get_by_role('button', name='Disable Sharing')),
    ])
    page.keyboard.press('Escape')
    modal_close = page.get_by_text('Share Presentation', exact=True).locator('xpath=..').get_by_role('button')
    if modal_close.count():
        modal_close.first.click()
    page.wait_for_timeout(300)

    # Files to send, and the talk on GitHub
    page.get_by_role('menubar').get_by_text('File', exact=True).click()
    page.wait_for_timeout(200)
    page.get_by_role('menu').get_by_text('Export', exact=True).hover()
    page.wait_for_timeout(400)
    menus = page.get_by_role('menu')
    s.shot('export', clip=[page.get_by_role('menubar').get_by_text('File', exact=True), menus.last], pad=14, pins=[
        ('export', page.get_by_role('menu').get_by_text('Export', exact=True)),
        ('formats', [menus.last.get_by_text('PDF', exact=True), menus.last.get_by_text('Offline HTML', exact=True)]),
    ])
    page.keyboard.press('Escape')


    # Every push a commit, and a site on GitHub Pages
    page.get_by_role('button', name='Sync', exact=True).click()
    page.wait_for_timeout(300)
    page.get_by_text('GitHub…', exact=True).click()
    page.wait_for_timeout(500)
    message = page.get_by_placeholder(TALK, exact=False)
    message.fill('Add the lensing slide')
    push = page.get_by_role('button', name='Push to GitHub')
    s.shot('github', clip=modal_of(page, 'Save to GitHub'), pins=[
        ('repo', [page.get_by_placeholder('username or org'), page.get_by_placeholder('my-presentations')]),
        ('message', message),
        ('push', push),
    ])

TUTORIALS = {
    'first-talk': first_talk,
    'citations': citations,
    'present-share': present_share,
}
