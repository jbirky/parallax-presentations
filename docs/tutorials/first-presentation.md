# Your First Presentation

This tutorial walks you through creating a complete presentation from scratch — from blank deck to exported HTML file.

## 1. Creating a new presentation

1. Open Parallax in your browser (default: `http://localhost:3002`).
2. On the home screen, click **New Presentation**.
3. A dialog appears asking you to name your presentation. Enter a name (e.g., "My First Deck").

## 2. Choosing a theme

The same dialog shows the themes as pictures, each one's title slide in its colors. **Black** is chosen, so **Create** alone skips this; for this tutorial, click **Sky**, then **Create**. You can change the theme any time later.

Under **Start from**, **Blank** starts from the Title Slide; your saved templates are beside it.

## Finding your way around

The editor is laid out like Google Slides, PowerPoint and Keynote:

- **The menu bar** at the top (File, Edit, View, Insert, Format, Slide, Tools, Help) has every command. **Help › Search the menus**, or `Alt+/`, finds one by name, such as "molecule" or "export".
- **The toolbar** under it is one row of the basics: Undo and Redo, **New slide**, **Text box**, **Image**, **Shape**, **Table**, **Insert** (everything else, in groups, with a search) and **Science** (graphs, diagrams, molecules and the rest of Parallax's own elements), then the deck's **Theme** and the slide's **Background**. Select an image and it offers **Crop** and **Replace**; select a diagram and it offers **Edit**. Select a text box and its formatting tools take the place of the insert tools; what doesn't fit is under **More**.
- **The inspector** on the right has three tabs. **Format** follows what's selected: a text box's text, its box, and how it's arranged. **Animate** has how it comes in, **Appear on click**, what clicking or hovering on it does, and the slide's transition. **Slide** has the slide's background and footer, with the rest folded under **Advanced**.
- **Speaker notes** go in the strip under the slide. Drag its top edge to make it taller.

## 3. Editing the title slide

You'll see a slide with two placeholders, empty boxes with gray hints: **Click to add title** and **Click to add subtitle**.

1. **Click the title placeholder** once and type your presentation title — for example, *Introduction to Reveal.js*.
2. Press `Escape` to finish editing the title.
3. **Click the subtitle placeholder** and type your name or a short description.
4. Press `Escape` again.

A placeholder's text gets smaller when it doesn't fit, as in PowerPoint and Google Slides. A placeholder you leave empty never shows when presenting or in exports.

To change the font size:
1. Double-click the title to re-enter edit mode.
2. Select all the text (`Ctrl+A`).
3. Use the font size box in the toolbar and change it to your preferred size.
4. Press `Escape`.

## 4. Adding a new slide

1. Click **New slide** at the top of the slide list or in the toolbar, or press `Ctrl+M`. It uses the layout that follows the current slide's (after a title slide, **Title and Content**); the ▾ beside **New slide** shows every layout, drawn in your theme.
2. The new slide appears right after the one you were on, and opens. To add one between two slides, point between them in the slide list and click **+**.
3. To give a slide another layout, choose **Slide › Change layout**, or right-click the slide and choose **Change layout…**. Its title and text move into the new layout's placeholders; anything else on it stays where it is.

## 5. Adding a text box and an image

**Add a text box:**
1. Click **Text box** in the toolbar, or choose **Insert → Text box** in the menu bar.
2. A text box appears. Double-click it and type some content.
3. Use the toolbar to format your text (bold, color, size, etc.).

**Add an image:**
1. Click **Image** in the toolbar and choose **Upload image…** (or **Insert → Image → Upload image…**).
2. A file picker opens. Choose an image from your computer.
3. The image appears on the slide. Drag it to position it, and drag the corners to resize.

## 6. Applying a theme

1. Click **Theme** in the toolbar (or choose **Slide → Theme…**). The themes open beside the slide, as pictures.
2. Click **White** (or any theme). It applies at once: every slide without a background of its own takes the theme's page, text and heading colors. Click others to compare; **Edit → Undo** goes back.
3. A slide with a background of its own keeps it, with text colors that show on it. Choosing a theme also gives the theme's page to slides that still have the old dark default from before themes showed in the editor.

## 7. Adding a slide transition

1. Click on a slide in the left panel to select it.
2. Open the inspector's **Animate** tab on the right (or choose **Slide → Transition…**).
3. Under **Transition**, choose **Fade** from the dropdown.
4. You can also set the transition speed.

## 8. Presenting

1. Click the **Present** button (play icon) in the top toolbar, or press `F`.
2. The presentation enters full-screen mode via reveal.js.
3. Use the **arrow keys** to advance slides.
4. Press **S** to open the **speaker notes** window in a separate browser tab.
5. Press **Escape** to exit full-screen.

## 9. Exporting as HTML

1. Click **File → Export → HTML**.
2. Save the `.html` file to your computer.
3. Open the file in any browser — your presentation is self-contained and shareable.

::: tip
If you plan to present without an internet connection (e.g., at a conference), choose **File → Export → Offline HTML** instead to inline all assets.
:::

Congratulations — you've built and exported your first presentation!

**Next steps:**
- [Academic Slides tutorial](/tutorials/academic-slides) — footers, LaTeX, two-column layouts
- [Using LaTeX & Math](/tutorials/using-latex) — deep dive on equations and TikZ diagrams
