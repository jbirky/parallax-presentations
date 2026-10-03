# Citations & Bibliography

Parallax has a built-in citation manager that lets you import references from BibTeX files or your Zotero library, insert citation markers in text, auto-fill image and molecule citations, and generate a references slide at the end of your presentation.

## Opening the bibliography manager

Click the **Citations** button in the top toolbar to open the bibliography modal. You can also access it from **Settings > Manage Bibliography**.

The modal has three tabs:

- **Library** — search, view, reorder, and cite your imported references
- **Import BibTeX** — paste or upload a `.bib` file
- **Zotero** — connect to your Zotero library and import items

## Importing references

### From a BibTeX file

1. Open the bibliography modal and go to the **Import BibTeX** tab.
2. Either click **Upload .bib file** to select a file, or paste BibTeX entries directly into the text area.
3. Click **Import Entries**. Papers already in your library are skipped, and the Library tab lists what was skipped (see [Duplicates](#duplicates)).

Standard BibTeX entry types are supported: `@article`, `@inproceedings`, `@book`, `@incollection`, `@phdthesis`, `@techreport`, `@misc`, and more.

### From Zotero

1. Open the bibliography modal and go to the **Zotero** tab.
2. Enter your **numeric User ID** and **API Key**. You can find both at [zotero.org/settings/keys](https://www.zotero.org/settings/keys). The User ID is the number shown at the top of that page (not your username).
3. Click **Connect to Zotero**. Your collections and items will load.
4. Browse or search your library by title, author, or year. Use the collection dropdown to filter by folder.
5. Click **Import** next to individual items, or **Import all visible** to add everything on the current page.

::: tip
Zotero items that are already in your bibliography show an "Added" badge so you don't accidentally import duplicates. An item shows "In library" when the same paper came in another way, such as from a .bib file under a different key; hover over it to see which entry it matches.
:::

### Duplicates

A paper imported twice, say once from a .bib file and once from Zotero, would be listed twice on the references slide, since the two copies have different citation keys. So Parallax compares papers, not just keys: two entries are the same paper if they have the same DOI, or, when either has no DOI, the same title and year. Case, braces, punctuation and accents in titles don't matter. Two entries with different DOIs are always kept apart, so a preprint and its published version can both be listed.

Importing skips any entry that is already in the library this way. Copies already in a library are marked in the Library tab, with **duplicate of** and the key of the first copy. Remove the copy your slides don't cite, the one showing a dash instead of a number; if both are cited, remove the marked one and cite the other in its place.

## Citation styles

Choose between two styles in the **Settings** tab of the bibliography modal:

| Style | Example | Description |
|---|---|---|
| Numbered | [1], [2], [3] | Numbers from the citation index (see [Settings](#settings)) |
| Author-Year | (Smith, 2020) | First author's last name and year |

## Inserting citations in text

1. Click into a **text element** on your slide so the cursor is active.
2. Open the bibliography modal (click **Citations** in the toolbar).
3. In the **Library** tab, click the **Cite** button next to the reference you want to insert.
4. A styled citation marker (e.g. `[1]` or `(Smith et al., 2020)`) is inserted at the cursor position. It is one piece, like an equation: it moves and deletes as a whole, and it remembers which entry it cites.

::: warning
You must be actively editing a text element before opening the modal. If no text cursor is active, the Cite button has nowhere to insert the marker.
:::

## Image and molecule citations

When you select an image or a molecule, the right panel shows a **Citation** section with Text and Link fields. These fields integrate with your bibliography:

1. Select an image or a molecule on the canvas.
2. In the right panel, find the **Citation** section.
3. Start typing an author name, title, year, or BibTeX key in the **Text** field.
4. A dropdown appears showing matching bibliography entries. Click one to select it.
5. The text field auto-fills with the author and year (e.g. "Smith et al. (2020)"), and the link field auto-fills with the paper's DOI URL.
6. If no bibliography entry matches, you can type any text freely.

A caption made from an entry cites that entry even after you edit its text. Under the fields, **Cites …** names it; click **×** there to stop citing it. Clearing the Text field forgets it too.

A molecule from PubChem can fetch its citation instead: see [Citing PubChem](/tutorials/molecules#citing-pubchem).

The citation display mode can be set to **Caption bar** (below the image) or **Side reference** (vertical text on the right edge of the slide).

## References slide

When your slides cite at least one entry, a **References** slide is automatically generated at the end of your presentation. You don't need to create or maintain it manually.

The references slide includes:

- Numbered reference entries with author, year, title, journal/venue, volume, and pages
- Clickable DOI links where available, and otherwise a link to the entry's URL, named by its site (for a PubChem record, `pubchem.ncbi.nlm.nih.gov`)
- Automatic two-column layout when there are more than 8 references

Only entries you actually cite are indexed. An entry sitting in the library
uncited gets no number and stays off the slide — the Library tab shows a dash
instead of a number for it, and the header counts how many of your entries are
cited.

It appears as the last slide everywhere the deck does: in present mode, share links
and the live viewer, an HTML export and a PDF export. In the editor it is last in
the slide panel, marked **REF**; select it to see a preview, marked
**Auto-generated**. It can't be edited: change what it says by editing your
bibliography, not the slide. The one export that leaves it out is PowerPoint,
which has no way to carry a formatted, linked reference list.

## Settings

The **Settings** tab of the bibliography modal holds the two choices that decide
how citations are numbered.

**Citation style** — `[1]`-style numbers, or `(Author, Year)`.

**Index order** — how the numbers are handed out:

| Order | Numbering |
|-------|-----------|
| Presentation order | As citations first appear: slide by slide, and top to bottom, left to right within a slide |
| Alphabetical order | By first author's surname, then year, then title |

Below the two settings, the tab lists the index itself — every cited entry with
the number it currently carries — so you can see the effect of a change at once.

The order the entries sit in in the **Library** tab no longer affects numbering;
it is just how your library is organised.

### How markers stay in step

A citation marker inserted with **Cite** remembers *which* entry it points at, not
just the number it showed at the time. Change the style or the order and every
marker follows, on the canvas and in every export.

Markers written before this — and any `[1]` you typed by hand — carry only a
number. The Settings tab notices them and offers **Link and renumber markers**,
which attaches each one to the entry its number pointed at in the library and
brings it into the index.

## Managing your bibliography

In the **Library** tab of the bibliography modal:

- **Search** with the box above the list: it matches title, authors, year, journal and citation key, and every word you type must appear somewhere in the entry, in any order (`brown 2016` finds Brown et al. 2016). Accents don't matter, so `schrodinger` finds Schrödinger. Press Esc to clear it. The arrows are off while searching, since an entry's neighbours may be hidden.
- **Reorder** entries using the up/down arrow buttons. This orders the library itself; numbering follows the index order set in **Settings**.
- **Remove** an entry by clicking the X button. If your slides cite it, it leaves the index and the references slide, and its markers keep the label they last showed, so cite another entry in their place. The number beside each entry shows whether it is cited: a dash means it isn't.
- **Cite** an entry by clicking the Cite button (when a text element is being edited).

Changes are saved automatically with your presentation.
