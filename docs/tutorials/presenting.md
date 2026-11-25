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

Drawing on slides, and keeping each session's ink, is covered in **Drawing on Slides**. Buttons and links that respond to clicks and hovers are covered in **Links, Click & Hover Actions**. On a slide taller or wider than the screen, scroll with the mouse wheel or trackpad; the keys still change slides, as described in **Scrolling Slides**.

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

1. In the editor, click **Click to add speaker notes** in the strip under the slide. Drag the strip's top edge to make it taller.
2. Type your speaker notes for the current slide.
3. In present mode, press `S` to open the speaker view with notes, timer, and next-slide preview.

## Themes

Click **Theme** in the toolbar, or choose **Slide › Theme…**, to see the themes beside the slide; clicking one applies it:

- Black, White, League, Beige, Sky, Night, Serif, Simple, Solarized, Moon, Dracula, Bauhaus, Pixel, Mission, Turin, Gutter, Lemma, Beamline, Kourou, Ledger, Preprint, Transit, Trace, Prompt, Zenith, Quincunx, Partition, Holdout, Separatrix, Runlevel, Fanout, Cell

A theme sets the page, text, heading and link colors of every slide without a background of its own, in the editor and when presenting. A slide with its own background keeps it, with text colors that show on it. Colors you set on text take precedence over the theme's.

Bauhaus does a little more than set colors. It sets headings in lowercase, puts a short red rule under slide titles (Heading 2), and gives lists square red bullets. Its text is set in Jost until you pick a font in **Settings › Font**.

Mission is an engineering-drawing theme: a drafting grid on the page, headings in capitals in Barlow Condensed with a hairline under slide titles, text in IBM Plex Sans, red square bullets and code in B612 Mono.

Pixel is an 8-bit theme: headings in capitals in Press Start 2P with a purple drop shadow, text in Pixelify Sans, gold arrow bullets, and code in VT323. The Text tab's heading font and weight take precedence over its heading font.

Turin looks like a LaTeX Beamer talk. Content slides have a dark blue headline and a blue band behind the slide title, and every slide has a three-part footline. Title and section slides put the title in a rounded blue box. Bullets are blue triangles, and text is in Computer Modern Sans. A quote whose first line is a title becomes a Beamer block: a plain title makes a blue block, an *italic* title a green example block, and a **bold** title a red alert block.

Gutter is for talks with a lot of code. It draws a code editor's gutter down the left of each slide and its status bar along the bottom, and puts slide titles on a highlighted "current line" after `//`. Code is in JetBrains Mono on a dark background, with Gutter's own syntax colors whichever code theme the deck uses. A Heading 4 right before a code block becomes the block's file tab. A quote whose first line is a label becomes a callout: a plain label makes a note, an *italic* one a tip, and a **bold** one a warning. Text is in IBM Plex Sans.

Lemma is Beamer for mathematics, in a slate blue: content slides have a headline and a title bar, every slide a three-part footline, and title and section slides put the title in a box. Bullets are triangles and numbered lists count in shaded balls. A quote is a block titled by the bold or italic words it opens with: `> **Theorem 2 (IVT).** Let f be…` makes a theorem, whose statement is italic; italic words make a green example, and bold italic a red alert. A quote that opens with neither is an untitled block. Text is in Computer Modern Sans.

Beamline is a dark theme for particle physics. Slide titles have a beam under them, whose bunch flies in as a presented slide opens; the title slide is a collider ring with two bunches about to collide, and section slides sit on an event display. A Heading 4 is a kicker in blue capitals, a Heading 1 in a text box (and the Big Number) a figure in JetBrains Mono, and a quote a readout panel whose bold first line is its label. Headings are in Manrope, text in Inter.

Kourou is for space science: navy and red, with a navy strip and a red rule along the top of every slide. The title slide is a starfield and section slides sit on a mission timeline. A Heading 4 is a red tag, a Heading 5 a small navy label, a Heading 6 a gray caption, a Heading 1 in a text box (and the Big Number) a number that fades from red into navy, and italic words in a heading are red. A plain quote is a headline quote; one whose first line is **bold** is a blue notice, and *italic* a dark card. A bold link is a button and an italic one an arrow link. Headings are in Titillium Web, text in Arial.

Ledger looks like a spreadsheet, for pitches and anything with a model behind it: gridlines, column letters, row numbers and a sheet tab. Slide titles open with a formula bar's *fx*, the title slide's title and the Big Number are a selected range, and section titles are a sheet's tab. A Heading 1 in a text box is a figure in JetBrains Mono, inline code a cell reference in blue, and a quote a cell's comment whose bold first line is its label. Text is in Geist.

Preprint sets slides like a paper, in Computer Modern Serif on paper white. Content slides have a running head's rule, body text is justified, and a paragraph that follows another is indented. The title slide is a title block with the authors in small capitals, and section titles start with §. A quote is an abstract, narrower and smaller, whose **bold** first line is its centered heading. A Heading 5 is a footnote under a short rule, and a Heading 6 a figure caption. Tables are drawn with booktabs' rules, thick above and below and thin under the first row, and the page number sits centered at the foot of the page.

Transit looks like a transit map. Slide titles are stops with the line running in from the edge, bullets are stops along a line ending at a terminus, and numbered lists count in route bullets of different line colors. Section titles are station signs, the title slide sits on a route map, a quote is a yellow service notice, a table is a timetable and a Heading 4 is a route's tag. Turn on the footer's sections in sequence (**Settings › Footer**) and the footer becomes the route: the sections you've passed, the one you're in, and the ones to come, each in its line's color (a section's own color if you gave it one). Text is in Barlow.

Trace is for algorithms and data structures: a whiteboard's dot grid, titles in Figtree and code in Fira Code. The title slide's title sits over a row of cells mid-sort, and section titles and the Big Number are cells. A Heading 4 is a complexity chip, such as `O(n log n)`. A quote is a margin note, and one whose first words are **bold** (`> **Invariant.** …`) is a dashed callout. Numbered lists count from 0 in index cells, bullets are small cells, and tables have ink rules. With the footer's sections in sequence, they're a row of cells: done in teal, the current one dashed in amber.

Prompt is a terminal window. Every slide has the window's title bar, slide titles are commands typed after `~/talk $` with a blinking block cursor, and everything is in Fira Code on a dark window. Subtitles and quotes are `#` comments; a quote whose first words are **bold** is a yellow warning, and *italic* a red error. Bullets are `-` lines, numbered lists count as `cat -n` does, a Heading 4 is a command after `$`, and section slides are man pages, with NAME and DESCRIPTION. With the footer's sections in sequence, the footer is a tmux status bar, the current section marked `*`.

Zenith is for space-science talks, and is at its best with photographs. Text is Public Sans on black, headings Inter 800, and red marks what you can act on. Give a slide a background image and Zenith darkens it from the lower left, behind the words, and at the foot for the footer. The subtitle of a title or section slide is a label in spaced mono capitals. A Heading 4 is a topic tag, a Heading 5 a mono label, and a Heading 6 a caption whose **bold** words (the credit) are white. A link that is all **bold** is a link button with a red arrow. A big number gets a short red rule above it, a table's header row is in mono capitals, and a quote's last line is its source. The footer's sections in sequence are mono capitals, the current one over a red line.

Quincunx is for probability and statistics, drawn as a Galton board: glass-gray slides in dark ink, brass for samples, Rubik for text and Space Mono for numbers. Title and section slides are the board, a dark field with a triangle of pegs, and the title slide also has the bins the balls fell into, under the binomial curve. Slide titles have a hairline under them, and inline code in a heading is a sample-size badge: write `` `n = 1,000` `` in a slide title and it sits at the right as a pill. A Heading 4 is a kicker in mono capitals, bullets are brass balls, a quote is a verdict (one whose first words are **bold** has a brass edge), and code, tables and the Big Number are in Space Mono. With the footer's sections in sequence, each section is followed by a tally: a closed group of five once it's done, the brass ball on the one you're in, and faint strokes for those to come.

Partition is for linear algebra, and draws every slide as a partitioned matrix: brackets at its left and right edges, and a 2 px partition line from bracket to bracket under the title, between the columns of the column layouts, between a title slide's title and subtitle, and through a section slide. Headings are in Manrope 800 and text in Source Sans 3, with cobalt links. The Big Number sits between brackets of its own. A Heading 4 is a kicker in spaced capitals, bullets are small squares, and a quote is a check whose **bold** first words are its boxed label. Tables have hairlines, with partitions under the header row and after the first column. With the footer's sections in sequence, they're a row of square cells at the right, done in gray, the current one in ink with its name, so the deck reads as a basis vector.

Holdout is for machine learning, on a figure page: ink for structure, Rubik for text and Roboto Mono for numbers. Under every slide title is the train, validation and test split rule, solid, gray and hatched; the title slide's is wide, and a section slide's is wide and labeled. A Heading 4 is a kicker in mono capitals, and bullets take turns as a circle, a triangle and a square, the class markers. Tables are model cards, with an ink header row and numbers in mono, and so is a quote whose first words are **bold**, its label in the header band. With the footer's sections in sequence, the footer is a run strip: the page number first as the epoch, then the sections, done ones solid, the current one bold with a dot at its end, those to come dashed.

Separatrix is for dynamical systems: phase portraits in fading ink on a gray-green paper, with Fira Sans for text and Inconsolata for numbers. Every slide has a flow-field frame, streamlets circling toward a rounded rectangle just inside its edge, and section slides turn night, dark ink with paper text. Subtitles and a Heading 4 are kickers in spaced Inconsolata capitals, bullets are streamlets, thin to thick, and code, tables and the Big Number are in Inconsolata. A quote is a panel whose **bold** first words are its label. The page number reads `t = 3 / 11`, and with the footer's sections in sequence, the footer is a time ribbon: the sections behind you a trail that darkens toward the present, the current one starting at a filled dot, and those ahead dotted.

Runlevel is for Linux and systems talks, drawn as a text-mode configuration screen: each slide is a pale dialog with a hard shadow on a petrol field, titles in Roboto Mono and text in PT Sans. A content slide's title sits in the dialog's top rule, the title slide is a smaller dialog on the field, and a section slide's title is a menu entry on the selection bar. A Heading 4 is the path kicker, light on the field: put it in a text box above the dialog, as in `` #### /talk/files/**04-permissions** `o=rw-` ``, where the bold words are the slide's own name and inline code is the mode badge at the right. Anything else you place outside the dialog stays in dark text, so keep it inside. Subtitles are dim help lines, bullets small squares, numbered lists count `1)`, tables have their header row on the field, and code sits in a well. A quote is the kernel's ring buffer, log lines on the shadow color: one whose first words are **bold** is an amber warning, *italic* a red error. With the footer's sections in sequence, the footer is boot status: `[  OK  ]` for the sections done, an amber `[  *** ]` for the one in progress and `[      ]` for those to come.

Fanout is for SaaS architecture reviews: ink on a cool gray canvas, magenta only for links and the current hop, Asap Condensed for words and Inconsolata for labels and numbers. A subtitle's first line is the view tag, Inconsolata capitals in an ink outline, and its lines after it are labels. A Heading 4 is the same kicker, its **bold** words the tag and the rest its scope: put one above a slide title in the title's box, as in `#### **Container view** scope · billing`. The title slide has a request's path through a system along its foot. A section slide's title starts with the current hop's marker, and inline code in it is the hop number (`` `05` Failure and failover ``). The Big Number is a metric in Inconsolata, its unit a pill when you write it as inline code or in italics (`` 38 `ms` ``). Bullets are arrowheads, inline code a version chip, tables have hairlines and tabular figures, a quote is a decision record with an ADR label, and a Heading 6 is an as-of stamp. With the footer's sections in sequence, the footer is the hop path: each section a small box joined to the next by an arrow, solid for those done, magenta with a ring for the current one, dashed for those to come, and the page number reads `hop 2 / 11`.

Cell is for cell biology lectures, journal clubs and lab meetings, drawn as a stained slide: hematoxylin purple for text and headings on slide-glass white, eosin pink for links and what's current, and a DAPI blue for figure labels and counts. Headings are in Merriweather, a sturdy textbook serif, and text in Nunito Sans. Under content titles is a membrane, a phospholipid bilayer with a protein across it. The title slide has a slide's frosted label at its left end and a cell in cross-section at its right, with the title and subtitle set at the left beside it. Section slides turn to fluorescence: a dark field with nuclei in blue, cytoplasm in green and puncta in magenta, and a 10 µm scale bar. A Heading 4 is a figure-panel label in small capitals, its **bold** words in blue (`` #### **Fig. 2B** · Mitosis ``), and a Heading 6 a figure caption whose **bold** words are its number. The Big Number's unit, written as inline code or in italics (`` 8.5 `µm` ``), is a scale bar under the figure. Bullets are cells, with mitochondria under them; numbered lists count in blue; tables are a journal's, with a tinted header row; and a quote is a textbook box whose **bold** first words are its title (`> **Box 1 · The spindle checkpoint** …`). With the footer's sections in sequence, the footer is the cell cycle: the sections done are filled cells, the current one a dividing cell in pink, and those to come outlined.

Turin, Gutter, Lemma, Beamline, Ledger, Transit, Prompt and Partition draw their bands and pictures behind what's on the slide, so a full-slide image covers them. Kourou's starfield and timeline, Beamline's ring and event display, Ledger's headers and tab, Transit's route map, Quincunx's board, Separatrix's frame and night, Runlevel's dialog, Fanout's request path and Cell's title cell and fluorescence show only on slides without a background of their own.

### Your own colors

Open **Customize colors** at the top of the Colors tab to set the page, text, heading, link and accent colors over the theme's. The arrow next to a color puts it back to the theme's. Picking another theme clears them, since a theme brings its own colors.

### Theme CSS

The **CSS** tab holds a stylesheet for this deck's slides. It shows on the slide as you type, and carries through to the presented deck, shared links and PDF exports. Rules apply inside slides only, and can target:

| Target | What it is |
| --- | --- |
| `.px-slide` | every slide |
| `.px-slide[data-layout=section-header]` | slides in one layout (`title`, `title-content`, `two-column`, …) |
| `.px-text` | every text box |
| `[data-placeholder=title]` | a layout's title, subtitle or body |
| `var(--px-accent)` | the slide's colors: `--px-bg`, `--px-text`, `--px-heading`, `--px-link`, `--px-accent` |
| `.px-slide[data-own-background]` | slides with a background of their own |
| `.px-footer` | the footer, with `data-footer="sequence"` (its sections in a row) or `"basic"`; inside it `.px-footer-label`, `.px-footer-page` and `.px-footer-time` |
| `.px-footer-section[data-state=current]` | a section in the footer's sequence: `past`, `current` or `future` for this slide, with its color as `var(--px-section-color)` |

```css
[data-placeholder=title] h2 { border-bottom: 6px solid var(--px-accent); }
.px-slide[data-layout=section-header] { background: var(--px-accent); }
```

Some things are left out, and the CSS tab lists each one with its line: rules that reach outside the slide, `position: fixed`, at-rules other than `@media`, `@supports`, `@font-face` and `@keyframes`, and `url()` or `@import` from anywhere except your uploads, `data:` URLs and the font hosts decks already load (Google Fonts, cdnfonts, jsDelivr).

### Saving themes

**My themes**, at the top of the Colors tab, keeps the looks you save, to use in your other decks:

- **Save as theme** (**+**) saves this deck's theme, own colors, fonts, text styles and CSS under a name.
- Click a saved theme to use it in this deck. The deck keeps its own copy, so changing or deleting the saved theme never changes the deck by itself.
- After you change a deck's look, **Save changes to "…"** updates the saved theme it came from.
- When a saved theme has changed since a deck used it, the panel offers an **Update**, which replaces that deck's colors, fonts, text styles and CSS.
- **Export** downloads a theme as a `.parallax-theme.json` file, and **Import** saves one and applies it, for sharing themes between accounts.

## Footer & page numbers

1. Choose **Slide › Footer and page numbers…**.
2. Configure:
   - **Section labels** — show active section in a progress bar
   - **Page numbers** — `n/total` or just `n`
   - **Clock / Timer** — 12h clock, 24h clock, count-up or count-down timer

## Export options

### HTML

Choose **File › Export › HTML** to get a self-contained HTML file. All fonts, scripts, and images (if from URLs) are loaded via CDN. The file can be opened in any browser without a server.

### Single slide HTML

Choose **File › Export › This slide as HTML** to download just the current slide.

### PDF

Choose **File › Export › PDF** to generate a print-ready PDF with one page per slide. Fragment states are expanded into separate pages.

### PowerPoint

Choose **File › Export › PowerPoint (.pptx)** to generate a PowerPoint file. Text, shapes, and images are converted to native PowerPoint objects.

## Sharing

Sharing is only in the cloud version at parallax-presentations.com. The self-hosted version and the desktop app keep everything on your computer, so share an exported HTML file from them instead.

1. Click **Share**, next to **Present** at the top right, and choose **Share link…**.
2. Click **Enable Sharing**. A link to the presentation appears; click it to copy it.
3. Anyone with the link can view the presentation in present mode (read-only).
4. Click **Disable Sharing** to stop the link working. Sharing again makes a new link.

### Example: exported slide

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/parallax-presentations/demos/slide-export.html" style="width:100%;height:220px;border:none"></iframe>
</div>
