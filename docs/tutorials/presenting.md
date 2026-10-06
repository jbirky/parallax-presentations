# Presenting & Export

## Present mode

Click the **Present** button (play icon) in the top-right toolbar to open the full presentation in a new window.

### Controls in present mode

| Key | Action |
|-----|--------|
| `Right` / `Space` | Next slide |
| `Left` | Previous slide |
| `S` | Open speaker notes |
| `F` | Toggle fullscreen |
| `Escape` | Exit fullscreen or close overlay |
| `O` | Overview / slide grid |
| `D` | Open the pen toolbar to draw on slides |

Drawing on slides, and keeping each session's ink, is covered in **Drawing on Slides**. Buttons and links that respond to clicks and hovers are covered in **Links, Click & Hover Actions**. On a slide taller or wider than the screen, `Space` and `↓` (or `→`, for one that scrolls sideways) scroll it before moving on, as described in **Scrolling Slides**.

## Practicing a talk

Open the menu beside **Present** and choose **Practice Talk**. The deck opens in a window with a timer at the top right: the time on the slide showing, against the minutes planned for it in the [outline](./outline), and the time on the whole talk, against its length. Below the talk's time, the pace says how far ahead of or behind the plan you are, from the slides you've already shown. Time runs while a slide is showing; **Pause** stops it, for a question or a sip of water.

**Finish** shows the run slide by slide: what was planned, how long it took, the difference, and a bar with the plan marked. **Practice again** starts a new run from the first slide. Closing the window keeps the run too.

Runs are kept with the deck, the last ten of them. To see them again, open the menu beside **Present** and choose **Practice runs…**, or click **Last practice** in the outline, where each slide's line also shows its time in the last run. **Plan from this run** sets each slide's planned minutes to its time in the run, to the half minute.

Practice runs are only yours: they aren't part of shared links, exports, templates or versions.

## Preview a single slide

To test a single slide without presenting the entire deck:

1. Click the **Preview Slide N** button at the top of the right panel.
2. The current slide opens in a new window, fully rendered in present mode.

This is useful for testing HTML embeds, animations, and interactive features without navigating through the full deck.

## Speaker notes

1. In the editor, click the **Notes** area at the bottom of the properties panel.
2. Type your speaker notes for the current slide.
3. In present mode, press `S` to open the speaker view with notes, timer, and next-slide preview.

## Themes

Change the visual theme in the toolbar under **Theme**:

- Black, White, League, Beige, Sky, Night, Serif, Simple, Solarized, Moon, Dracula

Themes affect the background color, text color, and heading styles. Element-level formatting takes precedence over theme defaults.

## Footer & page numbers

1. Open footer settings in the toolbar.
2. Configure:
   - **Section labels** — show active section in a progress bar
   - **Page numbers** — `n/total` or just `n`
   - **Clock / Timer** — 12h clock, 24h clock, count-up or count-down timer

## Export options

### HTML

Click **Export** > **Download HTML** to get a self-contained HTML file. All fonts, scripts, and images (if from URLs) are loaded via CDN. The file can be opened in any browser without a server.

### Single slide HTML

Click **Export** > **Export Slide HTML** to download just the current slide.

### PDF

Click **Export** > **Export PDF** to generate a print-ready PDF with one page per slide. Fragment states are expanded into separate pages.

### PowerPoint

Click **Export** > **Export PPTX** to generate a PowerPoint file. Text, shapes, and images are converted to native PowerPoint objects.

## Sharing

Sharing is only in the cloud version at parallax-presentations.com. The self-hosted version and the desktop app keep everything on your computer, so share an exported HTML file from them instead.

1. Click the **Share** button in the toolbar.
2. Toggle sharing on. A shareable URL is generated.
3. Anyone with the link can view the presentation in present mode (read-only).
4. Toggle sharing off to revoke access.

### Example: exported slide

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/parallax-presentations/demos/slide-export.html" style="width:100%;height:220px;border:none"></iframe>
</div>
