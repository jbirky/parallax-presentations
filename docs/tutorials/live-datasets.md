# Live Datasets

A live dataset comes from a web address or a TAP query instead of a file you upload. Parallax fetches it when you make it and again on the schedule you choose, so a deck that uses it keeps up with the data. Each time the data changes, Parallax keeps the new version; the last five, and any a deck holds on to, stay.

Datasets reach slides through a graph's data lines (see [Graphs](./graphs.md#plotting-data)), through HTML, p5 and plugin elements, with `parallax.datasets` (see [below](#datasets-in-html-p5-and-plugin-elements)), and through plugins' own code, with `ctx.datasets.query("name")`. Open them from the **Data** button at the top of the editor.

## Making one

In the Datasets window, choose **Add**, then **From a URL** or **From a TAP query**.

| Source | What to give it |
| --- | --- |
| **URL** | The address of a CSV, TSV or JSON file. A Google Sheet works through its published CSV link. For JSON whose rows sit inside it, say where: `data.items`. |
| **TAP query** | A TAP service and an ADQL query. The NASA Exoplanet Archive, Gaia, IRSA, SIMBAD and VizieR are filled in for you; any other TAP service works too. |

Choose **Test** to fetch it once and see its columns and first rows. When the source refuses, you see why in its own words, such as a TAP service's `ORA-00904: 'NOSUCHCOL': invalid identifier`.

Then give it a name and choose how often it refreshes: hourly, daily, weekly, or only when you press **Refresh**. A **key column**, such as a planet's name, is optional: with one, data that comes back in another order isn't counted as a change.

A source that needs a key takes one header, written `Name: value` (for example `X-API-Key: abc123`). It's stored encrypted and never shown again.

### An example: every exoplanet with a mass

From a TAP query, with the NASA Exoplanet Archive:

```sql
select pl_name, pl_orbper, pl_bmasse, pl_bmassprov, discoverymethod, disc_year
from pscomppars
where pl_orbper is not null and pl_bmasse is not null
```

Use `pscomppars`, which has one row per planet; `ps` has one per planet per paper. Make `pl_name` the key column.

## Refreshing

A live dataset refreshes on its schedule while some deck uses it (it's linked to the deck). Others wait until you press **Refresh**, which you can do once a minute.

When a fetch fails, the dataset keeps the version it had, shows the error, and tries again in 15 minutes, then 30, and so on, never later than its schedule. After 10 failures in a row it stops until you press **Refresh**.

## Versions and pinning

The **Versions** tab lists the saved versions and the recent fetches. **Pin for this deck** holds the deck at one version whatever later fetches bring, which is handy for a talk you've rehearsed. **Unpin** follows the newest again. Pinning is per deck: other decks keep their own.

## Steps: shaping the data

The **Steps** tab shapes any dataset, live or uploaded, before slides get it. Steps run in order on every read, so they follow each refresh, and a pinned version gets them too. The table under them shows what slides get, as you edit.

| Step | What it does |
| --- | --- |
| **Keep rows** | Keeps the rows an expression is true for: `pl_bmasse > 10 and disc_year >= 2000` |
| **Add a column** | A new column from an expression: `mass_mj = pl_bmasse / 317.83` |
| **Keep columns** | Only the columns you list, in that order |
| **Rename a column** | Gives a column a new name |
| **Sort** | Orders rows by a column; missing values go last |
| **Group and count** | One row per group, with `count`, `sum(…)`, `mean(…)`, `min(…)`, `max(…)` or `median(…)`; add `as name` to name the result |
| **Histogram bins** | Counts values in even or log-spaced bins, empty bins included |
| **2D bins** | Counts pairs of values in a grid of bins, for a density plot of a large dataset |
| **Join another dataset** | Adds columns from another of your datasets where a column matches |
| **First rows** | Keeps only the first rows |

Expressions use the Graph tool's functions and constants: `sqrt`, `exp`, `ln` (natural), `log` (base 10), `log2`, `sin`, `abs`, `round`, `min`, `max`, `mod`, `pi`, `e` and more, plus `if(condition, a, b)`, `isnull(x)` and `coalesce(x, y)`. Text goes in quotes: `discoverymethod == "Transit"`.

Unlike in a graph, a name is a whole column name, so write `*` between two names: `a * b`. A number right before a name still multiplies it, as in `2pi`. Put a column whose name has spaces or symbols in backticks: `` `mass (kg)` * 1000 ``. A missing value stays missing: `pl_bmasse * 2` is empty where `pl_bmasse` is.

If a refresh drops a column a step uses, reading the dataset says which step and why, and the last good version stays in place.

## Data in presented decks

A presented deck carries the data its slides read: share links, live sessions, Present, exported HTML files, and decks published to GitHub or Zenodo. It works offline and never waits on a source.

| Where | Which data |
| --- | --- |
| Share links and live sessions | The version the deck pins, or the newest, when someone opens the page |
| Exported HTML files, GitHub and Zenodo | The data as it was when you exported or published |
| PDF | Graphs drawn with the data the editor has |

A graph carries only the columns it plots, up to 200,000 rows of a dataset. Everyone who opens a share link downloads the data in it, so trim large datasets with **Steps** (keep the columns and rows the slide needs, or bin them) before sharing.

## Datasets in HTML, p5 and plugin elements

HTML embeds, p5 sketches and plugins read a deck's datasets with `parallax.datasets`. Every call returns a promise:

```js
parallax.datasets.query("exoplanets", { columns: ["pl_orbper", "pl_bmasse"], limit: 1000 })
  .then(({ columns, totalRows }) => {
    // columns.pl_orbper and columns.pl_bmasse are arrays, one value per row
  })
```

| Call | What it gives |
| --- | --- |
| `list()` | The deck's datasets: each one's `name`, `columns`, `rowCount`, and `asOf`, when its data was last fetched or uploaded |
| `schema(name)` | A dataset's columns |
| `query(name, { columns, limit, offset })` | `{ columns, totalRows }`: the columns asked for (all of them by default), from row `offset` on |
| `load(name)` | Resolves once the dataset can be read |

A dataset is called by the name the deck links it under. Write that name in quotes in the element's code, as above, or in a plugin's settings: a presented deck carries only the datasets its elements name that way, whole, up to 200,000 rows each and 2 million values in all. Calls answer the same in the editor as in a presented deck, so what works on the canvas works in a talk. A dataset that isn't linked, or isn't named in quotes, is refused with a message saying so.

## Plans

| Plan | Live datasets | Fastest refresh |
| --- | --- | --- |
| Free | 1 | Daily |
| Pro | 25 | Hourly |

Every kept version counts toward your storage. A single fetch can be up to 100 MB.

## Self-hosting

Live datasets are on in self-hosted Parallax and the desktop app, where they're fetched from your own computer and only while Parallax runs; it catches up when it starts. These settings change what the server may fetch:

| Setting | What it does |
| --- | --- |
| `PARALLAX_LIVE_DATASETS=off` | Turns live datasets off |
| `PARALLAX_FETCH_ALLOW_PRIVATE=1` | Lets the server fetch from your own network (private addresses, any port) |
| `PARALLAX_FETCH_HOSTS=example.org,caltech.edu` | Fetches only from these hosts and their subdomains |

Without `PARALLAX_FETCH_ALLOW_PRIVATE`, the server refuses addresses inside its own network, including after a redirect, and takes only http and https on ports 80 and 443.
