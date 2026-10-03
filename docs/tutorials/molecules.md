# Molecules

Put a 3D molecule or protein on a slide, from PubChem, the Protein Data Bank or a structure file of your own. You can turn and zoom it on the canvas, and you and your audience can turn it while you present. Molecules are drawn with [3Dmol.js](https://3dmol.org).

## Adding one

1. Open the **Diagrams** menu in the toolbar and click **Molecule**.
2. Choose where the structure comes from:
   - **PubChem**: type a compound's name or CID (`caffeine`, `aspirin`, `2519`). You get the 3D shape PubChem computed for it.
   - **Protein Data Bank**: type a PDB ID (`1UBQ`, `4HHB`). Entries too large for PDB format come as mmCIF.
   - **File**: upload a PDB, mmCIF, SDF, MOL, MOL2, XYZ, PQR or GRO file, up to 50 MB.
3. Click **Add**.

The structure is saved with the presentation, like an uploaded image, so presenting doesn't need PubChem, the PDB or the internet.

To use a different structure later, select the molecule and click **Change Molecule…** in the right panel. It keeps your style settings.

## Turning it

Once a molecule is selected on the canvas, and whenever it's presented:

- Drag to turn it.
- Scroll to zoom.
- Ctrl-drag (or middle-drag) to move it.

To move the element itself on the canvas, click away from it first, then drag it.

## Starting view

A molecule starts out framed to fit. To have it start from another angle, turn it on the canvas and click **Keep This View** in the right panel. **Reset View** goes back to framed to fit.

## Style

| Setting | What it does |
|---|---|
| **Style** | **Auto** draws proteins and nucleic acids as cartoons and anything else as ball and stick. You can also pick Cartoon, Ball and stick, Sticks, Space-filling or Wireframe. In a cartoon, ligands and ions are drawn as ball and stick with green carbons, and water is left out. |
| **Color** | **Auto** colors a cartoon as a rainbow from the N terminus to the C terminus, and atoms by element. You can also color by element, by chain, as a rainbow, or by secondary structure. |
| **Background** | Transparent by default, so the slide shows behind it. Untick **Transparent** to give it a color of its own. |
| **Show hydrogens** | Draws hydrogen atoms if the file has them. |
| **Show surface** | Adds a translucent molecular surface. Large proteins take a few seconds to compute one. |
| **Rotate on its own** | Spins it slowly while it's shown. Taking hold of it stops the spin. |

## Citing PubChem

For a compound from PubChem, click **Cite PubChem** in the right panel's **Citation** section. Parallax fetches the compound's record from PubChem and:

- adds PubChem's citation for it to your library, as its **Cite** button gives it: *National Center for Biotechnology Information (2026). PubChem Compound Summary for CID 2519, Caffeine.*, linked to the record, and
- credits it under the molecule as **PubChem CID 2519**, linked to the compound's 3D conformer, which is how PubChem asks for a reused 3D structure to be credited.

The caption cites the library entry, so the record is listed on the [references slide](/tutorials/citations#references-slide). Citing the same compound again uses the entry already there. You can change the caption's text, color and placement like an image's ([Image citations](/tutorials/citations#image-and-molecule-citations)).

## Printing and export

- **PDF**: draws the molecule as it starts, held still.
- **Offline HTML**: includes the structure itself, but loads 3Dmol.js from the internet, as 3D models load their viewer.
- **PowerPoint (.pptx)**: leaves molecules out, like other embeds.

Clicks on a molecule turn it, so it can't have a click action of its own. Another element's click or hover can still show or hide it.

## Chemical equations

To write a reaction in a text box or a LaTeX block, use `\ce{…}`. See [Chemical equations](/tutorials/using-latex#chemical-equations).
