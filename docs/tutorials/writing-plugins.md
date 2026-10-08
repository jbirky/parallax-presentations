# Writing Plugins

A plugin is a web page that draws one kind of slide element. Parallax shows the page in a sandboxed frame, gives it the element's settings, and saves the settings it changes. You keep the plugin in a public GitHub repo; Parallax imports a version from a tag, and an admin reviews it before it's listed in the [gallery](https://parallax-presentations.com/plugins).

Start from the [plugin template](https://github.com/jbirky/parallax-plugin-template): choose **Use this template**, and on its first push your new repo names the plugin after itself. It has a working example, a build with no dependencies, tests, and `npm run check`, which applies the rules on this page. [Exoplanet plot](https://github.com/jbirky/parallax-exoplanets) is a larger plugin made the same way.

## The repo

At the tag you publish, the repo holds:

```
parallax-plugin.json   the manifest
README.md              shown on the plugin's page in the gallery
dist/
  sandbox.html         the element's page
  icon.svg             optional: an .svg or .png
```

Commit the built files in `dist/`. Parallax imports what's in the repo at the tag, checks each file against the commit, and never builds or runs anything there. A version can have at most 40 files in `dist/`, 2 MB in all and 1 MB each, and no symbolic links.

## The manifest

```json
{
  "id": "io.github.you.orbits",
  "name": "Orbits",
  "version": "1.0.0",
  "description": "Kepler orbits you can drag, with the areas swept out in equal times.",
  "license": "MIT",
  "author": { "name": "Your Name", "url": "https://github.com/you" },
  "homepage": "https://github.com/you/parallax-orbits",
  "sandbox": "./sandbox.html",
  "icon": "./icon.svg",
  "categories": ["physics", "astronomy"],
  "keywords": ["Kepler", "orbits"],
  "permissions": [],
  "contributes": {
    "elementTypes": [
      {
        "type": "kepler-orbits",
        "label": "Kepler orbits",
        "defaultSize": { "width": 640, "height": 420 },
        "defaultData": { "eccentricity": 0.5 }
      }
    ]
  }
}
```

| Field | Rule |
| --- | --- |
| `id` | Lower-case reverse-DNS, such as `io.github.you.orbits`. Decks find a plugin by its id, so it can't change once your repo has used it, and no other repo can take it. Ids starting with `com.parallax.` are kept for Parallax. |
| `version` | Semver, the same as the tag: tag `v1.2.0` or `1.2.0` needs `"version": "1.2.0"` |
| `name`, `description` | Required, at most 60 and 300 characters |
| `license` | Required: an SPDX id, such as `MIT` |
| `sandbox` | Required: the page, an `.html` file in `dist/` |
| `icon` | Optional: an `.svg` or `.png` in `dist/`, shown in the gallery |
| `homepage`, `author` | Optional; links must be `https` |
| `categories` | Optional, at most 3 of: math, physics, chemistry, biology, astronomy, data, computer science, teaching, other |
| `keywords` | Optional, at most 10, each at most 30 characters; the gallery's search reads them |
| `permissions` | The hosts the page may reach, each as `network:<host>`, such as `network:cdn.jsdelivr.net` or `network:*.example.org`. At most 20. |
| `contributes.elementTypes` | 1 to 10 element types. `type` is lower-case letters, digits and hyphens, at most 40, and can't be one another plugin already uses. `label` is required, at most 60 characters. `defaultSize` is 20 to 4,000 pixels each way. `defaultData`, at most 64 KB, is what a new element's settings start as. |

Community plugins can't have `main`, a script that would run inside the editor itself, or the contributions that need one (`toolbarItems`, `propertyPanels`, `exportHooks`, `dataProcessors`). An import that has them is refused, with the rule it breaks.

## The page

`sandbox.html` is one self-contained page. Parallax writes it into the frame directly, so links to other files in `dist/` lead nowhere. Put scripts, styles and data in the page, or load libraries from a host your `permissions` list.

The frame is the element's size, so size the page to `window.innerWidth` and `window.innerHeight` and redraw on `resize`. Leave the page's background transparent to let the slide show through, or offer a setting for it.

In the editor, the element takes clicks and hovers only while it's selected. When the deck is presented, it always does.

## Talking to Parallax

Parallax puts `window.parallax` in the page before the page's own scripts run.

| Call | What it does |
| --- | --- |
| `parallax.data` | The element's settings: a copy, starting from `defaultData` |
| `parallax.onDataChanged(fn)` | Calls `fn` with the settings when they change: when the editor first sends them, after **Undo**, or when someone editing with you changes them |
| `parallax.updateData(patch)` | Merges `patch` into the settings. In the editor, the change is saved and can be undone. In a presented deck, it lasts for the talk. |
| `parallax.width`, `parallax.height`, `parallax.onResize(fn)` | The element's size |
| `parallax.datasets` | The deck's datasets: `list()`, `schema(name)`, `query(name, { columns, limit, offset })` and `load(name)`, as [Live Datasets](./live-datasets.md#datasets-in-html-p5-and-plugin-elements) describes |
| `parallax.fetch(url, options)` | `fetch`, for the hosts your `permissions` list |
| `parallax.reportError(message)` | Writes the message in the editor's console |

In the editor, `parallax.data` is empty until the editor sends the settings, a moment after the page loads. Draw from it, and again whenever it changes:

```js
function draw(settings) {
  // …
}
draw(parallax.data)
parallax.onDataChanged(draw)
```

A presented deck carries only the datasets its elements name. A dataset's name in an element's settings counts, so keep the name the person chose in the element's data, as `parallax.datasets.query` needs it.

## What the page can reach

The page runs in a sandbox with an origin of its own. It can't read cookies or the rest of Parallax, and `localStorage` throws, so keep anything that should last in the element's settings.

It can load and fetch only from the hosts its `permissions` list, over `https`. Inline scripts and styles, `data:` and `blob:` addresses work; everything else is blocked, including images and fonts from other sites. A plugin that lists no hosts works offline and in exported decks.

## Trying it out

Open `dist/sandbox.html` in a browser on its own. `window.parallax` isn't there, so start from your defaults when it's missing, as Exoplanet plot does. Test what you can as plain functions; Exoplanet plot's tests also check `dist/` against its sources and the manifest against these rules.

## Publishing

1. Tag the commit with the version, such as `v1.0.0`, and push the tag.
2. In the editor, open **Plugins › Browse plugins… › Publish**. Paste the repo's address, choose **Look up**, pick the tag and choose **Import**. If the plugin breaks a rule, the import is refused and each rule it breaks is listed.
3. An admin reviews the version. They see its commit, the hosts it may reach, its files, the changes since its last approved version, and the plugin running with its default settings. **Your imports**, under **Publish**, shows its status and any note they leave.

Once a version is approved, the plugin is listed in the gallery and under **Browse**.

## New versions

Change the version in `parallax-plugin.json`, build, commit, tag and push the tag. Each night Parallax looks for new version tags in listed plugins' repos and imports them for review; to have one reviewed sooner, import it under **Publish** yourself.

Decks keep the version their elements were inserted with. When a newer one is approved, the editor offers it to whoever opens a deck that uses the plugin, so keep a version's settings readable by the next: add new settings with defaults rather than renaming old ones.
