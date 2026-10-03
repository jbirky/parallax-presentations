# Venn Diagrams

Type a set expression, like `A \cap (B \cup C)`, and the regions it names are shaded. Or click regions, and the expression is written for you in its simplest form. Build the shading up one operation at a time while you present, check an identity like De Morgan's law with both sides drawn next to each other, fill in the counts from a word problem, and copy the diagram into a paper as TikZ.

## Making one

1. Open the **Diagrams** menu in the toolbar and click **Venn Diagram**.
2. The editor opens with *A* ∩ (*B* ∪ *C*), built up in four steps. Type over it, pick another diagram from **Start from…**, or choose **Blank**.
3. Click **Insert**.

To change it later, double-click the diagram or select it and click **Edit Venn Diagram…** in the right panel.

## Writing expressions

Type in the **Shade** box at the top. TeX from a paper, the symbols on the keypad at the left, and plain keyboard characters all work:

| Operation | Looks like | Type any of |
|---|---|---|
| Union | *A* ∪ *B* | `\cup` `∪` `\|` `+` `or` |
| Intersection | *A* ∩ *B* | `\cap` `∩` `&` `and`, or `AB` side by side |
| Difference | *A* ∖ *B* | `\setminus` `∖` `-` `A\B` `minus` |
| Symmetric difference | *A* △ *B* | `\triangle` `\ominus` `\oplus` `Δ` `xor` |
| Complement | *A*′, *A*ᶜ, *A̅* | `A'` `A^c` `A^\complement` `\overline{A}` `~A` `not A` |
| Universe | *U*, Ω, *S*, ξ | the universe's label, `U`, `\Omega`, `\xi` or `\mathcal{E}` |
| Empty set | ∅ | `\varnothing` `\emptyset` `∅` |

A complement is read first, then intersection, then union, difference and symmetric difference from left to right. When that order decided something, the line under the box says how it was read, with brackets: `A \cup B \setminus C` is read as (*A* ∪ *B*) ∖ *C*.

If the expression doesn't read, the line under the box says why and marks where. The diagram keeps its last shading until it reads again.

Each set is named by one letter in expressions. Its label on the diagram can be anything, like `\text{French}`, in the **Style** tab.

## Sets and layouts

The left column sets how many sets there are, from one to four, and their layout. Two sets can overlap, sit one inside the other or apart, and three can overlap, sit in a row or nest. Four sets are drawn as ellipses, since four circles can't make all 16 regions.

Drag a set's outline to move it, and hold `Shift` to resize it. A region the layout has no room for isn't drawn, and the panel says so if the expression shades it.

## Clicking regions

Click a region to shade it or clear it. The expression is rewritten as the simplest one that names what's shaded, in the syntax you typed it in. **Undo** brings back what you'd written.

The **Regions** tab lists every region by number (I to VIII for three sets, in the usual textbook order), by name, like *A* ∩ *B*′ ∩ *C*′, and in words, like *A only*. Click a row to shade it. **Label regions** writes the numbers or names on the diagram.

## Building it up

In the **Steps** tab, **Build it up** writes steps from the expression. For each operation, from the inside out, one step hatches its two sides in different directions, and the next fills in the result. Each step gets a caption saying what the operation means. **One step per side** skips the operations.

The steps are layers you can edit. Each layer is an expression with a style (solid, lines in four directions, dots, or an outline), a colour, the step it appears at, and the step it goes after. **Add a layer** adds one at the end, for example to outline one region at the end of the build. Captions can use `$…$` for maths.

## Comparing two sides

An expression with `=`, `\neq`, `\subseteq` or `\supseteq` draws both sides next to each other, with the relation between them and a verdict underneath: whether it holds, and if not, which regions make the difference. Click a region in either diagram to change that side.

A layout that leaves a region out counts it as empty, so with *A* drawn inside *B*, *A* ∩ *B* = *A* holds, and the panel says it holds because of the layout.

## Numbers in the regions

In the **Numbers** tab, choose what goes in the regions:

- **Counts**: write facts, one per line, like `|U| = 40`, `|F \cap S| = 7` or `n(F) = 22`. Each region's count is worked out from them. Regions the facts don't settle show a question mark. The shaded set's total can still be settled: from `|F| = 22`, `|S| = 18` and `|F \cap S| = 7`, |*F* ∪ *S*| = 33 comes out without |*U*|.
- **Probability**: the same, with facts like `P(A) = 0.3`, `P(A \cap B) = 1/10` or `P(A | B) = 0.5`, and the regions adding up to 1.
- **Members**: list each set's members, separated by commas (ranges like `1..12` work), and each member is written in its region.

The panel names any fact it can't read or that contradicts the ones above it, and any count that comes out negative or not whole.

**Reveal** shows the numbers all at once or inside out, a step per ring: the middle first, then the regions in two sets, then one, then outside, which is the order these problems are worked in.

## Presenting

Each layer, number and caption appears at its step, fading in. **Dim earlier steps** fades what came before. **Preview build** steps through it in the editor. **First step at slide step** lets the diagram's steps start later in the slide.

The canvas shows the last step. A PDF has a page for each step. PowerPoint export includes the diagram as a picture, with its hatching drawn as lines.

## TikZ

**Copy TikZ** (in the editor, or the right panel) copies the diagram as plain TikZ. Each set is a path macro, like `\setA`, and each shaded piece is a scope of `\clip`s. Outside a set is the universe and the set clipped together with the even-odd rule. Hatching needs `\usetikzlibrary{patterns}`. Tick **Beamer steps** in the editor to wrap each step in `\only<…>` for Beamer. **Copy expression** copies the expression as TeX.
