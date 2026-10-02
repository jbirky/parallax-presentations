# Interactive Equations

Explain an equation one piece at a time. Mark parts of it as terms, give each a color, a label and a short explanation, and when presenting each press of → colors the next term, dims the rest and labels it. Readers of a shared deck can point at a term to see what it means.

## Making one

1. Open the **Text** menu in the toolbar and click **Interactive Equation**.
2. Type the equation's LaTeX in **Equation** on the left. The symbol palette under it inserts symbols at the cursor. The right side draws the equation as the slide will.
3. Mark its terms (below), then click **Insert**.

To change it later, double-click the equation or select it and click **Edit Equation…** in the right panel.

## Marking terms

In **Select terms** mode, click part of the drawn equation to select it:

- Click a symbol to select it. Click again to select more around it: the numerator it's in, then the whole fraction, and so on.
- Drag from one symbol to another to select everything between them.
- `Shift`-click to extend the selection.
- Selecting text in the **Equation** box selects the same part of the drawing.

When the part you want is outlined, click **Make term** or press `Enter`. The term appears in the **Terms** list, where you give it:

- a **color**: click the dot for the palette, or **+** for any color
- a **label**, such as *Likelihood*
- an **explanation**, a short line shown with the label

The order of the list is the order the terms are stepped through; the arrows move a term earlier or later. The bin removes a term but keeps its math.

In the LaTeX, a term is written `\term{name}{…}`, so you can also type terms yourself:

```latex
\term{t1}{p(\theta \mid D)} = \frac{\term{t2}{p(D \mid \theta)}\,\term{t3}{p(\theta)}}{\term{t4}{p(D)}}
```

The same name can be used in more than one place, and those places are colored together. A term can also hold other terms.

## Labels

Choose how terms are labeled under **Labels**:

| Style | What it shows |
|-------|---------------|
| Callout (the default) | A tinted box around the term, with a line to a card holding its label and explanation |
| Brace | A brace under the term (over it, for a numerator) with its label and explanation |
| Sentence | A sentence under the equation whose phrases are in the colors of the terms they describe |

For **Sentence**, type the sentence, select some words in it, and click the term they describe under **Link the selected words to**. A linked phrase is written `[words](name)`.

A term in the top half of the equation, such as a numerator, is labeled above it, and the rest below. When every term is labeled at once, labels that would overlap move aside or onto another row. Labels can reach past the element's box, so leave room around it on the slide; the dashed line in the editor's preview is the box's edge, and **Box** under **Size** sets it.

## Presenting

Under **Presenting**, choose how terms are shown:

- **Color one term per step**: each press of → (or a clicker) colors the next term and labels it. ← steps back.
- **Color a term while the pointer is over it**: every term is colored, and pointing at one (or tapping it) labels it.
- **Both**: steps for your talk, and pointing for anyone reading the deck later.

Steps count with the slide's fragments. **First term at step** sets which step colors the first term: set it to 2 if one fragment should appear first. **Finish with a step that colors every term** adds a last step that labels them all, and **Keep earlier terms faintly colored** leaves the terms you've already been through tinted.

Click **Preview** in the editor to see each step as it will look.

On the canvas, the equation shows every term labeled, so you can see how much room the labels need. In a PDF, each step gets its own page, as fragments do.
