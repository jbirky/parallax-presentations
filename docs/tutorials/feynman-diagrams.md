# Feynman Diagrams

Draw Feynman diagrams from vertices and propagator lines, build them up one line at a time while you present, and copy the same diagram into a paper as TikZ-Feynman code.

## Making one

1. Open the **Diagrams** menu in the toolbar and click **Feynman Diagram**.
2. The editor opens with e⁺e⁻ → μ⁺μ⁻ drawn. Change it, pick another process from **Start from…**, or choose **Blank**.
3. Click **Insert**.

To change it later, double-click the diagram or select it and click **Edit Diagram…** in the right panel.

## Drawing

The left column has the line styles. Pick one (or press its key) and drag between two points on the canvas:

| Style | Key | Usually |
|---|---|---|
| Fermion | `F` | e, μ, q, t |
| Antifermion | `A` | e⁺, antiquarks |
| Photon | `P` | γ, Z, W |
| Charged boson | | W⁺, W⁻ |
| Gluon | `G` | g |
| Scalar | `S` | H, φ, π⁰ |
| Charged scalar | | H⁺, π⁺, K⁺ |
| Ghost | | Faddeev–Popov ghosts |
| Graviton | | gravitons |
| Plain | | any line, or a Majorana line |
| Double | | heavy quarks, composite states |

- New ends snap to a grid of quarter centimetres. Hold `Alt` to draw off the grid.
- Ending a drag on a vertex joins the line to it.
- Dragging out of the middle of a line splits the line there. That's how you attach a photon to an electron line.
- A second line between the same two vertices bends away from the first, so a loop is two drags.
- Clicking a line while a style is chosen changes it to that style.

With **Select** (`V`):

- Drag a vertex to move it. Drop it on another vertex to merge the two.
- Drag a line to move it with its ends.
- A selected line has a round handle at its middle. Drag it to bend the line into an arc; it snaps straight and to a semicircle. On a loop, the handle turns and sizes the loop.
- `Delete` removes what's selected. `Ctrl+Z` and `Ctrl+Shift+Z` undo and redo.

**Mirror** flips the diagram left to right, which reverses time. **Rotate** turns it a quarter, from an s-channel picture to a t-channel one. **Fit** fits the view to the diagram.

## Lines and vertices

Select a line to change its style, reverse it (which flips its arrow), straighten it, give it a label and a momentum arrow, color it, or choose the step it appears at. Labels are TeX, like `e^-`, `\gamma` or `\bar{\nu}_e`, and the chips under each field fill in the usual ones.

Select a vertex to give it a style (a dot, a blob for a loop or effective vertex, a crossed dot for a counterterm, an empty dot or a square), a label and its position, or to add a loop from it back to itself. **Auto** draws a dot where three or more lines meet and nothing elsewhere.

With nothing selected, the right panel checks the diagram: it circles any vertex where fermion arrows don't flow through, with as many arrows in as out. That usually means a line is reversed. An effective vertex can be left as it is.

## Building it up when presenting

Each line has the step it appears at. **From the start** lines show when the slide opens; a line at step 1 is drawn in at the first press of →, and so on. A vertex comes with its first line, unless you give it a step of its own.

- **Number by time** gives the lines steps from left to right.
- Each step can have a caption, shown under the diagram from that step until the next caption.
- **First step at slide step** lines the diagram's steps up with the slide's other fragments. With 2, the diagram's first step comes at the slide's second.
- **Fade earlier steps** dims what's already drawn, so the new lines stand out.
- **Preview build** in the editor steps through the diagram as the slide will.

The canvas always shows the whole diagram with its last caption. A printed PDF has a page for each step.

## TikZ-Feynman

**Copy TikZ-Feynman** (in the editor and in the right panel) copies the diagram as TikZ-Feynman code, with every vertex at its position, so it compiles with pdfLaTeX and needs no LuaLaTeX layout:

```latex
\usepackage{tikz-feynman}
...
\begin{tikzpicture}
  \begin{feynman}
    \vertex (i1) at (0, 2) {\(e^-\)};
    \vertex[dot] (a) at (1.5, 1) {};
    ...
    \diagram* {
      (i1) -- [fermion] (a),
      (a) -- [photon, edge label=\(\gamma\), momentum'=\(q\)] (b),
      ...
    };
  \end{feynman}
\end{tikzpicture}
```

Bent lines are circular arcs in Parallax. TikZ draws `bend left` as a curve that's close to an arc but not the same, so a bent line other than a semicircle can come out slightly differently in LaTeX.

PowerPoint export draws the diagram as an image, with its labels as plain text rather than KaTeX.
