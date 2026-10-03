# Circuit Diagrams

Draw circuit schematics from parts on a grid, show the current flowing through them and what their meters read, build them up one step at a time while you present, and copy the same circuit into a paper as CircuiTikZ code.

## Making one

1. Open the **Diagrams** menu in the toolbar and click **Circuit Diagram**.
2. The editor opens with a battery, a switch, a resistor and a lamp drawn. Change it, pick another circuit from **Start from…**, or choose **Blank**.
3. Click **Insert**.

To change it later, double-click the circuit or select it and click **Edit Circuit…** in the right panel.

## Drawing

The left column has the parts. Pick one (or press its key) and drag between two points on the canvas:

| Part | Key | Value |
|---|---|---|
| Wire | `W` | |
| Resistor | `R` | ohms |
| Capacitor | `C` | farads |
| Inductor | `L` | henries |
| Battery | `B` | volts |
| DC source | `E` | volts |
| AC source | | volts |
| Current source | `I` | amps |
| Switch | `S` | |
| Diode | `D` | |
| Lamp | `X` | ohms |
| Ammeter | `A` | |
| Voltmeter | `M` | |
| Ground | `G` | |

- Points snap to a grid of half centimetres. Hold `Alt` to draw off the grid.
- A wire dragged on a slant turns one right angle, horizontal first if it's wider than tall. Hold `Shift` for a straight slanted wire, as across a bridge.
- Clicking a wire with a part chosen turns that wire into the part. So you can draw a circuit as a loop of wires first and fill in its parts after.
- Clicking an empty point places a part 2 cm long.
- A drag that starts or ends in the middle of a wire splits the wire there, making a junction.
- With **Ground**, click a vertex or a wire to ground it there. Every ground is the same point.

With **Select** (`V`):

- Drag a vertex or a part to move it. Drop a vertex on another to join them.
- `Delete` removes what's selected. A vertex left with nothing on it goes too.
- `Ctrl+Z` and `Ctrl+Shift+Z` undo and redo.

## Parts and vertices

Select a part to change what it is, reverse it, swap which side its label and value are on, give it a label, a value, a current arrow or voltage marks, or choose the step it appears at.

- A battery or source runs from its negative terminal to its positive one, and a diode from anode to cathode. **Reverse** turns it around.
- Values take SI prefixes: `4.7k`, `100n`, `2.2µ` (or `2.2u`). They show with their unit, such as 4.7 kΩ.
- A switch can start closed, and can open or close at a step.

Select a vertex to give it a mark (a dot, or an open circle for a terminal), ground it in any direction, or label it. **Auto** puts a dot where three or more connections meet.

## Current and readings

Parallax solves the circuit as you draw it: the voltage at every point and the current through every part, once everything has settled (its DC steady state).

- Dots run along the wires and parts in the direction of conventional current, faster where more flows.
- A lamp glows with the power it takes.
- Ammeters and voltmeters show what they read.
- Selecting a part shows the current through it and the voltage across it. Selecting a vertex shows its voltage.

Turn these off with **Show the current** and **Show meter readings** in the editor's Circuit panel or the right panel. Capacitors count as open and inductors as wires, as they are once settled, and AC sources count as 0 V. A diode conducts with a 0.7 V drop or not at all.

The Circuit panel warns about loose ends (a wire end connected to nothing) and about a source shorted out by a wire, a closed switch or an ammeter.

## Building it up when presenting

Each part has the step it appears at, and a switch can flip at a step. At each step, Parallax solves just what has been drawn by then, with each switch as it is then. So a slide can show the current in a circuit grow as branches are added, or start when a switch closes.

- Each step can have a caption, shown under the circuit from that step until the next caption.
- **First step at slide step** lines the circuit's steps up with the slide's other fragments.
- **Fade earlier steps** dims what's already drawn. It's off unless you turn it on, since the current runs through what came before too.
- **Preview build** in the editor steps through the circuit as the slide will.

The canvas shows the circuit as it ends, with the dots standing still; they move when presenting. A printed PDF has a page for each step, with that step's readings.

## CircuiTikZ

**Copy CircuiTikZ** (in the editor and in the right panel) copies the circuit as CircuiTikZ code, with each part a path between its two points:

```latex
\usepackage[american]{circuitikz}
...
\begin{circuitikz}
  \draw (0, 0) to[battery1, l=$\mathcal{E}$, a=$9\,\mathrm{V}$] (0, 3);
  \draw (0, 3) to[closing switch, l=$S$] (2.5, 3);
  \draw (2.5, 3) to[R, l=$R$, a=$18\,\Omega$] (5, 3);
  ...
\end{circuitikz}
```

Sources are written from their negative terminal to their positive one. CircuiTikZ has changed which way it draws a source's polarity between versions, so check yours (its `voltage dir` option) if a source comes out reversed.

PowerPoint export draws the circuit as an image, as it ends, with its labels as plain text rather than KaTeX.
