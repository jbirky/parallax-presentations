# Scrolling Slides

A slide is normally one screen. Give it a taller canvas and it becomes a scrolling slide: the audience sees one screen at a time, and you scroll down through the rest before moving on. It suits anything too long for one screen that shouldn't be cut into separate slides, such as a derivation, a tall figure, a timeline or a code walkthrough.

## Making a slide scroll

1. Click an empty part of the canvas so no element is selected.
2. In the **Properties** panel on the right, open **Scrolling**.
3. Pick a canvas height: **1.5×**, **2×** or **3×** the screen, or type a height in pixels and press `Enter` (up to 8 screens).

The canvas grows to the new height and zooms out to fit. A dashed line marks where each screen ends, labelled **screen 2**, **screen 3** and so on, and the slide shows a **SCROLL 2×** badge on the canvas and **⇕ 2×** on its thumbnail. Lay elements out anywhere on it.

Choose **Off** to go back to one screen. Elements below the first screen keep their places, so nothing is lost; they're just out of view until the canvas is tall again, and the **Scrolling** section says how many there are.

A gradient or image background covers the whole canvas and scrolls with it, as it looks in the editor. The footer and page number stay at the foot of the screen.

## Pinning an element

A pinned element stays on the screen while everything else scrolls past it, like a title that stays put, or a figure that a column of text refers to.

1. Select the element.
2. In the **Properties** panel, tick **Pin while scrolling**. It appears only on a scrolling slide.

A pinned element is positioned on the screen rather than the canvas, so it sits within the first screen, and shows a **PINNED** label in the editor.

## Presenting

| Key | On a scrolling slide |
|-----|----------------------|
| `↓` / `Space` / `Page Down` | Scrolls down most of a screen. Once there's nothing left to scroll, goes on to the next slide |
| `↑` / `Shift+Space` / `Page Up` | Scrolls back up. Once at the top, goes back to the previous slide |
| `→` / `←` | Next and previous slide, as on any slide |
| Mouse wheel, trackpad | Scrolls the slide, including over HTML and p5 embeds, unless the embed uses the wheel itself (a zoomable plot, say) |
| Touch | Dragging up and down scrolls the slide; swiping sideways changes slides |

Arriving on a scrolling slide from the one before starts at the top. Stepping back to it from the one after starts at the bottom, so you can read back up without a jump. A thin track on the right edge shows how far down you are.

**Fragments** appear as you scroll to them: pressing `↓` shows the next fragment once it's on screen, and scrolls down when it isn't yet. Going back up hides each fragment while it's on screen, then scrolls on up. A fragment that appears off screen, for example with `→`, is scrolled into view.

**Drawing on the slide** while presenting puts the ink on the canvas, so it scrolls with what you marked. With the pen out, the mouse wheel still scrolls the slide, and once you've drawn with a stylus, a finger dragged up or down scrolls it too.

Share links, the live viewer and exported HTML files scroll the same way. In a live session, each viewer scrolls for themselves; your scroll position isn't sent to them.

## Exporting

- **PDF** gives a page per screen, with all of the slide's fragments shown, pinned elements on every page, and the same page number on each.
- **PowerPoint** gives a slide per screen in the same way, with the speaker notes on the first.
