# HTML Embeds & p5.js

Embed custom interactive content directly on your slides — D3 visualizations, canvas animations, arbitrary HTML, or p5.js sketches.

## HTML / D3 embed

1. Open **Insert** in the toolbar and, under **Embed**, click **D3** (or **HTML** for an empty page).
2. A code editor opens with a starter D3 scatter plot.
3. Write any valid HTML — the content renders inside a sandboxed iframe.
4. Click **Apply** to insert. The element previews live on the slide.

The embedded HTML is completely self-contained. It works in present mode, exported files, and shared links. External scripts (D3, Three.js, etc.) can be loaded via CDN.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/parallax-presentations/demos/d3-scatter.html" style="width:100%;height:220px;border:none"></iframe>
</div>

### Editable content

An embed can keep its words and numbers in a block of JSON instead of in its script. Parallax then shows that block as a form, so anyone can change the text without reading the code. The Design review template's embeds work this way.

```html
<script type="application/json" data-parallax-content>
{
  "caption": "Parts list",
  "parts": [
    { "item": 1, "description": "Payload fairing" },
    { "item": 2, "description": "Upper stage" }
  ]
}
</script>
<table id="parts"><caption></caption><tbody></tbody></table>
<script>
  const content = JSON.parse(document.querySelector('[data-parallax-content]').textContent)
  document.querySelector('#parts caption').textContent = content.caption
  for (const p of content.parts) {
    const row = document.querySelector('#parts tbody').insertRow()
    row.insertCell().textContent = p.item
    row.insertCell().textContent = p.description
  }
</script>
```

Double-click an embed with a content block, or click **Edit Content…** in the right panel, to open the form beside a preview of the embed. The **Code** tab still has the whole page. The form shows:

- each word or sentence as a text box, each number as a number box, and each true or false as a checkbox;
- a list of words or numbers as one item per line;
- a list of records, such as `parts` above, as a table: one column per field, with buttons to add, move and remove rows;
- a group of fields, `{ … }`, as its fields, indented.

Two optional keys tune the form. Keys that start with `$` aren't shown as fields:

- `"$labels": { "dv": "Δv (km/s)" }` names a field. Without a label, `altitudeKm` shows as "Altitude km".
- `"$choices": { "status": ["Open", "In work", "Closed"] }` turns a field into a menu wherever it appears.

Set text with `textContent`, not `innerHTML`, so a `<` typed into the form shows as itself.

## p5.js sketches

1. Open **Insert** in the toolbar and, under **Embed**, click **p5.js**.
2. A code editor opens pre-loaded with the p5.js library.
3. Write your p5.js sketch using `setup()` and `draw()`.
4. Click **Apply**. The sketch renders live on the slide.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/parallax-presentations/demos/p5-stars.html" style="width:100%;height:220px;border:none"></iframe>
</div>

## Tips

- HTML embeds receive `EMBED_WIDTH` and `EMBED_HEIGHT` as JavaScript globals — use them to size your canvas responsively.
- Press the **Preview Slide** button in the right panel to test your embed in present mode without navigating through the full deck.
- Embeds support mouse interaction in present mode — hover effects, click handlers, and scroll all work inside the iframe.
- HTML embeds and p5 sketches can read the deck's datasets with `parallax.datasets.query("name")`, in the editor and when presented. See [Live Datasets](./live-datasets.md#datasets-in-html-p5-and-plugin-elements).
