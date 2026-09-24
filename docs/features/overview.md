# Feature Overview

A high-level tour of everything Parallax can do.

## Editing

Parallax is built around a drag-and-drop canvas. Every element on a slide — text boxes, images, shapes, code blocks, LaTeX blocks, charts — can be:

- **Clicked to select** and dragged to reposition
- **Resized** by dragging corner or edge handles (hold `Shift` to lock aspect ratio)
- **Rotated** by dragging the rotation handle above the element (hold `Shift` to snap to 15°)
- **Layered** using bring-forward / send-backward controls
- **Aligned** with the built-in alignment toolbar

An undo/redo stack tracks every change (`Ctrl+Z` / `Ctrl+Y`).

## Element Types

| Element | Description |
|---|---|
| Text box | Rich text with TipTap — headings, bold/italic/underline, lists, tables, inline math |
| Image | Upload or paste images; resize and reposition freely |
| Shape | Rectangle, circle, arrow, line — filled or outlined, any color |
| Code block | Syntax-highlighted code via highlight.js; supports 100+ languages |
| LaTeX block | Display math and TikZ diagrams with live split-pane preview |
| Chart | Bar, line, and scatter charts powered by Chart.js |
| Embed | Iframe embeds for web content |

::: tip
To insert a new element, right-click on the slide canvas or use the **Insert** toolbar at the top of the editor.
:::

## Slides

- **Add, duplicate, delete** slides from the panel on the left
- **Reorder** by drag-and-drop in the panel
- **Vertical stacks** — nest slides below a parent for reveal.js-style vertical navigation
- **Per-slide background** — solid color, gradient, or image
- **Speaker notes** — each slide has an optional notes pane visible in presenter mode
- **Slide transitions** — choose from reveal.js transitions (fade, slide, zoom, convex, concave, none)

## Footer System

The footer system lets you define a **section sequence** shown at the bottom of every slide — useful for academic talks.

- Define named sections (e.g., Introduction, Methods, Results, Discussion)
- Each section's progress dot highlights as you advance through slides
- Customizable font, size, and color to match your theme

## Themes & Templates

- **11 built-in reveal.js themes**: Black, White, League, Beige, Sky, Night, Serif, Simple, Solarized, Moon, Dracula
- **Custom templates**: Save any slide as a reusable template to re-use across presentations
- **Per-slide overrides**: Change the background image or color on individual slides without affecting the rest of the deck

## Export & Sharing

- **Standalone HTML** — a single `.html` file that plays reveal.js from CDN
- **Offline HTML** — all CDN assets inlined; works without internet access
- **PDF** — print-ready via browser print dialog with all fragments expanded
- **PPTX** — PowerPoint-compatible export
- **Shareable link** — generate a URL to share a read-only or editable view (cloud version only)
- **GitHub push** — commit your presentation directly to a GitHub repository

See [Export & Sharing](/features/export) for details.

## Version History

Parallax maintains a local version history for each presentation:

- Automatic snapshots on save
- Browse and restore any previous version
- Diff view shows which slides changed between versions
