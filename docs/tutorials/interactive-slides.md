# Links & Click Actions

Make slides that respond to clicks, like a website: buttons that jump to another slide, text that links to a slide, tabs that switch what's shown, and elements that appear when clicked. Click actions work when presenting, in exported HTML files and on share links.

## Linking text to a slide

1. Double-click a text element and select the words to link.
2. Click **Add link** in the text toolbar, or press `Ctrl+K`.
3. Choose **Slide** at the top of the dialog, pick the slide, and click **Insert**.

Slide links point at the slide itself rather than its position, so they keep working when you reorder slides. Choose **Web page** instead to link to a web address.

## Click actions

Any element can do something when it's clicked while presenting:

1. Select the element.
2. In the **Properties** panel on the right, scroll to **On click**, at the bottom of the **Element** section.
3. Choose what happens:

| On click | What it does |
|----------|--------------|
| Go to slide | Jumps to the slide you pick |
| Next slide, Previous slide | Moves one slide forward or back |
| Show or hide elements | Shows, hides or toggles other elements on the same slide |
| Open web page | Opens an `https://`, `http://` or `mailto:` address, in a new tab unless you untick **Open in a new tab** |

Elements with a click action have a small blue badge on the canvas, such as **↗ Slide** or **◐ Show/hide**.

When presenting, clickable elements show a pointer and respond when you hover over them. **On hover** sets how: **Brighten** (the default), **Lift**, **Grow** or **Nothing**. They can also be reached with `Tab` and clicked with `Enter` or `Space`.

A few things to know:

- A click action set on a grouped element is set for the whole group, so every part of a grouped button works.
- HTML embeds, p5.js sketches, video, audio, drawings and plugins take their own clicks, so they don't get a click action. A click on something else can still show or hide them.
- An image with **Click to expand** or **Pop-up text** does that when clicked. Turn those off to give it a different click action.
- A link inside a clickable element's text is followed instead of the element's action.

## Showing and hiding elements

**Show or hide elements** lists everything on the slide. Set each one to **Show**, **Hide** or **Toggle**, or leave it at **—**. A group counts as one entry, and clicking a name selects that element.

To make something appear only when clicked, select it and tick **Hidden until a click shows it**, for example on an answer that a "Show answer" button reveals. If nothing on the slide shows it, the panel says so.

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

On a slide where clicks show or hide things, the **Show on canvas** bar above the slide sets what the canvas shows:

- **As it opens**: the slide before any clicks, which is the default
- A clickable element's name, such as **Tab 2**: the slide after that click
- **Everything**: every element, with the ones that start hidden faded

Selecting a tab switches to its view, so you can edit each tab's text without the others on top of it. This only changes what the editor shows and isn't saved with the deck.

## Where click actions work

| Where | Click actions |
|-------|---------------|
| Present | Yes |
| Export HTML, Export Offline HTML | Yes |
| Share links, GitHub Pages | Yes |
| Export PDF | Slide links and click actions link to the right page, and web page actions become web links. Each slide is printed as it opens. |
| Export PPTX | No |

**Preview Slide** shows only the current slide, so it's good for trying show and hide, but links to other slides can't go anywhere there.

::: tip
While presenting, the address bar shows the current slide as `#/s-…` instead of a number. That address points at the same slide even after you reorder the deck, so it's safe to share.
:::

Deleting a slide that something links to asks first. Duplicating slides, importing slides from another presentation and creating a presentation from a template all keep links and show/hide working.
