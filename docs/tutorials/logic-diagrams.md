# Logic Diagrams

Draw logic circuits from gates, inputs, outputs, clocks and flip-flops, and the slide shows every signal as it is: flip an input or tick the clock at a step, watch the change run through the gates, and keep the truth table beside the diagram with the current row lit. The same diagram copies into a paper as CircuiTikZ, and its truth table as a LaTeX tabular.

## Making one

1. Open the **Diagrams** menu in the toolbar and click **Logic Diagram**.
2. The editor opens with a half adder. Change it, pick another diagram from **Start from…**, or choose **Blank**.
3. Click **Insert**.

To change it later, double-click the diagram or select it and click **Edit Logic Diagram…** in the right panel.

## Placing and wiring

The left column has the parts. Pick one (or press its key) and click to place it:

| Part | Key | Output |
|---|---|---|
| Input | `I` | its value |
| Output | `O` | lights at 1 |
| Clock | `K` | ticks each step |
| AND | `A` | 1 if all its inputs are 1 |
| OR | `R` | 1 if any is 1 |
| NOT | `N` | the opposite |
| NAND, NOR | | the opposite of AND, OR |
| XOR | `X` | 1 if an odd number are 1 |
| XNOR | | 1 if an even number are 1 |
| Buffer | | the same |
| D flip-flop | `F` | D, taken when its clock rises |

- AND, OR, NAND, NOR, XOR and XNOR take two to four inputs. Change the number in the right panel.
- With **Wire** (`W`), drag from a pin to a pin. Wires go across, down and across. A drag that starts or ends on a wire makes a junction there, with its dot.
- With **Select** (`V`), drag a part or a junction to move it, with its wires following. Select a wire and drag its round handle to move its upright.
- Click an input's box to set it to 0 or 1, and the diagram follows at once.
- `Delete` removes what's selected. `Ctrl+Z` and `Ctrl+Shift+Z` undo and redo.

## Signals

Every wire shows its signal: green for 1, grey for 0, and dashed amber for unknown, such as an input connected to nothing, or a latch before it's set. Outputs light at 1, and inputs show their value. Turn the colors off with **Color wires by signal**.

- A gate decides by itself when one input settles it: a 0 into an AND makes 0 even if its other input is unknown.
- Latches and flip-flops remember from one step to the next. A D flip-flop takes D when its clock rises.
- The Diagram panel warns about inputs connected to nothing, a wire driven by two outputs that disagree, and a loop that never settles (an odd ring of inverters), which it shows as unknown.

## Truth tables

A diagram with no flip-flops, clocks or feedback, and up to six inputs, has a truth table, worked out by trying every input. It's in the Diagram panel, with the row for the inputs as they are now lit. Check **Show it on the slide** to draw it beside the diagram, where its lit row follows the inputs as they flip. **Copy as LaTeX** copies it as a tabular.

Inputs are the table's columns from top to bottom of the diagram, and outputs the same.

## Building it up when presenting

- An input starts at 0 or 1 and flips at the steps you list, like `1, 3`.
- A clock is high at its first step, low at the next, and so on until it stops.
- Parts and wires can appear at a step, and each step can have a caption.
- When an input flips, each wire's new value appears after the ones before it in the logic, so the change runs through the gates.
- **First step at slide step** lines the diagram's steps up with the slide's other fragments.
- **Preview build** in the editor steps through the diagram as the slide will.

The canvas shows the diagram as the slide starts, with every part drawn. A printed PDF has a page for each step, with that step's signals.

## CircuiTikZ

**Copy CircuiTikZ** copies the diagram with each gate as a CircuiTikZ logic port where it is, and each wire drawn between their anchors:

```latex
\usepackage[american]{circuitikz}
\usetikzlibrary{calc}
...
\begin{circuitikz}
  \draw (0.75, 2) node[ocirc] (A) {} node[left] {$A$};
  \draw (3, 1.75) node[xor port] (g1) {};
  \draw (g1.out) -- (S);
  ...
\end{circuitikz}
```

CircuiTikZ draws its ports at its own size, so the spacing can come out a little different from the slide. Check a D flip-flop's pins against your version of CircuiTikZ: the export uses pin 1 for D, pin 3 for the clock, pin 6 for Q and pin 4 for Q̄.

PowerPoint export draws the diagram as an image, as the slide starts, with its labels as plain text.
