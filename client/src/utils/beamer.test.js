import { describe, it, expect } from 'vitest'
import { readBeamer, plainText, specVis, resolveOverlays, resolveColor, parseLength, mathEnvTex, visibleAt } from './beamer'

const doc = body => `\\documentclass{beamer}\n\\begin{document}\n${body}\n\\end{document}`
const frames = src => readBeamer(src).frames
const text = b => plainText(b.runs)

describe('reading a Beamer document', () => {
  it('reads the title page, sections and frames, with titles given either way', () => {
    const d = readBeamer(`\\documentclass[aspectratio=169,12pt]{beamer}
\\title[Short]{A \\emph{long} title}
\\subtitle{Sub}
\\author{Ada \\and Grace}
\\institute{Somewhere}
\\date{1 May 2026}
\\begin{document}
\\frame{\\titlepage}
\\section{Intro}
\\begin{frame}{First}{With a subtitle}
Hello.
\\end{frame}
\\begin{frame}
\\frametitle{Second}
\\framesubtitle{Sub two}
Again.
\\end{frame}
\\end{document}`)
    expect(d.size).toMatchObject({ width: 160, height: 90, pt: 12 })
    expect(plainText(d.meta.title)).toBe('A long title')
    expect(plainText(d.meta.author)).toBe('Ada, Grace')
    expect(plainText(d.meta.date)).toBe('1 May 2026')
    expect(d.sections).toEqual([{ name: 'Intro', subsections: [] }])
    expect(d.frames.map(f => plainText(f.title))).toEqual(['', 'First', 'Second'])
    expect(d.frames[0].blocks[0].kind).toBe('titlepage')
    expect(plainText(d.frames[1].subtitle)).toBe('With a subtitle')
    expect(plainText(d.frames[2].subtitle)).toBe('Sub two')
    expect(d.frames[1].section).toBe('Intro')
    expect(text(d.frames[2].blocks[0])).toBe('Again.')
  })

  it('takes frames on their own, without a document around them', () => {
    const fs = frames('\\begin{frame}{Only frames}\nSome text\n\\end{frame}\n\\begin{frame}{Two}x\\end{frame}')
    expect(fs.map(f => plainText(f.title))).toEqual(['Only frames', 'Two'])
  })

  it('leaves out comments, and keeps verbatim text as written', () => {
    const [f] = frames(doc(`\\begin{frame}[fragile]{Code}
Kept % dropped
\\begin{lstlisting}[language=Python]
x = 1  # 50% of it, \\textbf{not} a command
\\end{lstlisting}
Inline \\verb|a%b| too.
\\end{frame}`))
    expect(text(f.blocks[0])).toBe('Kept')
    expect(f.blocks[1]).toMatchObject({ kind: 'code', language: 'python', text: 'x = 1  # 50% of it, \\textbf{not} a command' })
    expect(text(f.blocks[2])).toBe('Inline a%b too.')
    expect(f.blocks[2].runs.find(r => r.text === 'a%b').m.tt).toBe(true)
  })

  it('expands the source’s own commands, with arguments and defaults', () => {
    const [f] = frames(`\\documentclass{beamer}
\\newcommand{\\R}{\\mathbb{R}}
\\newcommand{\\pair}[2][x]{(#1, #2)}
\\renewcommand\\vec[1]{\\mathbf{#1}}
\\DeclareMathOperator*{\\argmax}{arg\\,max}
\\def\\who{Ada}
\\newenvironment{note}[1]{\\textbf{#1:}}{.}
\\begin{document}
\\begin{frame}
$\\R \\pair{y} \\pair[a]{b} \\vec{v} \\argmax_x$ by \\who{} \\begin{note}{Mind}careful\\end{note}
\\end{frame}
\\end{document}`)
    const runs = f.blocks[0].runs
    expect(runs.find(r => r.t === 'math').tex).toBe('\\mathbb{R} (x, y) (a, b) \\mathbf{v} \\operatorname*{arg\\,max}_x')
    expect(plainText(runs)).toContain('by Ada Mind:careful.')
  })

  it('stops expanding a command that refers to itself, even one that grows', () => {
    const d = readBeamer(doc('\\newcommand{\\loop}{\\loop x}\\begin{frame}\\loop\\end{frame}'))
    expect(d.warnings.some(w => /refer to themselves/.test(w.message))).toBe(true)
    const t = performance.now()
    const grown = readBeamer(doc('\\newcommand{\\b}[1]{#1#1#1#1\\b{#1#1}}\\begin{frame}\\b{xyz}\\end{frame}'))
    expect(performance.now() - t).toBeLessThan(2000)
    expect(grown.warnings.some(w => /refer to themselves/.test(w.message))).toBe(true)
  })

  it('brings in \\input files from those given', () => {
    const files = new Map([['sections/intro.tex', '\\begin{frame}{From a file}x\\end{frame}']])
    const d = readBeamer(doc('\\input{sections/intro}\n\\input{missing}'), { files })
    expect(d.frames.map(f => plainText(f.title))).toEqual(['From a file'])
    expect(d.warnings.map(w => w.message).join()).toMatch(/missing/)
  })

  it('writes accents, dashes, quotes and symbols as characters', () => {
    const [f] = frames(doc("\\begin{frame}Schr\\\"odinger -- caf\\'e --- ``quoted'' \\ldots~\\& 100\\%\\end{frame}"))
    expect(text(f.blocks[0])).toBe('Schrödinger – café — “quoted” … & 100%')
  })
})

describe('content', () => {
  it('reads nested lists, numbered lists and labels', () => {
    const [f] = frames(doc(`\\begin{frame}
\\begin{itemize}
  \\item One
  \\begin{enumerate}
    \\item Inner
  \\end{enumerate}
  \\item[$\\star$] Two
\\end{itemize}
\\begin{description}
  \\item[Term] Meaning
\\end{description}
\\end{frame}`))
    const [list, desc] = f.blocks
    expect(list.kind).toBe('list')
    expect(list.items.map(i => text(i.blocks[0]))).toEqual(['One', 'Two'])
    expect(list.items[0].blocks[1]).toMatchObject({ kind: 'list', type: 'enumerate' })
    expect(list.items[1].label[0]).toMatchObject({ t: 'math', tex: '\\star' })
    expect(desc.type).toBe('description')
    expect(plainText(desc.items[0].label)).toBe('Term')
  })

  it('turns display math environments into what KaTeX draws', () => {
    expect(mathEnvTex('align*', 'a &= b \\label{x} \\\\ c &= d \\nonumber')).toBe('\\begin{aligned}a &= b  \\\\ c &= d\\end{aligned}')
    expect(mathEnvTex('gather', 'a \\\\ b')).toBe('\\begin{gathered}a \\\\ b\\end{gathered}')
    expect(mathEnvTex('eqnarray', 'a &=& b')).toBe('\\begin{array}{rcl}a &=& b\\end{array}')
    expect(mathEnvTex('alignat*', '{2} a &= b')).toBe('\\begin{alignedat}{2} a &= b\\end{alignedat}')
    const [f] = frames(doc('\\begin{frame}\\[ x^2 \\] and $$ y $$ \\begin{equation} z \\end{equation}\\end{frame}'))
    expect(f.blocks.filter(b => b.kind === 'math').map(b => b.tex)).toEqual(['x^2', 'y', 'z'])
  })

  it('reads columns with their widths', () => {
    const [f] = frames(doc(`\\begin{frame}
\\begin{columns}[T]
\\begin{column}{0.6\\textwidth} Left \\end{column}
\\begin{column}{4cm} Right \\end{column}
\\end{columns}
\\begin{columns}
\\column{.5\\linewidth} A
\\column{.5\\linewidth} B
\\end{columns}
\\end{frame}`))
    expect(f.blocks[0]).toMatchObject({ kind: 'columns', valign: 'top' })
    expect(f.blocks[0].cols.map(c => c.width)).toEqual([{ v: 0.6, unit: 'tw' }, { v: 40, unit: 'mm' }])
    expect(f.blocks[1].cols.map(c => text(c.blocks[0]))).toEqual(['A', 'B'])
  })

  it('reads Beamer’s blocks and theorems with their titles', () => {
    const [f] = frames(doc(`\\begin{frame}
\\begin{block}{Idea} Body \\end{block}
\\begin{alertblock}{Careful} Watch out \\end{alertblock}
\\begin{exampleblock}{For instance} This \\end{exampleblock}
\\begin{theorem}[Euler] $e^{i\\pi}=-1$ \\end{theorem}
\\end{frame}`))
    expect(f.blocks.map(b => [b.variant, plainText(b.title)])).toEqual([['block', 'Idea'], ['alert', 'Careful'], ['example', 'For instance'], ['block', 'Theorem (Euler)']])
    expect(text(f.blocks[0].blocks[0])).toBe('Body')
  })

  it('reads figures with their options, side by side when they stand so', () => {
    const d = readBeamer(`\\documentclass{beamer}
\\graphicspath{{figs/}{img/}}
\\begin{document}
\\begin{frame}
\\begin{figure}
\\includegraphics[width=0.45\\textwidth]{a.pdf}\\hfill
\\includegraphics[height=3cm,keepaspectratio]{b}
\\caption{Two plots}
\\end{figure}
Text \\scalebox{0.5}{\\includegraphics{c}} after
\\end{frame}
\\end{document}`)
    expect(d.graphicsPaths).toEqual(['figs/', 'img/'])
    const [row, caption, before, single, after] = d.frames[0].blocks
    expect(row).toMatchObject({ kind: 'images', align: 'center' })
    expect(row.items.map(i => [i.path, i.opts])).toEqual([['a.pdf', { width: '0.45\\textwidth' }], ['b', { height: '3cm', keepaspectratio: true }]])
    expect(caption).toMatchObject({ kind: 'para', caption: true, align: 'center' })
    expect(text(before)).toBe('Text')
    expect(single.items[0]).toMatchObject({ path: 'c', scale: 0.5 })
    expect(text(after)).toBe('after')
  })

  it('reads tables, with a header where a rule follows the first row', () => {
    const [f] = frames(doc(`\\begin{frame}
\\begin{tabular}{l|p{3cm}r}
\\toprule
Name & Note & $n$ \\\\
\\midrule
\\multicolumn{2}{c}{Both} & 3 \\\\
x & y & 4 \\\\ \\bottomrule
\\end{tabular}
\\end{frame}`))
    const t = f.blocks[0]
    expect(t.kind).toBe('table')
    expect(t.header).toBe(true)
    expect(t.aligns).toEqual(['left', 'left', 'right'])
    expect(t.rows.map(r => r.map(c => plainText(c.runs)))).toEqual([['Name', 'Note', '$n$'], ['Both', '3'], ['x', 'y', '4']])
    expect(t.rows[1][0].span).toBe(2)
    expect(t.raw).toMatch(/^\\begin\{tabular\}/)
  })

  it('keeps TikZ for TikZJax, without Beamer’s overlay commands, and with the preamble’s libraries', () => {
    const d = readBeamer(`\\documentclass{beamer}
\\usetikzlibrary{arrows.meta, positioning}
\\tikzset{dot/.style={circle,fill}}
\\begin{document}
\\begin{frame}
\\begin{tikzpicture}
\\draw (0,0) -- (1,0);
\\pause
\\only<2>{\\node[dot] at (1,1) {};}
\\end{tikzpicture}
\\end{frame}
\\end{document}`)
    const t = d.frames[0].blocks[0]
    expect(t.kind).toBe('tikz')
    expect(t.tex).not.toMatch(/pause|only|<2>/)
    expect(d.tikzPreamble).toBe('\\usetikzlibrary{arrows.meta, positioning}\n\\tikzset{dot/.style={circle,fill}}')
  })

  it('reads citations, footnotes, links and colors', () => {
    const d = readBeamer(`\\documentclass{beamer}
\\definecolor{brand}{HTML}{336699}
\\begin{document}
\\begin{frame}
As shown~\\citep[p.~2]{smith2020, doe2019}.\\footnote{A note.} \\href{https://example.com}{Link} \\textcolor{brand}{blue} \\alert{red}
\\end{frame}
\\end{document}`)
    const f = d.frames[0]
    const runs = f.blocks[0].runs
    expect(runs.find(r => r.t === 'cite').keys).toEqual(['smith2020', 'doe2019'])
    expect(runs.find(r => r.m?.sup).text).toBe('1')
    expect(plainText(f.footnotes[0])).toBe('A note.')
    expect(runs.find(r => r.text === 'Link').m.href).toBe('https://example.com')
    expect(runs.find(r => r.text === 'blue').m.color).toBe('#336699')
    expect(runs.find(r => r.text === 'red').m.color).toBe('@alert')
  })

  it('keeps speaker notes, and drops a frame that’s only the bibliography', () => {
    const d = readBeamer(doc(`\\begin{frame}{Talk}
Point \\note{Say this.}
\\end{frame}
\\note[itemize]{\\item Afterwards}
\\begin{frame}{References}
\\bibliographystyle{plain}
\\bibliography{refs,more}
\\end{frame}
\\begin{frame}
\\begin{thebibliography}{9}
\\bibitem{knuth} D. Knuth, \\emph{The TeXbook}.
\\end{thebibliography}
\\end{frame}`))
    expect(d.frames.map(f => plainText(f.title))).toEqual(['Talk'])
    expect(d.frames[0].notes).toEqual(['Say this.', '• Afterwards'])
    expect(d.bibFiles).toEqual(['refs', 'more'])
    expect(d.bibItems).toEqual([{ key: 'knuth', text: 'D. Knuth, The TeXbook.' }])
  })

  it('makes \\AtBeginSection’s frames at each section, with that section current', () => {
    const d = readBeamer(`\\documentclass{beamer}
\\AtBeginSection[]{\\begin{frame}{\\insertsectionhead}\\tableofcontents[currentsection]\\end{frame}}
\\begin{document}
\\section{One}\\subsection{One a}
\\begin{frame}{x}x\\end{frame}
\\section{Two}
\\begin{frame}{y}y\\end{frame}
\\end{document}`)
    expect(d.sections).toEqual([{ name: 'One', subsections: ['One a'] }, { name: 'Two', subsections: [] }])
    expect(d.frames.map(f => plainText(f.title))).toEqual(['One', 'x', 'Two', 'y'])
    expect(d.frames[0].blocks[0]).toMatchObject({ kind: 'toc', options: { currentsection: true } })
    expect(d.frames.map(f => f.sectionIndex)).toEqual([0, 0, 1, 1])
  })

  it('names what it doesn’t know, and keeps its text', () => {
    const d = readBeamer(doc('\\begin{frame}\\mystery{kept} \\gone and \\begin{weird}inside\\end{weird}\\end{frame}'))
    expect(d.frames[0].blocks.map(b => plainText(b.runs))).toEqual(['kept and', 'inside'])
    expect(d.warnings.map(w => w.message)).toEqual([
      '\\mystery isn’t known here, so only its text was kept',
      '\\gone isn’t known here, so it was left out',
      '\\begin{weird} isn’t known here, so only what it holds was kept',
    ])
    expect(d.warnings[0].frames).toEqual([1])
  })
})

describe('overlays', () => {
  it('numbers \\pause, + and . as Beamer counts them', () => {
    expect(resolveOverlays('a \\pause b \\pause c').text).toBe('a \\pause[2] b \\pause[3] c')
    const r = resolveOverlays('\\begin{itemize}[<+->]\\item a \\item b\\end{itemize}\\uncover<.->{c}\\only<+(1)->{d}')
    expect(r.text).toBe('\\begin{itemize}\\item<1-> a \\item<2->{X}'.replace('{X}', ' b\\end{itemize}\\uncover<2->{c}\\only<4->{d}'))
    expect(r.steps).toBe(4)
    expect(resolveOverlays('$a<b$ \\item x', '+-').text).toBe('$a<b$ \\item<1-> x')
  })

  it('reads specifications as the slides they show on', () => {
    expect(specVis('2-')).toEqual({ ranges: [[2, Infinity]], reserve: true })
    expect(specVis('1-3,5', false)).toEqual({ ranges: [[1, 3], [5, 5]], reserve: false })
    expect(specVis('-2| alert@2')).toEqual({ ranges: [[1, 2]], reserve: true })
    expect(specVis('alert@2')).toBe(null)
    expect(visibleAt(specVis('2-3'), 3)).toBe(true)
    expect(visibleAt(specVis('2-3'), 4)).toBe(false)
  })

  it('marks a frame that only builds up as cumulative', () => {
    // Numbers given don't move \pause's count, in Beamer either
    const [f] = frames(doc('\\begin{frame}\\begin{itemize}\\item<1-> a \\item<3-> b\\end{itemize}\\pause c\\end{frame}'))
    expect(f.cumulative).toBe(true)
    expect(f.blocks[0].items.map(i => i.vis.ranges[0][0])).toEqual([1, 3])
    expect(f.blocks[1].vis.ranges).toEqual([[2, Infinity]])
    expect(f.steps).toBe(3)
  })

  it('marks one whose parts also go away as not, with the slides it needs', () => {
    const [f] = frames(doc('\\begin{frame}\\only<1>{First}\\only<2>{Second}\\alt<3>{Third}{Not third}\\end{frame}'))
    expect(f.cumulative).toBe(false)
    expect(f.steps).toBe(3)
    const shownAt = n => f.blocks[0].runs.filter(r => r.t === 'text' && r.text.trim() && visibleAt(r.m.vis, n)).map(r => r.text)
    expect(shownAt(1)).toEqual(['First', 'Not third'])
    expect(shownAt(3)).toEqual(['Third'])
  })

  it('shows a whole paragraph wrapped in an overlay as a step of its own', () => {
    const [f] = frames(doc('\\begin{frame}\\uncover<2->{All of this}\n\nAnd this\\end{frame}'))
    expect(f.cumulative).toBe(true)
    expect(f.blocks[0].vis.ranges).toEqual([[2, Infinity]])
    expect(f.blocks[1].vis).toBe(null)
  })
})

describe('colors and lengths', () => {
  it('mixes xcolor expressions', () => {
    expect(resolveColor('red')).toBe('#ff0000')
    expect(resolveColor('blue!50!black')).toBe('#000080')
    expect(resolveColor('red!25')).toBe('#ffbfbf')
    expect(resolveColor('-red')).toBe('#00ffff')
    expect(resolveColor('0.2,0.4,0.6', {}, 'rgb')).toBe('#336699')
    expect(resolveColor('mine!50', { mine: { model: 'HTML', spec: '000000' } })).toBe('#808080')
    expect(resolveColor('structure')).toBe('@structure')
    expect(resolveColor('nope')).toBe(null)
  })

  it('reads lengths as fractions or millimeters', () => {
    expect(parseLength('0.5\\textwidth')).toEqual({ v: 0.5, unit: 'tw' })
    expect(parseLength('\\linewidth')).toEqual({ v: 1, unit: 'tw' })
    expect(parseLength('.3\\paperheight')).toEqual({ v: 0.3, unit: 'ph' })
    expect(parseLength('2.5cm')).toEqual({ v: 25, unit: 'mm' })
    expect(parseLength('bogus')).toBe(null)
  })
})

describe('commands with nothing to show', () => {
  it('passes over their arguments and options, and \\xspace spaces only before words', () => {
    const d = readBeamer(doc('\\newcommand{\\name}{Parallax\\xspace}\\begin{frame}\\setbeamertemplate{section in toc}[sections numbered]\\newcounter{n}\\metroset{block=fill}\\name is here. \\name.\\end{frame}'))
    expect(plainText(d.frames[0].blocks[0].runs)).toBe('Parallax is here. Parallax.')
    expect(d.warnings).toEqual([])
  })
})
