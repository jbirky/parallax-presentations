# Periodic Table

Put an interactive periodic table on a slide. While you present, point at an element to see its details and electron structure in the space above the transition metals, and click it to keep it there while you talk about it. The data for all 118 elements is PubChem's.

## Adding one

Open the **Diagrams** menu in the toolbar and click **Periodic Table**. The whole table goes on the slide, as large as fits, in colors for the slide's background, showing iron in its card. Everything else is set in the right panel.

## When presenting

- **Point at a tile** to show that element in the card.
- **Click a tile** to pin it: the card keeps it while the pointer moves away. Click it again, or press **Esc**, to let go. On a touch screen, tap to pin.
- **Click a legend entry** to highlight that category, block or state, and again to stop.
- In the **Orbital clouds** view, click a subshell (**4s**, **3d**…) above the clouds to show its orbitals.
- **Tab** into the table to move between elements with the arrow keys and pin one with **Enter**. While a tile has focus, the arrow keys move within the table; press **Esc** to give them back to the slides. Clicking a tile doesn't take focus, so a clicker still changes slides.

On the canvas, the table does the same once it's selected, except that a click selects and moves it as usual. **Double-click a tile** to make it the element the card shows at rest.

## The card

The card shows the element's tile, its category, state at 298 K, block and year of discovery, its electron configuration, and its electronegativity, first ionization energy, electron affinity, van der Waals radius, oxidation states, melting and boiling points and density. Below or beside those is its electron structure, drawn one of three ways:

| Electrons as | What it shows |
|---|---|
| **Orbital boxes** | A box per orbital with an arrow per electron, filled by Hund's rule, and how many are unpaired. The noble-gas core is shown as **[Ar]** unless you tick **Show core electrons**. |
| **Bohr shells** | The electrons in each shell on rings, the outer shell in the accent color. When presenting, the rings turn slowly. |
| **Orbital clouds** | The shapes of a subshell's orbitals, colored by the sign of the wavefunction, with empty orbitals faint. These are hydrogen-like orbitals: their shapes and nodes are right, but their sizes aren't to scale. Which orbital holds a lone p or d electron is a convention. When presenting, they turn slowly. |

Each view is worked out from the element's configuration, so elements whose configurations break the usual filling order (chromium's 3d⁵ 4s¹, copper's 3d¹⁰ 4s¹, palladium's 4d¹⁰) are drawn as they are.

**Card shows at rest** is the element in the card until someone points at another, and in the PDF. Clear it to leave the card empty until then.

## Settings

| Setting | What it does |
|---|---|
| **Show** | The whole table; periods 1–4; the main groups (the s and p blocks, in 8 columns); periods 1–3 in 8 columns; or one element's card on its own. |
| **Card** | In the gap above the transition metals (the whole table and periods 1–4), beside the table, or none. |
| **Color by** | Category (as PubChem groups them), block, state at 298 K, or a heat map of a property: electronegativity, ionization energy, electron affinity, van der Waals radius, melting point, boiling point, density (on a log scale), atomic mass or year of discovery. Elements with no value for it are dashed. |
| **Tiles show** | Under each symbol: its name (in a heat map, its value), atomic mass, valence electrons, or nothing. |
| **Group 3** | Which elements go under scandium and yttrium: none, with 57–71 and 89–103 in the rows below (as in IUPAC's own table); lanthanum and actinium; or lutetium and lawrencium (IUPAC's 2021 recommendation). |
| **Colors** | For a dark slide or a light one. |
| **Highlight at rest** | Dims every element but some groups, periods, a block, a category, a state, or a list of elements (`C, N, O`). |
| **Trend arrows at rest** | Arrows along the top and side showing which way electronegativity, ionization energy, electron affinity, atomic radius or metallic character grows. |

Tick or untick the group and period numbers, the legend, and the **Data: PubChem** credit on the card. When a setting changes the table's shape, the element keeps its width and its height follows.

## Steps

Click **Add a Step** to have the table change as you step through the slide. Each step sets:

- **Highlight**: which elements stay bright, as above.
- **Pin**: an element for the card to show and hold, such as carbon, then nitrogen, then oxygen.
- **Trend arrows**.
- **Color by**: a different coloring, or the table's own (**As at rest**).

A step shows what it sets; anything it leaves out is off, apart from the coloring. **First step at slide step** places the steps among the slide's other animations, and stepping back undoes them. Each step, and each change of slide, lets go of an element pinned by a click. In a PDF, each step gets its own page.

## Printing and export

- **PDF**: the table as it rests and at each step, with the card for the element it shows and clouds held still.
- **Offline HTML**: works as presented, with no internet needed; the data is in the file.
- **PowerPoint (.pptx)**: the table as a picture, as it rests.

Clicks on the table pin elements, so it can't have a click action of its own. Another element's click or hover can still show or hide it.

## Where the data comes from

The table uses PubChem's periodic table, from its [PUG REST service](https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON), which brings together data from IUPAC's Commission on Isotopic Abundances and Atomic Weights, NIST, Los Alamos National Laboratory, Jefferson Lab and the IAEA's Atomic Mass Data Center, among others; each element's page on [PubChem](https://pubchem.ncbi.nlm.nih.gov/periodic-table/) lists its sources. Parallax keeps a copy, so presenting doesn't need PubChem, and makes a few corrections to it:

- Lawrencium's configuration is [Rn] 5f¹⁴ 7s² 7p¹. PubChem gives 6d¹ for the last electron, but calculations and its measured ionization energy point to 7p¹.
- Aluminum and calcium are given the years they were isolated, 1825 and 1808. PubChem lists both as known in ancient times.
- Elements 110–118 are shown as predicted to be solid (oganesson, a gas), never having been made in bulk.

The radii are van der Waals radii, which is what PubChem gives, so they're larger than the atomic radii in some textbooks. Values for the heaviest elements are often missing or predicted.

To credit the data on a slide of references, cite *National Center for Biotechnology Information. Periodic Table of Elements. PubChem*, with a link to [pubchem.ncbi.nlm.nih.gov/periodic-table](https://pubchem.ncbi.nlm.nih.gov/periodic-table/) and the date you used it.
