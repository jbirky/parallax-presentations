// Shared LaTeX iframe HTML generator
// Supports: KaTeX math, LaTeX tables via LaTeX.js, TikZ diagrams via TikZJax
// Only shown in the editor, so it loads the bundled libraries

import { libUrl, localizeLibraries } from './libraries'

export function generateLatexIframeHtml(content, textColor, fontSize) {
  return localizeLibraries(buildLatexIframeHtml(content, textColor, fontSize))
}

function buildLatexIframeHtml(content, textColor, fontSize) {
  const c = textColor || 'white'
  const scale = fontSize ? (fontSize / 20) : 1
  const hasTikz = /\\begin\{tikzpicture\}|\\tikz\s*[{[]/.test(content)
  const hasTable = /\\begin\{(tabular\*?|table\*?|longtable|tabularx|tabulary)\}/.test(content)

  if (hasTikz) {
    return `<!doctype html><html><head>
<meta charset="utf-8">
<link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css">
<script src="https://tikzjax.com/v1/tikzjax.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: transparent; overflow: auto; color: ${c}; }
  body { transform: scale(${scale}); transform-origin: center center; }
  svg { max-width: 100%; max-height: 100%; }
</style>
</head><body><script type="text/tikz">${content}<\/script></body></html>`
  }

  if (hasTable) {
    const wrapped = content.includes('\\begin{document}') ? content
      : `\\documentclass{article}\n\\usepackage{booktabs}\n\\usepackage{array}\n\\begin{document}\n${content}\n\\end{document}`
    return `<!doctype html><html><head>
<meta charset="utf-8">
<script src="${libUrl('latex.js', 'dist/latex.js')}"><\/script>
<link rel="stylesheet" href="${libUrl('latex.js', 'dist/css/base.css')}">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 8px; background: transparent; color: ${c} !important; width: 100%; height: 100%; overflow: auto; font-family: 'Computer Modern', Georgia, serif; transform: scale(${scale}); transform-origin: top left; }
  table { border-collapse: collapse; color: ${c}; }
  td, th { padding: 3px 10px; color: ${c} !important; }
  p, span, div, .latex-table { color: ${c} !important; }
  body > * { color: ${c} !important; }
</style>
</head><body>
<div id="out"></div>
<script>try {
  var generator = new HtmlGenerator({ hyphenate: false })
  var doc = parse(${JSON.stringify(wrapped)}, { generator: generator })
  document.getElementById('out').appendChild(doc.domFragment())
} catch(e) {
  document.getElementById('out').innerHTML = '<span style="color:#f87171">Error: ' + e.message + '<\/span>'
}
<\/script>
</body></html>`
  }

  // KaTeX for math expressions
  return `<!doctype html><html><head>
<meta charset="utf-8">
<link rel="stylesheet" href="${libUrl('katex', 'dist/katex.min.css')}">
<script src="${libUrl('katex', 'dist/katex.min.js')}"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: transparent; overflow: hidden; color: ${c}; }
  .katex { font-size: ${scale * 1.4}em; color: ${c}; }
  svg { max-width: 100%; max-height: 100%; }
</style>
</head><body>
<div id="math"></div>
<script>
  try {
    katex.render(${JSON.stringify(content)}, document.getElementById('math'), { displayMode: true, throwOnError: false });
  } catch(e) {
    document.getElementById('math').textContent = e.message;
  }
<\/script>
</body></html>`
}
