# Graphs

Graph functions, curves, points and shaded regions on a slide, typed the way you would in Desmos. Sliders change the graph live, and while presenting you and your audience can drag it around, zoom, and read values off a curve.

## Making a graph

1. Click **Graph** in the toolbar.
2. Type expressions in the list on the left, one per line. The preview on the right shows the graph as the slide will.
3. Click **Insert**.

To change it later, double-click the graph or select it and click **Edit Graph…** in the right panel.

In the expression list, **Enter** adds a line, **Backspace** on an empty line removes it, and the arrow keys move between lines. **Add an example…** at the bottom inserts one of each kind of expression.

## What you can type

| Type | Example |
| --- | --- |
| Function | `y = x^2 - 2`, or just `x^2 - 2` |
| Sideways function | `x = sin y` |
| Equation | `x^2 + y^2 = 9` |
| Shaded region | `y < 2x + 1`, `x^2 + y^2 <= 4`, `-1 < y < x` |
| Parametric curve | `(3cos t, 2sin t)` |
| Polar curve | `r = 2 + 2cos θ` |
| Point | `(2, 3)` |
| Piecewise | `y = {x < 0: -x, x^2}` |
| Restricted domain | `y = √x {0 < x < 4}` |
| Your own function | `f(x) = e^(-x^2)`, then `y = f(x - 1)` |
| Slider | `a = 2` |

Multiplication doesn't need a sign: `2x`, `3(x + 1)`, `ab`. Functions work with or without parentheses: `sin 2x`, `sin^2 x`, `sin^-1 x`. You can use `π` or `pi`, `θ` or `theta`, `e`, `√` or `sqrt`, `|x|` for absolute value, and subscripts like `a_1`.

Functions: `sin`, `cos`, `tan`, `sec`, `csc`, `cot`, `arcsin`, `arccos`, `arctan`, `sinh`, `cosh`, `tanh`, `sqrt`, `cbrt`, `exp`, `ln`, `log` (base 10), `abs`, `floor`, `ceil`, `round`, `sign`, `min`, `max`, `mod`.

::: tip
A power covers only what comes right after `^`, so `e^2x` is e² · x. For a longer exponent use parentheses or braces: `e^(2x)` or `e^{2x}`.
:::

## Sliders

Any letter that isn't `x`, `y`, `t`, `θ` or `r` is a slider. When you use one that doesn't exist yet, the line offers **add slider**. A slider line like `a = 2` shows its range below it. Under its options (the sliders icon) you can set its step and speed, and make it **play when the slide opens**.

The sliders appear on the slide, bottom left, where the ▶ button plays them. Hide a slider (the eye) to keep it off the slide. Turn off **Sliders on the slide** to hide them all.

A point made of sliders, like `(p, q)`, can be dragged while presenting, and its sliders follow.

## Step by step

Under a line's options, **Appears** sets the step it's added at. The graph then builds up as you advance, one step at a time, alongside the slide's other animations.

## Styling

- **Color**: click the dot beside a line.
- **Line**: solid, dashed or dotted, and its thickness (in the line's options). A strict inequality (`<`, `>`) always has a dashed edge.
- **Points**: a label, or their coordinates.
- **Colors for a light or dark slide**: sets the grid, axes and numbers to suit the slide.
- **Background**: see-through by default, so the slide shows behind the graph.

## The view

Set the range of **x** under the preview, or drag the preview to move around and scroll to zoom. What the preview shows is what the slide starts with. With **Equal scales**, one unit is the same length on both axes and the height follows the width. **Reset** goes back to −10 ≤ x ≤ 10.

You can also turn the grid, axes, numbers and sliders on or off, and label the axes.

## Presenting

- Drag to move around, scroll or pinch to zoom, and double-click to zoom in.
- Hover over a curve to read its value.
- The ⟲ button goes back to the starting view.

Turn on **Lock panning and zooming** to keep the view fixed. Sliders and draggable points still work.

In a PDF, graphs are drawn finished: every step shown, sliders at their saved values.
