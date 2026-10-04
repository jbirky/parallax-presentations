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
| Vector field | `F(x, y) = (-y, x)` |
| System of equations | `x' = y` and `y' = -sin x` |
| Slope field | `dy/dx = x - y` |
| Surface (in 3D) | `z = sin x cos y` |

Vector fields, systems and slope fields have their own section below, and so do 3D graphs.

Multiplication doesn't need a sign: `2x`, `3(x + 1)`, `ab`. Functions work with or without parentheses: `sin 2x`, `sin^2 x`, `sin^-1 x`. You can use `π` or `pi`, `θ` or `theta`, `e`, `√` or `sqrt`, `|x|` for absolute value, and subscripts like `a_1`.

Functions: `sin`, `cos`, `tan`, `sec`, `csc`, `cot`, `arcsin`, `arccos`, `arctan`, `sinh`, `cosh`, `tanh`, `sqrt`, `cbrt`, `exp`, `ln`, `log` (base 10), `abs`, `floor`, `ceil`, `round`, `sign`, `min`, `max`, `mod`.

::: tip
A power covers only what comes right after `^`, so `e^2x` is e² · x. For a longer exponent use parentheses or braces: `e^(2x)` or `e^{2x}`.
:::

## Sliders

Any letter that isn't `x`, `y`, `t`, `θ` or `r` is a slider, and so are Greek letters such as `α`, `λ` and `μ`. When you use one that doesn't exist yet, the line offers **add slider**. A slider line like `a = 2` shows its range below it. Under its options (the sliders icon) you can set its step and speed, and make it **play when the slide opens**.

The sliders appear on the slide, bottom left, where the ▶ button plays them. Hide a slider (the eye) to keep it off the slide. Turn off **Sliders on the slide** to hide them all.

A point made of sliders, like `(p, q)`, can be dragged while presenting, and its sliders follow.

## Step by step

Under a line's options, **Appears** sets the step it's added at. The graph then builds up as you advance, one step at a time, alongside the slide's other animations.

## Vector fields and phase portraits

A graph can draw vector fields, systems of differential equations and slope fields, with the paths that follow them.

| Type | Example |
| --- | --- |
| Vector field | `F(x, y) = (-y, x)`, or just `(-y, x)` when it uses both x and y |
| Gradient | `f(x, y) = x^2 - y^2`, then `∇f` (or `grad f`) |
| System | `x' = y` on one line and `y' = -sin x - c y` on another; or `dx/dt = …`; or `(x', y') = (y, -sin x)` on one line |
| System in polar coordinates | `r' = μr - r^3` and `θ' = 1` |
| Slope field | `dy/dx = x - y`, or `y' = x - y` with no `x'` line |
| Solution of a slope field | `y(0) = 1`, through (0, 1) |
| Path along a field or system | `(x, y)(0) = (1, 0)`, from (1, 0) |

A path follows the field or system above it in the list, or the first one below if there's none above. Its starting point can be sliders, like `(x, y)(0) = (p, q)`; then it can be dragged, as a point made of sliders can. A field can be restricted as a curve can: `F(x, y) = (1, 0) {x^2 + y^2 > 1}` is the field outside the unit circle.

A field's own sliders work as elsewhere, so dragging one shows how the whole picture changes, such as a bifurcation as `μ` passes 0.

### Drawing a field

In a field's options (the sliders icon):

- **Draw as**: **Streamlines** (evenly spaced lines along the flow, with arrowheads), **Arrows** (on a grid), **Slope marks** (for slope fields), **Particles moving** along the flow while presenting, or **Nothing**, to show only what goes with it. **Density** sets how close together they are.
- **Color**: the line's color, or **fainter where weaker**. Arrows can be all one length, or longer where the field is stronger.
- **Shade**, for a vector field: its strength, divergence or curl behind it, orange where positive and blue where negative.

A system draws streamlines by default, a vector field arrows, and a slope field slope marks.

### Equilibria, separatrices and nullclines

For a system, or a vector field's zeros, the graph finds the equilibria in view and classifies each one from its Jacobian. A filled dot is stable (a node or a spiral), an open one unstable, a half-filled one a saddle, and a dot in a ring a center. Point at one to read its kind, its eigenvalues, and the trace and determinant of its Jacobian. A center is found from the linearization, which can't tell it from a very slow spiral.

Also in the options:

- **Separatrices of saddles**: the curves into and out of each saddle, drawn heavier.
- **Nullclines**: dashed lines where x′ = 0 and where y′ = 0, with a key.
- **Trace–determinant plane**: a small chart, top right, of where each equilibrium sits among saddles, nodes, spirals and centers. It moves as the sliders do.

Each of these can appear at its own step, so a portrait can build up as you present: the field, then the equilibria, then the separatrices.

### Paths while presenting

Click anywhere on the graph to start a path through that point, both ways in time (for a slope field, the solution through it). **Clear paths**, at the top right, removes them, and they're gone when the slide is shown again. Dragging still moves the view. Turn this off with **A click starts a path through it** in the field's options.

A path line can run forward, backward or both ways, and a dot can ride along it at the system's own pace. Paths stop where they come to rest, leave the view, or come round to where they started.

In a PDF, particles are drawn as still streamlines, dots are at rest, and clicked paths are left out.

## 3D graphs

Switch a graph to **3D** at the top of its editor, or choose **3D Graph** in the toolbar's **3D Model** menu. The same expression list then draws surfaces, curves and points in a box, which you can turn while presenting.

| Type | Example |
| --- | --- |
| Surface | `z = sin x cos y`, or just `sin x cos y` |
| Surface along another axis | `x = y z`, `y = x^2 + z` |
| Cylindrical coordinates | `z = 8 - r^2/4`, using r and θ |
| Restricted surface | `z = 8 - r^2/4 {r < 6}` |
| Implicit surface | `x^2 + y^2 + z^2 = 36`, `r = 4` (a cylinder) |
| Parametric surface | `((6 + 2cos v)cos u, (6 + 2cos v)sin u, 2sin v)`, over u and v |
| Curve | `(5cos t, 5sin t, t/2)`, over t |
| Point | `(2, 3, 4)` |
| Your own function | `f(x, y) = x y / 10`, drawn as z = f(x, y) |

In 3D, `x`, `y`, `z`, `t`, `u`, `v`, `r` and `θ` are variables, so they can't be sliders; every other letter can. A parametric surface's u and v ranges are under the line (0 to 2π and 0 to π to start), as a curve's t range is. A surface ends where its restriction does, along the edge itself.

Shaded regions, and the vector fields and systems above, are 2D only.

In a surface's options:

- **Color**: the line's color, or by height (the viridis color map, from the box's bottom to its top).
- **Mesh lines**: the grid drawn on a surface, every so many units (or every 16th of u and v).
- **Contour lines**: where z is a round number.
- **Detail**: Fine draws it on a finer grid.

### The view

Under the preview, set the box's x, y and z ranges. Drag the preview to turn it, and scroll to zoom: zooming scales the box's ranges, so more or less of a surface shows. Where the preview is turned to is where the slide starts, and **Reset** goes back to −10 to 10 on every axis. The box is always drawn as a cube, so a surface fills it whatever its units.

While presenting, drag to turn it, scroll or pinch to zoom, and double-click to zoom in; ⟲ goes back to the starting view. **Spin while presenting** turns it slowly until someone drags it. **Lock turning and zooming** keeps it as it is.

3D graphs are drawn with WebGL 2, which current browsers have. In a PDF they're drawn at the starting view, still.

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
