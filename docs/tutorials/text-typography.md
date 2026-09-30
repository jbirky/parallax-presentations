# Text & Typography

This tutorial covers the text tools: inserting text boxes, formatting, inline math, text paths, and 3D text.

## Inserting a text box

1. Click the **Text** button in the toolbar (or press `T`).
2. A text element appears on the slide. Double-click it to start typing.
3. Press `Escape` when you're done editing.

## Formatting text

With text selected inside a text box, use the toolbar to:

- **Bold** / **Italic** / **Underline** / **Strikethrough**
- **Font family** — choose from 30+ built-in fonts (Barlow, Inter, Playfair Display, Computer Modern, etc.)
- **Font size** — type a custom size or pick from the dropdown
- **Text color** — click the color swatch to open the picker
- **Alignment** — left, center, or right
- **Lists** — ordered or unordered

::: tip
You can mix fonts, sizes, and colors within the same text box by selecting individual words and applying different styles.
:::

## Inline math

You can insert LaTeX math expressions directly inside running text.

1. Double-click a text box to enter edit mode.
2. Type a LaTeX expression between dollar signs: `$E = mc^2$`
3. Press `Space` after the closing `$` — the expression renders inline.
4. To edit the math, click on the rendered expression. A math editor appears in the right panel.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/parallax-presentations/demos/inline-math.html" style="width:100%;height:140px;border:none"></iframe>
</div>

## Text on a path

Text Path lets you place text along a curved line.

1. Click the **Text Path** button in the toolbar (the curved-T icon).
2. A text path element appears with default text on a sine wave.
3. Double-click to edit the text content.
4. In the right panel, adjust the **path type** (wave, arc, circle) and **amplitude**.

## 3D text

3D Text puts text on a plane you can tilt in 3D, in perspective, like a
sign turned toward the audience. It can be flat, or extruded: copies of the
text stacked behind it, each a little further back and a little darker. It
stays real text, in any font the deck has, in one solid color, and looks
the same in the editor, when presenting, and in PDFs. Presented, it stays
exactly where you tilted it.

1. Open **Text** in the toolbar and choose **3D Text**. It starts flat and
   slightly tilted.
2. Type your text in **Text Content** in the right panel. Press Enter for a
   new line.
3. To tilt it, double-click it on the slide. Its outline turns cyan and a
   label shows its angles. Drag it: left and right turn it, up and down
   lean it back or toward you. Press Esc, or click elsewhere, when you're
   done. Outside this mode, dragging moves it as usual.
4. Or set the angle in the panel: **Front**, **Turn left**, **Turn right**
   and **Lean back** are starting points, and the **Turn** and **Lean**
   sliders set it exactly. **Perspective**: lower values look closer and
   more dramatic.
5. Choose **Flat** or **Extruded** under **Style**. Extruded text has a
   **Depth**, and **Sides** and **Side shading** for the color of its
   extrusion, which shows on whichever way it's turned away.
6. Set the font, size, weight, spacing and alignment below those. A
   **Drop Shadow** follows the letters, not the element's box.

Keep extruded text to headlines and short phrases. Every pixel of depth (up
to 60 of them) is another copy of the text, which adds up quickly on long
paragraphs.

In a PowerPoint export, 3D text becomes ordinary upright text. Extruded
text gets a hard shadow in the side color, pointing the way the extrusion
goes.
