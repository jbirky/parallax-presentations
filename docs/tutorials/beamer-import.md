# Slides from LaTeX Beamer

Bring a Beamer talk into Parallax, or write frames in Beamer and get slides. Each frame becomes slides you edit like any other: text boxes with math, lists, figures, tables, code and TikZ, with `\pause` as steps you click through.

## Adding slides to a presentation

1. Click **Import Slide** under the slide list, then **From LaTeX Beamer**.
2. Type or paste Beamer source on the left: a whole document, or just some frames. The slides appear on the right as you type. **Start from an example** fills in a short talk to try.
3. Click a frame to leave it out, or **Select none** and pick the ones you want.
4. Click **Add slides**. They go in after the slide you're on.

## Starting a new presentation

On the dashboard, click **From Beamer**. It's the same window; **Create presentation** makes a deck named from the talk's `\title`, the shape of its `aspectratio` (change it under **Size**).

## A whole project

Drop the main `.tex` on the window, or the project's `.zip` as Overleaf downloads it (**Menu → Download → Source**), or click **Choose files**. With it come:

- the figures `\includegraphics` names, looked for as LaTeX looks, in the `\graphicspath` folders too. PDF figures are drawn as images. They're uploaded when you add the slides.
- the files `\input` and `\include` bring in.
- the `.bib` files. The references the slides cite join the bibliography, and the references slide is made for you. A reference the presentation already has is cited as it is.

You can drop more files later, such as figures the first drop didn't have.

## What carries over

| Beamer | In Parallax |
|---|---|
| Frames, `\frametitle`, `\framesubtitle` | A slide, its title in a text box the outline reads |
| `\titlepage` | A title slide from `\title`, `\subtitle`, `\author`, `\institute` and `\date` |
| `itemize`, `enumerate`, `description` | Lists, nested as they were |
| `$…$`, `\[…\]`, `equation`, `align`, `gather` | Math in the text, drawn by KaTeX |
| `\newcommand`, `\DeclareMathOperator`, `\def`, `\newenvironment` | Expanded where they're used |
| `block`, `alertblock`, `exampleblock`, `theorem` and the like | A tinted box with its title |
| `columns`, side-by-side `minipage`s | Side by side, at their widths |
| `figure`, `\includegraphics`, `\caption` | Images, sized as the source asks |
| `tabular` | A table; one with math in it stays LaTeX |
| `tikzpicture` | A LaTeX element, drawn by TikZJax with the preamble's `\usetikzlibrary` |
| `verbatim`, `lstlisting`, `minted` | Code, in its language |
| `\cite` and its kin | Citations |
| `\footnote` | Small text at the foot of the slide |
| `\note` | Speaker notes |
| `\section`, `\subsection` | Sections, and the slide each `\AtBeginSection` frame makes |
| `\textbf`, `\emph`, `\alert`, `\textcolor`, `\href`, sizes | The same, in the text |

Text is the size it was on the frame, and a frame with too much on it is shrunk until it fits.

## Steps

Choose how `\pause` and overlay specifications like `<2->` come across under **Steps**:

- **Build up each slide**: parts appear one step at a time, as fragments. A frame whose parts also go away (`\only`, `\alt`, `<1-2>`) becomes a slide per step instead, as Beamer makes pages.
- **A slide per step**: every frame with steps becomes a slide per step.
- **Final step only**: each frame as its last step shows it.

## Look

**Light** is Beamer's: a white slide with titles and bullets in its blue, or in the source's own colors from `\setbeamercolor{structure}`. **Dark** suits Parallax's dark slides. Adding to a presentation starts with the one that suits the slide you're on.

## What doesn't carry over

Anything the window can't bring over is listed above the slides, with the frames it's in.

- Beamer's themes: their headlines, footlines and navigation. Only their colors come across.
- `\ref` and `\eqref`, which show as “?”.
- EPS figures: convert them to PDF or PNG first.
- Commands from packages Parallax doesn't know keep their text, and are named in the list.
- Figures that aren't among the files show as boxes with their names. Drop them in to fill them.
