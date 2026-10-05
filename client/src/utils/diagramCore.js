// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What the diagram elements share (Feynman diagrams, feynmanDiagram.js,
// circuits, circuitDiagram.js, logic, logicDiagram.js, free-body diagrams,
// freebodyDiagram.js, Venn diagrams, vennDiagram.js, and timing diagrams,
// timingDiagram.js, which uses only the steps): labels from a small part of
// TeX, and the steps of a presented deck. A diagram in a deck is a <div data-fx="id">
// holding its SVG, with a hidden fragment per step (data-fx-step="id",
// data-fx-step-at="n") counted with the slide's others; diagramDeckScript
// shows each at its slide's step. The server's pages have this through
// server/services/deck-html.js.

export const MATH_FONT = "'Latin Modern Roman', 'Times New Roman', Times, serif"
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n1 = v => String(Math.round(v * 10) / 10)

// ---------- Labels as SVG text, from a small part of TeX, where KaTeX can't
// be used (PowerPoint, which leaves out HTML inside an SVG), and as HTML until
// a deck's KaTeX draws them

const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' }
const SYM = { pm: '±', mp: '∓', to: '→', prime: '′', ell: 'ℓ', ast: '∗', times: '×', cdot: '·', infty: '∞', partial: '∂', hbar: 'ℏ', ',': ' ', ';': ' ', ' ': ' ', '!': '', quad: '  ' }
// Sets, for Venn diagrams: operators with room around them
const SET_SYM = { cup: ' ∪ ', cap: ' ∩ ', setminus: ' ∖ ', smallsetminus: ' ∖ ', triangle: ' △ ', ominus: ' ⊖ ', oplus: ' ⊕ ', subseteq: ' ⊆ ', supseteq: ' ⊇ ', subset: ' ⊂ ', supset: ' ⊃ ', subsetneq: ' ⊊ ', supsetneq: ' ⊋ ', neq: ' ≠ ', ne: ' ≠ ', mid: ' | ', in: ' ∈ ', notin: ' ∉ ', varnothing: '∅', emptyset: '∅', complement: 'ᶜ' }
const ACCENT = { bar: 0x304, overline: 0x305, tilde: 0x303, hat: 0x302 }
const UPRIGHT = { mathrm: 1, text: 1, rm: 1, mathbf: 1 }
const SCRIPT = { A: '𝒜', B: 'ℬ', C: '𝒞', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ' }
const COMBINING = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g')

// Runs of text: { t, lvl: 0, 1 (superscript) or -1 (subscript), it: italic }
export function texRuns(src) {
  src = String(src || '')
  const runs = []
  let i = 0
  const push = (t, lvl, it) => {
    if (!t) return
    const r = runs[runs.length - 1]
    if (r && r.lvl === lvl && r.it === it) r.t += t
    else runs.push({ t, lvl, it })
  }
  function atom(lvl, up) {
    const c = src[i]
    if (c === undefined) return
    if (c === '{') { i++; group(lvl, up, '}'); return }
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i))
      if (!m) { i++; return }
      i += m[0].length
      const name = m[1]
      if (ACCENT[name]) {
        const before = runs.length, lastLen = before ? runs[before - 1].t.length : 0
        while (src[i] === ' ') i++
        atom(lvl, up)
        const mark = String.fromCharCode(ACCENT[name])
        if (runs.length > before) { const r = runs[before]; r.t = r.t.slice(0, 1) + mark + r.t.slice(1) }
        else if (before && runs[before - 1].t.length > lastLen) { const r = runs[before - 1]; r.t = r.t.slice(0, lastLen + 1) + mark + r.t.slice(lastLen + 1) }
        return
      }
      if (UPRIGHT[name]) { while (src[i] === ' ') i++; atom(lvl, true); return }
      if (name === 'mathcal') { while (src[i] === ' ') i++; const before = runs.length; atom(lvl, true); for (const r of runs.slice(Math.max(0, before - 1))) r.t = r.t.replace(/[A-Z]/g, c => SCRIPT[c] || c); return }
      if (name === 'mathbin' || name === 'mathrel' || name === 'mathop') { while (src[i] === ' ') i++; atom(lvl, up); return }
      if (GREEK[name]) { push(GREEK[name], lvl, !up && name[0] === name[0].toLowerCase()); return }
      if (SYM[name] !== undefined) { push(SYM[name], lvl, false); return }
      if (SET_SYM[name] !== undefined) { push(SET_SYM[name], lvl, false); return }
      push(name, lvl, false)
      return
    }
    i++
    if (/[A-Za-z]/.test(c)) push(c, lvl, !up)
    else if (c === '-') push('−', lvl, false)
    else if (c === "'") push('′', lvl, false)
    else if (c === '~') push(' ', lvl, false)
    else if (c !== ' ') push(c, lvl, false)
  }
  function group(lvl, up, end) {
    while (i < src.length && src[i] !== end) {
      if (src[i] === '^' || src[i] === '_') {
        const l = src[i] === '^' ? 1 : -1
        i++
        atom(lvl || l, up)
        continue
      }
      if (src[i] === '}') { i++; continue }
      atom(lvl, up)
    }
    if (end && src[i] === end) i++
  }
  group(0, false, null)
  return runs
}

// About how much room a label takes, in px at font size fs
export function texBox(src, fs) {
  let w = 0, sup = false, sub = false
  for (const r of texRuns(src)) {
    w += r.t.replace(COMBINING, '').length * fs * 0.5 * (r.lvl ? 0.7 : 1)
    if (r.lvl > 0) sup = true
    if (r.lvl < 0) sub = true
  }
  return { w: Math.max(w, fs * 0.4), h: fs * (1 + (sup ? 0.25 : 0) + (sub ? 0.2 : 0)) }
}

// The same as HTML, in a deck until KaTeX draws it, so a label never shows as TeX
export function texLiteHtml(src) {
  return texRuns(src).map(r => {
    const t = r.it ? `<i>${esc(r.t)}</i>` : esc(r.t)
    return r.lvl > 0 ? `<sup>${t}</sup>` : r.lvl < 0 ? `<sub>${t}</sub>` : t
  }).join('')
}

export function texSvg(src, X, Y, fs, fill) {
  let cur = 0, spans = ''
  for (const r of texRuns(src)) {
    const target = r.lvl > 0 ? -0.42 : r.lvl < 0 ? 0.24 : 0
    const dy = (target - cur) * fs
    cur = target
    spans += `<tspan dy="${n1(dy)}" font-size="${n1(r.lvl ? fs * 0.7 : fs)}" font-style="${r.it ? 'italic' : 'normal'}">${esc(r.t)}</tspan>`
  }
  return `<text x="${n1(X)}" y="${n1(Y + fs * 0.34)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(fs)}" fill="${esc(fill)}">${spans}</text>`
}

// ---------- Steps in a presented deck

// Shows a deck-drawn diagram at step cur: parts (.pxfx-part, data-fx-at)
// from their step on, earlier ones faded with dim, and with animate this
// step's drawn in; the caption of the latest step with one (data-fx-cap);
// and what holds for some steps only (data-fx-in="from-to", "from-" for
// every step on), such as a switch's blade or a circuit's current. A page
// runs it from its source, so it uses nothing else.
export function applyDiagramStep(root, cur, animate, dim) {
  var parts = root.querySelectorAll('.pxfx-part'), i, p, at, best = -1
  for (i = 0; i < parts.length; i++) {
    p = parts[i]
    at = +p.getAttribute('data-fx-at') || 0
    p.classList.toggle('pxfx-off', at > cur)
    p.classList.toggle('pxfx-past', !!dim && cur > 0 && at < cur)
    p.classList.remove('pxfx-new')
    if (animate && at === cur && at > 0) { void p.getBoundingClientRect(); p.classList.add('pxfx-new') }
  }
  var caps = root.querySelectorAll('[data-fx-cap]')
  for (i = 0; i < caps.length; i++) { at = +caps[i].getAttribute('data-fx-cap'); if (at <= cur && at > best) best = at }
  for (i = 0; i < caps.length; i++) caps[i].classList.toggle('pxfx-off', +caps[i].getAttribute('data-fx-cap') !== best)
  var spans = root.querySelectorAll('[data-fx-in]'), r
  for (i = 0; i < spans.length; i++) {
    r = spans[i].getAttribute('data-fx-in').split('-')
    spans[i].classList.toggle('pxfx-off', cur < +r[0] || (r[1] !== '' && cur > +r[1]))
  }
}

export const DIAGRAM_CSS = [
  '.pxfx-part.pxfx-off,.pxfx-cap.pxfx-off{visibility:hidden}',
  '[data-fx-in].pxfx-off{display:none}',
  '.pxfx-part{transition:opacity .35s ease}',
  '.pxfx-part.pxfx-past{opacity:.34}',
  '.pxfx-reveal{stroke-dasharray:1 1;stroke-dashoffset:0}',
  '.pxfx-new .pxfx-reveal{animation:pxfx-draw .75s ease-in-out both}',
  '.pxfx-new .pxfx-fade,.pxfx-new.pxfx-v{animation:pxfx-fade .35s .45s ease-out both}',
  '@keyframes pxfx-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}',
  '@keyframes pxfx-fade{from{opacity:0}to{opacity:1}}',
  // A circuit's current: dots that run the way conventional current flows
  '.pxcx-flow{animation:pxcx-flow .6s linear infinite}',
  '@keyframes pxcx-flow{to{stroke-dashoffset:-14}}',
  // A logic signal that changed: it fades in after those before it in the logic
  '.pxlg-sig{animation:pxfx-fade .28s ease-out both}',
  // A Venn diagram's shading, numbers or verdict: in at once, with nothing drawn first
  '.pxfx-new .pxvn-in{animation:pxfx-fade .45s ease-out both}',
  '@media (prefers-reduced-motion:reduce){.pxfx-new .pxfx-reveal,.pxfx-new .pxfx-fade,.pxfx-new.pxfx-v,.pxcx-flow,.pxlg-sig,.pxfx-new .pxvn-in{animation:none}.pxfx-part{transition:none}}',
].join('\n')

// In a deck with Feynman, circuit, logic, free-body or Venn diagrams: tells each its slide's step,
// drawing in a step's parts when it's stepped to
let deckScript = null
export function diagramDeckScript() {
  if (!deckScript) deckScript = `
    (function() {
      var apply = (${applyDiagramStep.toString()});
      // The labels, now rather than when the deck is ready
      if (window.katex) document.querySelectorAll('[data-fx] span[data-math-latex]').forEach(function(el) {
        try { window.katex.render(el.getAttribute('data-math-latex'), el, { throwOnError: false }); el.style.fontFamily = ''; } catch (e) {}
      });
      var css = document.createElement('style');
      css.textContent = ${JSON.stringify(DIAGRAM_CSS)};
      document.head.appendChild(css);
      var items = [];
      document.querySelectorAll('[data-fx]').forEach(function(el) {
        items.push({ el: el, id: el.getAttribute('data-fx'), dim: el.getAttribute('data-fx-dim') === '1', at: -1 });
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-fx-step]').forEach(function(m) {
          if (m.getAttribute('data-fx-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-fx-step-at') || 0);
        });
        return n;
      }
      function sync(ev) {
        var forward = !!ev && ev.type === 'fragmentshown';
        items.forEach(function(item) {
          var n = stepOf(item);
          if (n === item.at) return;
          apply(item.el, n, forward && n > item.at, item.dim);
          item.at = n;
        });
      }
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
      sync();
    })();
`
  return deckScript
}
