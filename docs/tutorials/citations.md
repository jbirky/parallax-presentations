# Citations & Bibliography

Parallax has a built-in citation manager that lets you import references from BibTeX files or your Zotero library, insert citation markers in text, auto-fill image citations, and generate a references slide at the end of your presentation.

## Opening the bibliography manager

Click the **Citations** button in the top toolbar to open the bibliography modal. You can also access it from **Settings > Manage Bibliography**.

The modal has three tabs:

- **Library** — view, reorder, and cite your imported references
- **Import BibTeX** — paste or upload a `.bib` file
- **Zotero** — connect to your Zotero library and import items

## Importing references

### From a BibTeX file

1. Open the bibliography modal and go to the **Import BibTeX** tab.
2. Either click **Upload .bib file** to select a file, or paste BibTeX entries directly into the text area.
3. Click **Import Entries**. Duplicate keys are skipped automatically.

Standard BibTeX entry types are supported: `@article`, `@inproceedings`, `@book`, `@incollection`, `@phdthesis`, `@techreport`, `@misc`, and more.

### From Zotero

1. Open the bibliography modal and go to the **Zotero** tab.
2. Enter your **numeric User ID** and **API Key**. You can find both at [zotero.org/settings/keys](https://www.zotero.org/settings/keys). The User ID is the number shown at the top of that page (not your username).
3. Click **Connect to Zotero**. Your collections and items will load.
4. Browse or search your library by title, author, or year. Use the collection dropdown to filter by folder.
5. Click **Import** next to individual items, or **Import all visible** to add everything on the current page.

::: tip
Zotero items that are already in your bibliography show an "Added" badge so you don't accidentally import duplicates.
:::

## Citation styles

Use the dropdown in the top-right corner of the bibliography modal to switch between two styles:

| Style | Example | Description |
|---|---|---|
| Numbered | [1], [2], [3] | Sequential numbers based on bibliography order |
| Author-Year | (Smith, 2020) | First author's last name and year |

## Inserting citations in text

1. Click into a **text element** on your slide so the cursor is active.
2. Open the bibliography modal (click **Citations** in the toolbar).
3. In the **Library** tab, click the **Cite** button next to the reference you want to insert.
4. A styled citation marker (e.g. `[1]` or `(Smith et al., 2020)`) is inserted at the cursor position.

::: warning
You must be actively editing a text element before opening the modal. If no text cursor is active, the Cite button has nowhere to insert the marker.
:::

## Image citations with autocomplete

When you select an image element, the right panel shows a **Citation** section with Text and Link fields. These fields integrate with your bibliography:

1. Select an image element on the canvas.
2. In the right panel, find the **Citation** section.
3. Start typing an author name, title, year, or BibTeX key in the **Text** field.
4. A dropdown appears showing matching bibliography entries. Click one to select it.
5. The text field auto-fills with the author and year (e.g. "Smith et al. (2020)"), and the link field auto-fills with the paper's DOI URL.
6. If no bibliography entry matches, you can type any text freely.

The citation display mode can be set to **Caption bar** (below the image) or **Side reference** (vertical text on the right edge of the slide).

## References slide

When your bibliography has at least one entry, a **References** slide is automatically generated at the end of your presentation. You don't need to create or maintain it manually.

The references slide includes:

- Numbered reference entries with author, year, title, journal/venue, volume, and pages
- Clickable DOI links where available
- Automatic two-column layout when there are more than 8 references

Only entries you actually cite are indexed. An entry sitting in the library
uncited gets no number and stays off the slide — the Library tab shows a dash
instead of a number for it, and the header counts how many of your entries are
cited.

It appears as the last slide everywhere the deck does — in the slide panel (marked
**REF**), on the editor canvas when you select it, in present mode, in an HTML
export, in a PDF export and through the server-side present/export endpoints. All
of them build it from the same place, so the editor shows what the export will
contain.

On the canvas it is marked **AUTO-GENERATED** and cannot be edited: change what it
says by editing your bibliography, not the slide. The one export that leaves it out
is PowerPoint, which has no way to carry a formatted, linked reference list.

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

::: tip
The order of references matches the order in your bibliography library. You can reorder entries using the arrow buttons in the Library tab.
:::

## Managing your bibliography

In the **Library** tab of the bibliography modal:

- **Reorder** entries using the up/down arrow buttons. This changes the numbering in the references slide.
- **Remove** an entry by clicking the X button.
- **Cite** an entry by clicking the Cite button (when a text element is being edited).

Changes are saved automatically with your presentation.
