# Scrolling Slides

A slide is normally one screen. Give it a taller canvas and it becomes a scrolling
slide: the audience sees one screen at a time and you scroll through the rest
before moving on. It suits anything that is too long to fit but shouldn't be cut
into separate slides — a derivation, a tall figure, a timeline, a code walkthrough.

## Making a slide scroll

1. Click an empty part of the canvas so no element is selected.
2. In the right panel, open **Scrolling**.
3. Pick a canvas height: **1.5×**, **2×**, or **3×** the screen — or type an exact
   pixel height.

The editor canvas grows to the new height and zooms out to fit, with a dashed line
and a `screen 2`, `screen 3` label marking where each screen ends. Lay elements
out anywhere on it; a `SCROLL 2×` badge marks the slide in the canvas and in the
slide panel.

Set the height back to **Off** to return to a single screen. Elements already
placed below the first screen stay where they are, so nothing is lost — they are
just out of view until you make the canvas tall again.

## Pinning an element

A pinned element stays on screen while everything else scrolls past it — a title
that stays put, a figure that a scrolling column of text refers to.

1. Select the element.
2. In the right panel, tick **Pin while scrolling** (it appears only on a tall slide).

A pinned element's Y position is measured from the top of the *screen*, not the top
of the canvas, so it is always laid out within the first screen and shows a `PINNED`
label in the editor.

## Presenting

| Key | Behaviour on a tall slide |
|-----|---------------------------|
| <kbd>↓</kbd> / <kbd>Space</kbd> / <kbd>Page Down</kbd> | Scrolls down ~85% of a screen; advances to the next slide once the canvas bottom is reached |
| <kbd>↑</kbd> / <kbd>Page Up</kbd> | Scrolls back up; leaves the slide once the top is reached |
| <kbd>Shift</kbd> + <kbd>Space</kbd> | Back, same as anywhere else |
| Mouse wheel / trackpad | Scrolls the canvas, including over HTML, p5 and chart embeds |
| Touch | Swipes scroll the slide; swipe navigation between slides is off on a tall slide, so use keys, clicks or the overview |

Arriving on a tall slide going forwards starts you at the top; coming back to it
from a later slide starts you at the bottom, so continuing to press <kbd>↑</kbd>
reads backwards without a jump. A thin progress track on the right edge shows how
much canvas is left.

Fragments still work: on a tall slide the canvas scrolls to the bottom first, and
then further presses advance the fragments. An element cannot be both a fragment
and scroll-animated — a fragment waits for a click, so the fragment wins.

## Scroll-driven animation

On a tall slide, scroll position can drive animation instead of a click. Select an
element and use **Scroll Animation** in the right panel.

### Animate in when scrolled into view

The element stays hidden until it is about 15% up from the bottom of the screen,
then plays one of the same presets the slide entry animations use (fade, zoom,
slide, flip), over your chosen duration. Tick **Replay every time it scrolls in**
to have it animate again on every pass rather than only the first.

This replaces the element's slide entry animation — it is a different trigger for
the same animation, not a second one — and it is re-armed each time you arrive on
the slide, so a second visit plays it again.

### Scrub with scroll position

The element's state follows the scroll rather than a clock, so it moves only while
you move, forwards or backwards. Pick an effect and an **Amount**:

| Effect | What it does |
|--------|--------------|
| Parallax drift | Drifts against the scroll, so the element reads as nearer or further away. Amount is the fraction of a screen it travels |
| Fade in & out | Fades up as it comes on screen and away as it leaves, scaled by the element's own opacity |
| Zoom | Scales from `1 − amount` to `1 + amount` |
| Rotate | Tilts through `± amount × 45°` |
| Progress only | No built-in effect — just publishes progress for custom CSS |

Progress runs 0 → 1 over the scroll positions that can actually be reached, so an
element on the first screen starts at 0 rather than part-way through, and one at
the foot of the canvas finishes exactly as the scroll bottoms out.

A **pinned** element never travels through the screen, so it scrubs on the slide's
overall progress instead — which is the pairing worth knowing: pin a figure, scrub
it, and let a column of text scroll past to narrate it.

### Driving it yourself

Every scrubbed element publishes a `--scroll-progress` variable (0–1), and the
slide publishes `--slide-scroll-progress`, so [custom CSS](/features/overview) can
drive anything:

```css
.reveal section[data-scroll-height] .my-bar {
  width: calc(var(--slide-scroll-progress, 0) * 100%);
}
```

Embeds get the same numbers by message, so a D3 or p5 figure can redraw as the
slide scrolls:

```js
window.addEventListener('message', e => {
  const m = e.data
  if (m?.source !== 'parallax-host' || m.type !== 'scroll-progress') return
  render(m.payload.slide)     // 0–1 down the slide; payload.element is this embed's own travel
})
```

Anyone who has set *reduce motion* in their system settings gets the content
without the movement: nothing is hidden, and scrubbed effects hold still.

## Export

- **PDF** — one page per screen, in order, with pinned elements repeated on each.
  Page numbers count the slide once, not once per screen.
- **PowerPoint** — the same slicing: one PowerPoint slide per screen, since
  PowerPoint cannot scroll.
- **HTML** — scrolls and animates exactly as it does in present mode, offline
  exports included.

::: tip
Two screens is usually plenty. Past about three, a viewer loses track of where they
are in the slide — consider separate slides, or an
[auto-animate transition](/tutorials/transitions) between them instead.
:::
