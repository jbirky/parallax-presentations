// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// An equation element as the slide shows it: KaTeX draws the LaTeX, with
// each \term{id}{…} in a span of its own, and this colors the terms, dims
// the rest, and labels them with callouts, braces or a sentence. The editor
// runs it on the canvas and in the equation editor; a deck's page runs the
// same code from its source text (equationTerms.js), so it uses nothing from
// outside itself. `cfg` is equationConfig's, plus:
//   hover: true to color a term while the pointer is over it (or it's tapped)
//   static: true for no animation (the canvas, thumbnails, printed pages)
//
// It returns { step(n), show(kind, index), focus(id), terms, box(node), redraw(), destroy() }:
// step is the slide's step; show is 'plain', 'rest' (every term colored, no
// labels), 'all' (every term colored and labeled) or 'term' with its index.

export function equationRuntime(root, cfg, katex) {
  const doc = root.ownerDocument
  const win = doc.defaultView || window
  const SAFE = /^[A-Za-z0-9_-]+$/
  const NS = 'http://www.w3.org/2000/svg'
  const FALLBACK = ['#5aa9ff', '#ff9a52', '#4cc36a', '#c58cff', '#f0c04b', '#ff7aa2']
  const fontSize = cfg.fontSize || 44
  const labelSize = cfg.labelSize || 18
  const style = cfg.labelStyle || 'callout'

  if (!doc.getElementById('pxeq-style')) {
    const css = doc.createElement('style')
    css.id = 'pxeq-style'
    css.textContent = [
      '.pxeq{position:relative;width:100%;height:100%;line-height:normal;text-align:center}',
      '.pxeq .pxeq-body{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.45em}',
      '.pxeq .pxeq-math{max-width:none}',
      '.pxeq .pxeq-math .katex-display{margin:0}',
      '.pxeq .pxeq-math .katex{font-size:1em}',
      '.pxeq .katex,.pxeq .katex *{transition:color .35s ease,border-color .35s ease}',
      '.pxeq.pxeq-dim .katex{color:color-mix(in srgb,currentColor 28%,transparent)}',
      '.pxeq [data-term].pxeq-past{color:color-mix(in srgb,var(--tc) 50%,transparent)}',
      '.pxeq [data-term].pxeq-lit{color:var(--tc)}',
      '.pxeq.pxeq-hover [data-term]{cursor:pointer}',
      '.pxeq .pxeq-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}',
      '.pxeq .pxeq-annos{position:absolute;inset:0;pointer-events:none}',
      '.pxeq .pxeq-brace{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:pxeq-draw .45s ease-out forwards}',
      '.pxeq .pxeq-leader{fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:.8}',
      '.pxeq .pxeq-tint{animation:pxeq-fade .3s ease-out both}',
      '.pxeq .pxeq-label,.pxeq .pxeq-card{position:absolute;box-sizing:border-box;max-width:22em;font-size:var(--pxeq-label);line-height:1.3;animation:pxeq-rise .35s ease-out both}',
      '.pxeq .pxeq-label{text-align:center}',
      '.pxeq .pxeq-label b,.pxeq .pxeq-card b{display:block;font-weight:700;color:var(--tc)}',
      '.pxeq .pxeq-label span,.pxeq .pxeq-card span{display:block;padding-top:.2em;font-size:.85em;color:color-mix(in srgb,currentColor 80%,transparent)}',
      '.pxeq .pxeq-card{text-align:left;padding:.4em .75em .5em;border:2px solid var(--tc);border-radius:.45em;background:color-mix(in srgb,var(--tc) 12%,transparent)}',
      '.pxeq .pxeq-compact b{white-space:nowrap}',
      '.pxeq .pxeq-above{--pxeq-dy:-6px}',
      '.pxeq .pxeq-below{--pxeq-dy:6px}',
      '.pxeq .pxeq-sentence{margin:0;max-width:min(100%,34em);font-size:calc(var(--pxeq-label) * 1.2);line-height:1.5;color:color-mix(in srgb,currentColor 72%,transparent);text-wrap:balance}',
      '.pxeq .pxeq-sentence.pxeq-off{display:none}',
      '.pxeq .pxeq-phr{transition:color .3s ease,border-color .3s ease;border-bottom:.12em solid transparent}',
      '.pxeq .pxeq-phr.pxeq-past{color:color-mix(in srgb,var(--tc) 60%,transparent)}',
      '.pxeq .pxeq-phr.pxeq-lit{color:var(--tc);border-bottom-color:var(--tc)}',
      '.pxeq .pxeq-sentence.pxeq-rest .pxeq-phr.pxeq-lit{border-bottom-color:transparent}',
      '@keyframes pxeq-draw{to{stroke-dashoffset:0}}',
      '@keyframes pxeq-rise{from{opacity:0;transform:translateY(var(--pxeq-dy,6px))}to{opacity:1;transform:none}}',
      '@keyframes pxeq-fade{from{opacity:0}to{opacity:1}}',
      '.pxeq.pxeq-static .pxeq-label,.pxeq.pxeq-static .pxeq-card,.pxeq.pxeq-static .pxeq-tint{animation:none}',
      '.pxeq.pxeq-static .pxeq-brace{animation:none;stroke-dashoffset:0}',
      '.pxeq.pxeq-static .katex,.pxeq.pxeq-static .katex *,.pxeq.pxeq-static .pxeq-phr{transition:none}',
      '@media (prefers-reduced-motion:reduce){.pxeq .pxeq-label,.pxeq .pxeq-card,.pxeq .pxeq-tint{animation:none}.pxeq .pxeq-brace{animation:none;stroke-dashoffset:0}.pxeq .katex,.pxeq .katex *,.pxeq .pxeq-phr{transition:none}}',
    ].join('\n')
    ;(doc.head || doc.documentElement).appendChild(css)
  }

  const make = (tag, cls) => {
    const e = doc.createElement(tag)
    if (cls) e.className = cls
    return e
  }
  root.textContent = ''
  const wrap = make('div', 'pxeq' + (cfg.static ? ' pxeq-static' : '') + (cfg.hover ? ' pxeq-hover' : ''))
  const svg = doc.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'pxeq-svg')
  svg.setAttribute('aria-hidden', 'true')
  const body = make('div', 'pxeq-body')
  const math = make('div', 'pxeq-math')
  const sentence = make('div', 'pxeq-sentence')
  const annos = make('div', 'pxeq-annos')
  annos.setAttribute('aria-hidden', 'true')
  body.appendChild(math)
  body.appendChild(sentence)
  wrap.appendChild(svg)
  wrap.appendChild(body)
  wrap.appendChild(annos)
  wrap.style.fontSize = fontSize + 'px'
  wrap.style.setProperty('--pxeq-label', labelSize + 'px')
  if (cfg.textColor) wrap.style.color = cfg.textColor
  root.appendChild(wrap)

  // Only \htmlData is trusted, and only for a term's id or the editor's picker
  const trust = ctx => ctx.command === '\\htmlData' && Object.keys(ctx.attributes || {}).every(k =>
    (k === 'data-term' || k === 'data-pk') && SAFE.test(ctx.attributes[k]))
  try {
    katex.render(cfg.latex || '', math, {
      displayMode: true,
      throwOnError: false,
      trust,
      strict: code => (code === 'htmlExtension' ? 'ignore' : 'warn'),
      macros: { '\\term': '\\htmlData{term=#1}{#2}' },
    })
  } catch (e) {
    math.textContent = String((e && e.message) || e)
  }

  // The terms, in the order they're stepped through: the config's, then any
  // the source has that it doesn't
  const termEls = Array.prototype.slice.call(math.querySelectorAll('.katex-html [data-term]'))
  const terms = []
  const byId = {}
  const add = t => { byId[t.id] = t; terms.push(t) }
  ;(cfg.terms || []).forEach(t => {
    if (t && !byId[t.id] && termEls.some(e => e.getAttribute('data-term') === t.id)) add({ id: t.id, label: t.label || '', note: t.note || '', color: t.color || FALLBACK[terms.length % 6] })
  })
  termEls.forEach(e => {
    const id = e.getAttribute('data-term')
    if (!byId[id]) add({ id, label: '', note: '', color: FALLBACK[terms.length % 6] })
  })
  const order = terms.map(t => t.id)
  termEls.forEach(e => e.style.setProperty('--tc', byId[e.getAttribute('data-term')].color))

  // The sentence: plain text, with phrases linked to terms as [phrase](id)
  const phrases = []
  if (style === 'sentence' && cfg.sentence) {
    const re = /\[([^\]]+)\]\(([A-Za-z][A-Za-z0-9_-]*)\)/g
    const text = cfg.sentence
    let last = 0
    let m
    while ((m = re.exec(text))) {
      sentence.appendChild(doc.createTextNode(text.slice(last, m.index)))
      const span = make('span', 'pxeq-phr')
      span.textContent = m[1]
      if (byId[m[2]]) {
        span.setAttribute('data-term', m[2])
        span.style.setProperty('--tc', byId[m[2]].color)
        phrases.push(span)
      }
      sentence.appendChild(span)
      last = re.lastIndex
    }
    sentence.appendChild(doc.createTextNode(text.slice(last)))
  } else {
    sentence.classList.add('pxeq-off')
  }

  // ── State ──
  const stateAt = n => {
    if (cfg.interaction === 'hover') return { kind: 'rest' }
    const k = n - (cfg.stepStart || 1)
    if (k < 0 || !order.length) return { kind: 'plain' }
    if (k < order.length) return { kind: 'term', index: k }
    return cfg.showAll === false ? { kind: 'term', index: order.length - 1 } : { kind: 'all' }
  }
  let stepState = cfg.interaction === 'hover' ? { kind: 'rest' } : { kind: 'plain' }
  let hoverId = null
  let shown = null

  function look() {
    const st = hoverId ? { kind: 'focus', id: hoverId } : stepState
    const s = { lit: [], past: [], dim: false, anno: [], compact: false, rest: false }
    if (st.kind === 'plain') s.rest = true
    else if (st.kind === 'rest') { s.lit = order; s.rest = true }
    else if (st.kind === 'all') { s.lit = order; s.anno = order; s.compact = order.length > 1 }
    else if (st.kind === 'term' && order[st.index]) {
      s.lit = [order[st.index]]
      s.past = cfg.keepTinted ? order.slice(0, st.index) : []
      s.dim = true
      s.anno = s.lit
    } else if (st.kind === 'focus') { s.lit = [st.id]; s.dim = true; s.anno = s.lit }
    return s
  }

  function apply(force) {
    const s = look()
    const key = JSON.stringify(s)
    if (!force && key === shown) return
    shown = key
    wrap.classList.toggle('pxeq-dim', s.dim)
    termEls.concat(phrases).forEach(e => {
      const id = e.getAttribute('data-term')
      e.classList.toggle('pxeq-lit', s.lit.indexOf(id) >= 0)
      e.classList.toggle('pxeq-past', s.past.indexOf(id) >= 0)
    })
    sentence.classList.toggle('pxeq-rest', s.rest)
    draw(s)
  }

  // ── Labels ──
  // Boxes of what's drawn, in the wrapper's own pixels: the glyphs, rules and
  // SVG pieces (roots, tall brackets), whatever scale the slide is shown at
  function measure() {
    const rr = wrap.getBoundingClientRect()
    const w = wrap.offsetWidth
    if (!w || !rr.width) return null
    const sc = rr.width / w
    const box = node => {
      let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity
      const grow = (l, t, r, b) => {
        if (r - l <= 0 || b - t <= 0) return
        L = Math.min(L, l); T = Math.min(T, t); R = Math.max(R, r); B = Math.max(B, b)
      }
      const range = doc.createRange()
      const walker = doc.createTreeWalker(node, 4)
      while (walker.nextNode()) {
        const n = walker.currentNode
        if (!n.nodeValue.trim()) continue
        range.selectNodeContents(n)
        const rects = range.getClientRects()
        // A line of text is a little taller than its glyphs
        for (let i = 0; i < rects.length; i++) {
          const trim = (rects[i].bottom - rects[i].top) * 0.06
          grow(rects[i].left, rects[i].top + trim, rects[i].right, rects[i].bottom - trim)
        }
      }
      // KaTeX draws a root sign as a very wide SVG its parent clips
      node.querySelectorAll('svg, .frac-line, .rule, .overline-line, .underline-line, .hline').forEach(e => {
        const r = e.getBoundingClientRect()
        const p = (e.tagName.toLowerCase() === 'svg' && e.parentElement ? e.parentElement : e).getBoundingClientRect()
        grow(Math.max(r.left, p.left), Math.max(r.top, p.top), Math.min(r.right, p.right), Math.min(r.bottom, p.bottom))
      })
      if (L === Infinity) return null
      return { left: (L - rr.left) / sc, top: (T - rr.top) / sc, right: (R - rr.left) / sc, bottom: (B - rr.top) / sc }
    }
    return { w, box }
  }

  const draw1 = (tag, attrs, css) => {
    const e = doc.createElementNS(NS, tag)
    Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]))
    if (css) e.setAttribute('style', css)
    svg.appendChild(e)
    return e
  }
  const bracePath = (x0, x1, y, d) => {
    const xm = (x0 + x1) / 2, q = Math.min(labelSize * 0.6, (x1 - x0) / 4), h = d / 2
    return 'M' + x0 + ',' + y + ' Q' + x0 + ',' + (y + h) + ' ' + (x0 + q) + ',' + (y + h) + ' L' + (xm - q) + ',' + (y + h) +
      ' Q' + xm + ',' + (y + h) + ' ' + xm + ',' + (y + d) + ' Q' + xm + ',' + (y + h) + ' ' + (xm + q) + ',' + (y + h) +
      ' L' + (x1 - q) + ',' + (y + h) + ' Q' + x1 + ',' + (y + h) + ' ' + x1 + ',' + y
  }
  const labelFor = (cls, t, compact, side) => {
    if (!t.label && (compact || !t.note)) return null
    const d = make('div', cls + ' pxeq-' + side + (compact ? ' pxeq-compact' : ''))
    d.style.setProperty('--tc', t.color)
    if (t.label) {
      const b = make('b')
      b.textContent = t.label
      d.appendChild(b)
    }
    if (!compact && t.note) {
      const n = make('span')
      n.textContent = t.note
      d.appendChild(n)
    }
    annos.appendChild(d)
    return d
  }

  function draw(s) {
    svg.textContent = ''
    annos.textContent = ''
    if (style === 'sentence' || !s.anno.length) return
    const m = measure()
    const html = math.querySelector('.katex-html')
    const eq = m && html && m.box(html)
    if (!eq) return
    const mid = (eq.top + eq.bottom) / 2, eqH = eq.bottom - eq.top
    const L = labelSize, gap = L * 0.6
    const items = []
    s.anno.forEach(id => {
      const boxes = termEls.filter(e => e.getAttribute('data-term') === id).map(m.box).filter(Boolean)
      if (!byId[id] || !boxes.length) return
      const first = boxes[0]
      // A term above the middle (a numerator) is labeled above; the rest below
      const side = (first.top + first.bottom) / 2 < mid - eqH * 0.12 ? 'above' : 'below'
      items.push({ t: byId[id], boxes, side, cx: (first.left + first.right) / 2 })
    })

    // Labels go in rows out from the equation. A label further out has a
    // line in to its term, which no label nearer in may cover; a label in
    // the first row doesn't cover where another term's line would come out.
    const rows = { above: [], below: [] }
    const row = (side, i) => (rows[side][i] = rows[side][i] || { spans: [], posts: [] })
    const covers = (l, r, x) => x > l - gap / 2 && x < r + gap / 2
    const place = (item, w) => {
      const lo = w > m.w ? (m.w - w) / 2 : 0, hi = w > m.w ? (m.w - w) / 2 : m.w - w
      const want = Math.max(lo, Math.min(hi, item.cx - w / 2))
      const others = items.filter(o => o !== item && o.side === item.side).map(o => o.cx)
      const fits = (i, l) => {
        const r = row(item.side, i)
        if (!r.spans.every(sp => l + w + gap <= sp[0] || l >= sp[1] + gap)) return false
        if (r.posts.some(x => covers(l, l + w, x))) return false
        if (i === 0 && others.some(x => covers(l, l + w, x))) return false
        for (let j = 0; j < i; j++) if (row(item.side, j).spans.some(sp => covers(sp[0], sp[1], item.cx))) return false
        return true
      }
      // A card's line can bend, so a card can move a little to one side
      const nudge = style === 'callout' ? Math.min(w * 0.45, L * 5) : 0
      for (let i = 0; i < 6; i++) {
        let at = fits(i, want) ? want : null
        if (at === null && nudge) {
          const near = []
          row(item.side, i).spans.forEach(sp => near.push(sp[1] + gap, sp[0] - gap - w))
          const ok = near.filter(l => l >= lo && l <= hi && Math.abs(l - want) <= nudge && fits(i, l))
          if (ok.length) at = ok.sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0]
        }
        if (at !== null) {
          row(item.side, i).spans.push([at, at + w])
          for (let j = 0; j < i; j++) row(item.side, j).posts.push(item.cx)
          return { x: at, row: i }
        }
      }
      const i = rows[item.side].length // no clean spot: a row of its own
      row(item.side, i).spans.push([want, want + w])
      return { x: want, row: i }
    }

    items.forEach(item => {
      const { t, boxes, side, cx } = item
      const dir = side === 'below' ? 1 : -1
      if (style === 'brace') {
        const y0 = side === 'below' ? eq.bottom + L * 0.45 : eq.top - L * 0.45
        const depth = L * 0.75 * dir
        boxes.forEach(b => draw1('path', { class: 'pxeq-brace', d: bracePath(b.left + 1, b.right - 1, y0, depth), pathLength: 1 }, 'stroke:' + t.color))
        const lab = labelFor('pxeq-label', t, s.compact, side)
        if (!lab) return
        const w = lab.offsetWidth, h = lab.offsetHeight
        const at = place(item, w)
        const tipY = y0 + depth
        const top = side === 'below' ? tipY + L * 0.35 + at.row * L * 1.75 : tipY - L * 0.35 - h - at.row * L * 1.75
        lab.style.left = at.x + 'px'
        lab.style.top = top + 'px'
        if (at.row > 0) {
          const edge = side === 'below' ? top - 3 : top + h + 3
          draw1('path', { class: 'pxeq-leader pxeq-tint', d: 'M' + cx + ',' + (tipY + 3 * dir) + ' L' + cx + ',' + edge }, 'stroke:' + t.color)
        }
      } else {
        const padX = fontSize * 0.07, padY = fontSize * 0.07
        boxes.forEach(b => draw1('rect', {
          class: 'pxeq-tint', x: b.left - padX, y: b.top - padY, width: b.right - b.left + 2 * padX, height: b.bottom - b.top + 2 * padY, rx: fontSize * 0.18,
        }, 'fill:' + t.color + ';fill-opacity:.12;stroke:' + t.color + ';stroke-opacity:.55;stroke-width:1.5'))
        const card = labelFor('pxeq-card', t, s.compact, side)
        if (!card) return
        const w = card.offsetWidth, h = card.offsetHeight
        const at = place(item, w)
        const out = s.compact ? L * 1.9 : L * 2.3
        const top = side === 'below' ? eq.bottom + out + at.row * L * 2.4 : eq.top - out - h - at.row * L * 2.4
        card.style.left = at.x + 'px'
        card.style.top = top + 'px'
        const cardX = Math.max(at.x + L, Math.min(at.x + w - L, cx))
        const cardEdge = side === 'below' ? top : top + h
        boxes.forEach(b => {
          const ax = (b.left + b.right) / 2, ay = side === 'below' ? b.bottom + padY : b.top - padY
          const midY = side === 'below' ? Math.max(ay + L * 0.6, eq.bottom + L * 0.9) : Math.min(ay - L * 0.6, eq.top - L * 0.9)
          draw1('path', { class: 'pxeq-leader pxeq-tint', d: 'M' + ax + ',' + ay + ' L' + ax + ',' + midY + ' L' + cardX + ',' + midY + ' L' + cardX + ',' + cardEdge }, 'stroke:' + t.color)
          draw1('circle', { class: 'pxeq-tint', cx: ax, cy: ay, r: L * 0.22 }, 'fill:' + t.color)
        })
      }
    })
  }

  // ── Hover ──
  let timer = 0
  const setHover = id => {
    win.clearTimeout(timer)
    if (hoverId === id) return
    hoverId = id
    apply()
  }
  const leave = () => {
    win.clearTimeout(timer)
    timer = win.setTimeout(() => setHover(null), 200)
  }
  const termAt = target => {
    const t = target && target.closest ? target.closest('[data-term]') : null
    return t && wrap.contains(t) && byId[t.getAttribute('data-term')] ? t.getAttribute('data-term') : null
  }
  const onOver = e => {
    if (e.pointerType === 'touch') return
    const id = termAt(e.target)
    if (id) setHover(id)
    else leave()
  }
  const onClick = e => {
    const id = termAt(e.target)
    const tap = e.pointerType === 'touch' || e.pointerType === 'pen'
    if (id) setHover(tap && hoverId === id ? null : id)
    else if (hoverId) setHover(null)
  }
  if (cfg.hover) {
    wrap.addEventListener('pointerover', onOver)
    wrap.addEventListener('pointerleave', leave)
    wrap.addEventListener('click', onClick)
  }

  // Measured again when it's first shown (a slide that was display:none),
  // resized, or its fonts arrive
  const redraw = () => apply(true)
  const ro = win.ResizeObserver ? new win.ResizeObserver(redraw) : null
  if (ro) ro.observe(wrap)
  const fonts = doc.fonts
  if (fonts && fonts.addEventListener) fonts.addEventListener('loadingdone', redraw)

  apply(true)

  return {
    step(n) { stepState = stateAt(n); apply() },
    show(kind, index) { stepState = kind === 'term' ? { kind, index: index || 0 } : { kind }; apply() },
    focus(id) { setHover(id && byId[id] ? id : null) },
    terms: order,
    wrap,
    math,
    redraw,
    // A node's box in the wrapper's own pixels, or null while it isn't shown
    box(node) { const m = measure(); return m && node ? m.box(node) : null },
    destroy() {
      win.clearTimeout(timer)
      if (ro) ro.disconnect()
      if (fonts && fonts.removeEventListener) fonts.removeEventListener('loadingdone', redraw)
      root.textContent = ''
    },
  }
}
