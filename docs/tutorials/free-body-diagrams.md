# Free-Body Diagrams

Draw a body and the forces on it: a block on a floor or an incline, a sign on two ropes, a ball falling through air. Leave the forces you don't know as unknowns, and the diagram works them out from Newton's second law, so the arrows come out the right length. Build the diagram up force by force while you present, and copy it into a paper as TikZ.

## Making one

1. Open the **Diagrams** menu in the toolbar and click **Free-Body Diagram**.
2. The editor opens with a block at rest on an incline. Change it, pick another diagram from **Start from…**, or choose **Blank**.
3. Click **Insert**.

To change it later, double-click the diagram or select it and click **Edit Free-Body Diagram…** in the right panel.

## Adding forces

The left column has the kinds of force. Click one, or press its key, to add it in its usual direction:

| Force | Key | Starts | Its size |
|---|---|---|---|
| Weight | `W` | straight down | *mg*, from the body's mass |
| Normal | `N` | out of the surface | worked out |
| Friction | `F` | up the slope, or back along the floor | worked out at rest, μ times the normal force when sliding |
| Tension | `T` | along its rope | given |
| Applied | `A` | to the right | given |
| Drag | `D` | up | given |
| Spring | `S` | back along the surface | given |
| Other | `O` | at 45° | given |

You can also drag out from the body to draw an applied force at any angle.

Drag a force's arrow to turn it. If its size is given, the drag sets that too. Angles snap to 5°, and to horizontal, vertical, along the surface and off it. Hold `Alt` to turn it freely. Select a force to set it exactly in the right panel:

- **Label**: TeX, with buttons for the usual names.
- **Magnitude**: **Given** in newtons, **Worked out**, **From the mass** (weight), or **μ × the normal force** (friction).
- **Direction**: an angle from the horizontal or from the surface. The normal force is 90° from the surface and friction lies along it, so both follow an incline as you tilt it.
- **Show its components** along the diagram's axes, as dashed arrows with labels of their own, like *mg* sin θ.
- **Mark its angle** to the horizontal, the vertical, the surface or the normal.
- **Draw its rope**, for tensions and pulls.
- **Color** and the **step** it appears at.

## The body, its surroundings and its motion

With no force selected, the right panel sets:

- **Body**: a box, a ball or a point, with a label and a mass.
- **Surroundings**: none, a floor, an incline (with a slider for its angle), a wall or a ceiling. A strict free-body diagram shows the body alone, so **Draw the surroundings** can be turned off.
- **Motion**:
  - **At rest or steady**: the forces that are worked out take whatever values balance the rest, so Σ*F* = 0.
  - **Sliding along the surface**: the acceleration along the surface is worked out too.
  - **Free**: nothing is worked out, and *a* = Σ*F* / *m*.
- **Drawing**: whether forces start from the centre (the usual way in introductory physics) or where they act, axes (level or along the surface), the scale in newtons per centimetre of arrow, values on the labels, and the net force.

The top of the panel always shows what the forces add up to: each magnitude and where it came from, Σ*F*, *a*, and anything that needs attention.

## Working out the unknowns

Up to two forces can be worked out, or one force and the acceleration when sliding. For example:

- A block resting on an incline: the normal force and static friction.
- A block sliding down with kinetic friction: the normal force and how fast it speeds up.
- A sign on two ropes: both tensions.

If a result comes out negative, the arrow is drawn the way it really points, and the panel says what that means. Negative friction points the other way. A negative normal force means the body would leave the surface, and a negative tension means a rope would have to push. More than two unknowns, or two along one line, can't be worked out, and the panel says so.

## Presenting

Give forces steps to build the diagram up while you talk. Each force draws in from where it acts, then its label, components and angle mark fade in. The net force can have its own step, usually the last. Steps can have captions, written in the **Steps** section with no force selected. **Dim earlier steps** fades what came before. **Preview build** steps through it in the editor.

The net force is drawn dashed beside the diagram, so it doesn't lie on top of the forces it sums.

A PDF has a page for each step. PowerPoint export includes the diagram as a picture.

## TikZ

**Copy TikZ** (in the editor, or the right panel) copies the diagram as plain TikZ. It needs `\usetikzlibrary{arrows.meta, patterns}`. Each force is an arrow in polar form from where it acts, like `\draw[force] (0,0) -- ++(-90:3.27) node[below] {$mg$};`, so its angle and length are easy to change by hand.
