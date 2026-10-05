# Geometry Constructions

Build a ruler-and-compass construction from points, lines and circles, each made from the ones before. Drag a point and everything made from it follows, so a theorem holds as the figure moves. While you present, the construction can draw itself in a line at a time, each line with a caption, and anyone watching a shared deck can drag the points too. Each construction copies out as tkz-euclide for LaTeX.

## Making one

1. Open the **Diagrams** menu in the toolbar and click **Geometry**.
2. The editor opens with Euclid's first proposition: an equilateral triangle on a segment. Change it, or pick another from **Start from…**: the perpendicular bisector by compass, the circumcircle, the incircle, the Euler line, Thales' theorem, the inscribed angle theorem, tangents from a point, or a blank figure.
3. Click **Insert**.

To change it later, double-click the figure or select it and click **Edit Geometry…** in the right panel.

## Drawing with the tools

Pick a tool on the left, then click on the figure. Each tool takes its clicks in turn, and the line at the top says what to click next. Where you click decides the point:

- On a point, it uses that point.
- Where two lines or circles cross, it makes their crossing.
- On a line or circle, it makes a point that stays on it.
- Anywhere else, it makes a free point.

While a tool waits for its last click, a faint preview follows the pointer. **Esc** starts the tool over.

| Tool | Click |
|---|---|
| **Move** | Drag a point. Blue points are free; green ones slide along the line or circle they're on. Drag empty space to pan, and scroll to zoom. |
| **Point** | Anywhere |
| **Intersect** | Two lines or circles, the second near the crossing you want |
| **Midpoint** | Two points |
| **Segment**, **Line**, **Ray** | Two points (a ray's start first) |
| **Perpendicular**, **Parallel** | A line, then the point the new line goes through |
| **Perpendicular bisector** | Two points |
| **Angle bisector**, **Angle** | A point on one arm, the vertex, a point on the other arm |
| **Circle** | Its center, then a point it passes through |
| **Circle through 3** | Three points |
| **Polygon** | Its corners, then the first again |
| **Distance** | Two points |
| **Delete** | Something to delete, along with everything made from it |

The other points are made from points before them, so they move only when those do. Angles show in degrees, with a square mark at a right angle. **Undo**, **Redo** (Ctrl+Z, Ctrl+Shift+Z) and **Fit**, which frames the figure, are at the top.

## The construction

The **Construction** tab lists every object in order, in words: "C is where c and d cross". Click one to select it, then set its color, its label, whether it's **Working** (drawn thin and dashed, as compass arcs are) and whether it's **Hidden**. **Delete** or **Backspace** deletes the selected object. An object that can't exist as the figure stands, like a tangent from a point inside its circle, is struck through and isn't drawn until it can be.

## The script

The **Script** tab shows the same construction as text, one object a line, in GeoGebra's English command names. Edit it and click **Apply**:

```
A = Point(-2, -1.5)
B = Point(2, -1.5)
s = Segment(A, B)
c = Circle(A, B) {construction}
d = Circle(B, A) {construction}
C = Intersect(c, d, 0)
t = Polygon(A, B, C)
α = Angle(B, A, C)
```

| Command | Makes |
|---|---|
| `Point(x, y)` | A free point |
| `PointOn(c, t)` | A point on a line or circle: on a circle, `t` is its angle in radians; on a line, 0 is the first point and 1 the second |
| `Intersect(a, b, n)` | Where two lines or circles cross; `n` (0 or 1) picks which of two crossings |
| `Midpoint(A, B)` | The midpoint |
| `Segment(A, B)`, `Line(A, B)`, `Ray(A, B)` | A segment, a line, a ray from A through B |
| `Circle(O, A)` | The circle centered at O through A |
| `Circle(A, B, C)` | The circle through three points |
| `Perpendicular(P, l)`, `Parallel(P, l)` | The line through P perpendicular or parallel to `l`; `Perpendicular(P, A, B)` uses the line AB |
| `PerpendicularBisector(A, B)` | The perpendicular bisector |
| `AngleBisector(A, B, C)` | The bisector of the angle at B |
| `Polygon(A, B, C, …)` | A filled polygon |
| `Angle(A, B, C)` | The angle at B, in degrees |
| `Distance(A, B)` | The distance, written beside the segment |

A name starts with a letter, Greek included, then letters, digits, `_` or `'`. Names like `P1` and `M_a` label as P₁ and Mₐ. After a line, in braces:

- `{construction}` draws it as working.
- `{hidden}` doesn't draw it, though what's made from it still is.
- `{dashed}` dashes it.
- `{color=red}`: red, blue, green, yellow or purple, matched to the figure's colors, or a hex color like `#e07000`.
- `{label=P'}` labels it in TeX; `{label}` labels a line or circle with its name; `{label=none}` leaves a point unlabeled.

Combine them with commas: `{construction, color=blue}`. If a line can't be read, the editor says which and why, and Apply waits until it can.

## Building it up step by step

In the **Steps** tab, each step shows the construction up to one of its objects, and what's new draws itself in: lines trace from end to end, circles sweep round as a compass would, and points and labels fade in.

- **A step a line** makes a step for each object after the points the figure starts with. A template starts this way.
- **Shown before the first** sets how many objects are there when the slide opens.
- A step's number is the last object it shows; change it to show several objects at once.
- A step's **caption** shows under the figure. Left empty, it says what the step's last object is, as the Construction tab does. Turn off **Captions under the figure** for none at all.
- **A last step that hides the working** ends with the finished figure, its working lines gone.

Click **Preview build** to step through it as the presented slide will (→ and ←). **First step at slide step**, in the right panel, places the steps among the slide's other animations.

The canvas always shows the whole construction. In a PDF, each step gets its own page.

## Dragging while you present

In a presented or shared deck, anyone can drag the blue and green points at every step, and the figure follows as it does in the editor. On a touchscreen, a finger on the figure drags a point rather than turning the slide. When the slide is shown again, the figure is back as it was saved.

## Axes, grid and colors

In the **Figure** tab or the right panel:

- **Axes** numbers the x and y axes.
- **Grid** draws a grid, and free points snap to it, in the editor and while presenting.
- **For a dark slide** and **For a light slide** set the colors. A new figure matches the slide it's on.

Resizing the element on the slide never stretches the figure: its width sets the scale, and a taller box shows more above and below.

## Copying it out

- **Copy tkz-euclide**, in the right panel or the editor's Figure tab, copies the figure as LaTeX for the [tkz-euclide](https://ctan.org/pkg/tkz-euclide) package. It keeps the construction itself, so moving a point in the LaTeX moves the rest, and it's clipped to the same view as on the slide.
- **Script**, in the Figure tab, copies the construction's text.
- **PowerPoint (.pptx)** export puts the figure on its slide as an image.
