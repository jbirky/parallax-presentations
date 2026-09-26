# Links, Click & Hover Actions

Make slides that respond to clicks and hovers, like a website: buttons that jump to another slide, text that links to a slide, tabs that switch what's shown, elements that appear when clicked, and labels that appear while the pointer is over part of a diagram. Click and hover actions work when presenting, in exported HTML files and on share links.

## Linking text to a slide

1. Double-click a text element and select the words to link.
2. Click **Add link** in the text toolbar, or press `Ctrl+K`.
3. Choose **Slide** at the top of the dialog, pick the slide, and click **Insert**.

Slide links point at the slide itself rather than its position, so they keep working when you reorder slides. Choose **Web page** instead to link to a web address.

## Click actions

Any element can do something when it's clicked while presenting:

1. Select the element.
2. In the **Properties** panel on the right, scroll to **Interactions**, at the bottom of the **Element** section.
3. Choose what happens in **On click**:

| On click | What it does |
|----------|--------------|
| Go to slide | Jumps to the slide you pick |
| Next slide, Previous slide | Moves one slide forward or back |
| Show or hide elements | Shows, hides or toggles other elements on the same slide |
| Open web page | Opens an `https://`, `http://` or `mailto:` address, in a new tab unless you untick **Open in a new tab** |

Elements with a click action have a small blue badge on the canvas, such as **↗ Slide** or **◐ Show/hide**.

When presenting, clickable elements show a pointer and respond when you hover over them. **Hover style** sets how: **Brighten** (the default), **Lift**, **Grow** or **Nothing**. They can also be reached with `Tab` and clicked with `Enter` or `Space`.

A few things to know:

- A click action set on a grouped element is set for the whole group, so every part of a grouped button works.
- HTML embeds, p5.js sketches, video, audio, drawings and plugins take their own clicks, so they don't get a click or hover action. A click or hover on something else can still show or hide them.
- An image with **Click to expand** or **Pop-up text** does that when clicked. Turn those off to give it a different click action.
- A link inside a clickable element's text is followed instead of the element's action.

## Hover actions

An element can also show or hide others while the pointer is over it:

1. Select the element.
2. In **Interactions**, set **On hover** to **Show or hide elements**.
3. Set each element in the list to **Show** or **Hide**.

When presenting:

- What a hover shows or hides goes back once the pointer moves off the element. It waits a moment first, so the pointer can cross a gap onto a card the hover shows, and the card stays while the pointer is on it.
- Moving to the element with `Tab` shows its hover too.
- On a touch screen, a tap turns the hover on and a second tap turns it off, as does a tap somewhere else. If the element also has a click action, a tap runs the click action instead.
- A hover sits on top of what clicks did: an element a click hid shows while a hover shows it, and is hidden again after.

### Hotspots

To add a hotspot that's already set up, open **Layout ▾** in the toolbar and click **Hotspot**. This adds a round marker and a card that shows while the pointer is over the marker. Double-click the card's text to edit it, and drag the marker and the card where you want them. The card's box and text are grouped, so they move together.

## Showing and hiding elements

**Show or hide elements** lists everything on the slide. Set each one to **Show**, **Hide** or **Toggle** (on click), or leave it at **—**. A group counts as one entry, and clicking a name selects that element. A hover's list leaves out the element itself.

To make something appear only when clicked or hovered, select it and tick **Hidden until a click or hover shows it**, for example on an answer that a "Show answer" button reveals. If nothing on the slide shows it, the panel says so.

When presenting, elements fade in and out, and each time you come back to a slide it starts over as it was.

## Tabs

To add tabs that are already set up:

1. Open **Layout ▾** in the toolbar.
2. Next to **Tabs**, click **2**, **3** or **4**.

This adds a row of tab buttons over a panel. Clicking a tab shows its own text, with a bar under the tab, and hides the other tabs' text. Tab 1 shows first.

- Rename a tab by selecting it and changing **Label Text** in the Properties panel.
- Double-click a tab's text to edit it.
- To move the whole component, drag a selection box around it. Its parts aren't grouped, because a group shares one click action.

## Editing slides with hidden elements

On a slide where clicks or hovers show or hide things, the **Show on canvas** bar above the slide sets what the canvas shows:

- **As it opens**: the slide before any clicks or hovers, which is the default
- A clickable element's name, such as **Tab 2**: the slide after that click
- **Hover:** and an element's name, such as **Hover: i**: the slide while the pointer is over that element
- **Everything**: every element, with the ones that start hidden faded

Selecting a tab or a hotspot's marker switches to its view, so you can edit each tab's text, or a hotspot's card, without the others on top of it. This only changes what the editor shows and isn't saved with the deck.

## Where click and hover actions work

| Where | Click and hover actions |
|-------|---------------|
| Present | Yes |
| Export HTML, Export Offline HTML | Yes |
| Share links, GitHub Pages | Yes |
| Export PDF | Slide links and click actions link to the right page, and web page actions become web links. Each slide is printed as it opens, with no hovers. |
| Export PPTX | No |

**Preview Slide** shows only the current slide, so it's good for trying show and hide, but links to other slides can't go anywhere there.

::: tip
While presenting, the address bar shows the current slide as `#/s-…` instead of a number. That address points at the same slide even after you reorder the deck, so it's safe to share.
:::

Deleting a slide that something links to asks first. Duplicating slides, importing slides from another presentation and creating a presentation from a template all keep links and show/hide working.
