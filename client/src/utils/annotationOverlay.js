// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The drawing layer of the editor's Present window: a pen toolbar, ink kept in
// an SVG inside each slide (in slide coordinates, so it scales and moves with
// the slide; on a scrolling slide, in the canvas and its coordinates, so it
// scrolls with what it marks), whiteboard pages, and saving through the editor. It runs in the
// presented page, where generateRevealHTML injects it as source text, so it
// must use nothing from outside its own body. The data it edits is described
// in utils/annotations.js.
//
// config: { presentationId, set, slideW, slideH, backupKey, message }

export function installAnnotations(config) {
  const NS = 'http://www.w3.org/2000/svg'
  const W = config.slideW, H = config.slideH
  const set = config.set
  set.slides = set.slides || {}
  set.boards = set.boards || []
  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#111827']
  const SIZES = [3, 6, 12]
  const ERASE_RADIUS = 10

  let tool = null // 'pen' | 'highlighter' | 'eraser' | 'laser' | null
  let color = COLORS[0]
  let size = SIZES[0]
  let penSeen = false // once a stylus draws, fingers go back to changing slides
  let active = null // the stroke or erase in progress
  let sent = false
  let saveTimer = null
  const undoStacks = {}

  // ── Pages: slides and boards ─────────────────────────────────────────────
  const keyOf = section => section && (section.getAttribute('data-slide-id') || section.getAttribute('data-board-id'))
  const boardOf = section => section && set.boards.find(b => b.id === section.getAttribute('data-board-id'))
  function pathsOf(section) {
    const board = boardOf(section)
    if (board) return board.paths
    const key = keyOf(section)
    if (!set.slides[key]) set.slides[key] = { paths: [] }
    return set.slides[key].paths
  }
  const currentPage = () => {
    const s = window.Reveal && Reveal.getCurrentSlide()
    return keyOf(s) ? s : null
  }
  // What ink goes on: a scrolling slide's canvas (utils/scrollingSlides.js), or the slide
  const scrollerOf = section => section && section.querySelector(':scope > .slide-scroller')
  const surfaceOf = section => scrollerOf(section)?.querySelector(':scope > .slide-scroll-inner') || section
  const heightOf = section => Number(section.getAttribute('data-scroll-height')) || H

  // ── Drawing ──────────────────────────────────────────────────────────────
  function layerOf(section) {
    const surface = surfaceOf(section)
    let svg = surface.querySelector(':scope > svg.pp-ink')
    if (!svg) {
      svg = document.createElementNS(NS, 'svg')
      svg.setAttribute('class', 'pp-ink')
      svg.setAttribute('viewBox', `0 0 ${W} ${heightOf(section)}`)
      surface.appendChild(svg)
    }
    return svg
  }
  function pathD(points) {
    if (points.length === 1) return `M${points[0][0]} ${points[0][1]}l0.01 0`
    let d = `M${points[0][0]} ${points[0][1]}`
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i], [nx, ny] = points[i + 1]
      d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`
    }
    const last = points[points.length - 1]
    return d + `L${last[0]} ${last[1]}`
  }
  function pathElement(p) {
    const el = document.createElementNS(NS, 'path')
    el.setAttribute('d', pathD(p.points))
    el.setAttribute('stroke', p.color)
    el.setAttribute('stroke-width', p.strokeWidth)
    el.setAttribute('stroke-opacity', p.opacity ?? 1)
    el.setAttribute('fill', 'none')
    el.setAttribute('stroke-linecap', 'round')
    el.setAttribute('stroke-linejoin', 'round')
    return el
  }
  function render(section) {
    const layer = layerOf(section)
    layer.querySelectorAll('path:not(.pp-laser)').forEach(el => el.remove())
    for (const p of pathsOf(section)) layer.appendChild(pathElement(p))
  }
  function toSlide(e, section) {
    const r = surfaceOf(section).getBoundingClientRect()
    const round = v => Math.round(v * 10) / 10
    return [round((e.clientX - r.left) * W / r.width), round((e.clientY - r.top) * heightOf(section) / r.height)]
  }
  // Ramer–Douglas–Peucker, to keep strokes small
  function simplify(points, tolerance) {
    if (points.length < 3) return points
    const [ax, ay] = points[0], [bx, by] = points[points.length - 1]
    let far = 0, index = 0
    for (let i = 1; i < points.length - 1; i++) {
      const [px, py] = points[i]
      const len = Math.hypot(bx - ax, by - ay) || 1
      const d = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / len
      if (d > far) { far = d; index = i }
    }
    if (far <= tolerance) return [points[0], points[points.length - 1]]
    return simplify(points.slice(0, index + 1), tolerance).slice(0, -1).concat(simplify(points.slice(index), tolerance))
  }
  function segmentDistance([px, py], [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
  }
  function eraseAt(section, pt) {
    const paths = pathsOf(section)
    for (let i = paths.length - 1; i >= 0; i--) {
      const p = paths[i], reach = ERASE_RADIUS + p.strokeWidth / 2
      const pts = p.points
      const hit = pts.length === 1 ? Math.hypot(pt[0] - pts[0][0], pt[1] - pts[0][1]) <= reach
        : pts.some((q, j) => j > 0 && segmentDistance(pt, pts[j - 1], q) <= reach)
      if (hit) {
        paths.splice(i, 1)
        pushUndo(section, { type: 'remove', path: p, index: i })
        render(section)
        scheduleSave()
      }
    }
  }

  // ── Undo and clear ───────────────────────────────────────────────────────
  function pushUndo(section, action) {
    const key = keyOf(section)
    ;(undoStacks[key] = undoStacks[key] || []).push(action)
  }
  function undo() {
    const section = currentPage()
    const stack = section && undoStacks[keyOf(section)]
    const action = stack && stack.pop()
    if (!action) return
    const paths = pathsOf(section)
    if (action.type === 'add') {
      const i = paths.lastIndexOf(action.path)
      if (i !== -1) paths.splice(i, 1) // unless it was erased since
    }
    if (action.type === 'remove') paths.splice(action.index, 0, action.path)
    if (action.type === 'clear') paths.push(...action.paths)
    render(section)
    scheduleSave()
  }
  function clearPage() {
    const section = currentPage()
    const paths = section && pathsOf(section)
    if (!paths || !paths.length || !confirm('Clear the ink on this slide?')) return
    pushUndo(section, { type: 'clear', paths: paths.splice(0) })
    render(section)
    scheduleSave()
  }

  // ── Whiteboard pages ─────────────────────────────────────────────────────
  function boardSection(board) {
    const s = document.createElement('section')
    s.setAttribute('data-board-id', board.id)
    s.className = 'pp-board'
    s.style.cssText = `padding:0;width:${W}px;height:${H}px`
    return s
  }
  function findPage(key) {
    return [...document.querySelectorAll('.reveal .slides section')].find(s => keyOf(s) === key) || null
  }
  function addBoard() {
    const anchor = currentPage()
    if (!anchor) return
    const id = 'board-' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2))
    const board = { id, afterId: keyOf(anchor), paths: [] }
    set.boards.push(board)
    const section = boardSection(board)
    anchor.after(section)
    Reveal.sync()
    const { h, v } = Reveal.getIndices(section)
    Reveal.slide(h, v)
    scheduleSave()
  }
  function deleteBoard() {
    const section = currentPage()
    const board = boardOf(section)
    if (!board || (board.paths.length && !confirm('Delete this board and its ink?'))) return
    set.boards = set.boards.filter(b => b !== board)
    for (const b of set.boards) if (b.afterId === board.id) b.afterId = board.afterId
    Reveal.prev()
    section.remove()
    Reveal.sync()
    scheduleSave()
  }
  function restoreBoards() {
    for (const board of set.boards) {
      const anchor = findPage(board.afterId)
      const section = boardSection(board)
      if (anchor) anchor.after(section)
      else document.querySelector('.reveal .slides').appendChild(section)
    }
    if (set.boards.length) Reveal.sync()
  }

  // ── Saving ───────────────────────────────────────────────────────────────
  const hasInk = () => Object.values(set.slides).some(s => s.paths.length) || set.boards.length > 0
  function scheduleSave() {
    status('Saving…')
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, 600)
  }
  // Keeps a copy on this device, and sends the set to the editor, which saves it
  function flush() {
    clearTimeout(saveTimer)
    saveTimer = null
    if (!hasInk() && !sent) return status('')
    for (const key of Object.keys(set.slides)) if (!set.slides[key].paths.length) delete set.slides[key]
    set.updatedAt = new Date().toISOString()
    const data = JSON.stringify(set)
    try { localStorage.setItem(config.backupKey, data) } catch {}
    const editor = window.opener
    if (editor && !editor.closed) {
      try {
        editor.postMessage({ type: config.message, presentationId: config.presentationId, set: JSON.parse(data) }, window.location.origin)
        sent = true
        return status('Saved')
      } catch {}
    }
    status('Kept on this device. It saves when you next open the presentation.')
  }
  window.addEventListener('pagehide', () => { if (saveTimer) flush() })

  // ── Input ────────────────────────────────────────────────────────────────
  // While a tool is on, this layer takes pointer input over the slides (embeds
  // are frames, which would otherwise swallow it). It sits inside .reveal, so a
  // finger's touches still reach reveal.js's swipe handling.
  const shield = document.createElement('div')
  shield.className = 'pp-shield'
  document.querySelector('.reveal').appendChild(shield)

  const draws = e => e.pointerType !== 'touch' || !penSeen
  shield.addEventListener('pointerdown', e => {
    if (e.pointerType === 'pen') penSeen = true
    const section = currentPage()
    if (!tool || !section || !draws(e) || e.button > 0 || Reveal.isOverview()) return
    e.preventDefault()
    try { shield.setPointerCapture(e.pointerId) } catch {}
    const pt = toSlide(e, section)
    if (tool === 'eraser') {
      active = { id: e.pointerId, section, erase: true }
      return eraseAt(section, pt)
    }
    const highlighter = tool === 'highlighter', laser = tool === 'laser'
    const path = {
      points: [pt],
      color: laser ? '#ff3b3b' : color,
      strokeWidth: laser ? 4 : highlighter ? size * 4 : size,
      opacity: highlighter ? 0.35 : 1,
    }
    const el = pathElement(path)
    if (laser) el.setAttribute('class', 'pp-laser')
    layerOf(section).appendChild(el)
    active = { id: e.pointerId, section, path, el, laser }
  })
  shield.addEventListener('pointermove', e => {
    if (!active || e.pointerId !== active.id) return
    e.preventDefault()
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
    for (const ev of events.length ? events : [e]) {
      const pt = toSlide(ev, active.section)
      if (active.erase) { eraseAt(active.section, pt); continue }
      const last = active.path.points[active.path.points.length - 1]
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 0.8) active.path.points.push(pt)
    }
    if (!active.erase) active.el.setAttribute('d', pathD(active.path.points))
  })
  function endStroke(e) {
    if (!active || e.pointerId !== active.id) return
    const { section, path, el, laser, erase } = active
    active = null
    if (erase) return
    if (laser) {
      el.style.transition = 'opacity 0.8s'
      setTimeout(() => { el.style.opacity = '0' }, 400)
      setTimeout(() => el.remove(), 1300)
      return
    }
    path.points = simplify(path.points, 0.6)
    pathsOf(section).push(path)
    pushUndo(section, { type: 'add', path })
    el.setAttribute('d', pathD(path.points))
    scheduleSave()
  }
  shield.addEventListener('pointerup', endStroke)
  shield.addEventListener('pointercancel', endStroke)
  // A stylus's touches, or a finger's before any stylus, draw rather than swipe
  for (const type of ['touchstart', 'touchmove']) {
    shield.addEventListener(type, e => {
      const stylus = [...e.changedTouches].some(t => t.touchType === 'stylus')
      if (tool && (stylus || !penSeen)) { e.preventDefault(); e.stopPropagation() }
    }, { passive: false })
  }
  // The layer is over a scrolling slide's canvas, so it scrolls the canvas for
  // the wheel, and for a finger dragged up or down once a stylus draws. A
  // sideways drag still reaches reveal.js, to change slides.
  shield.addEventListener('wheel', e => {
    const scroller = scrollerOf(currentPage())
    if (!scroller) return
    e.preventDefault()
    scroller.scrollTop += e.deltaY
  }, { passive: false })
  let drag = null
  shield.addEventListener('touchstart', e => {
    const scroller = scrollerOf(currentPage())
    const t = e.touches[0]
    drag = tool && penSeen && scroller && e.touches.length === 1 && t.touchType !== 'stylus'
      ? { scroller, x: t.clientX, y: t.clientY, vertical: null } : null
  }, { passive: true })
  shield.addEventListener('touchmove', e => {
    if (!drag) return
    const t = e.touches[0]
    if (drag.vertical === null) {
      const dx = t.clientX - drag.x, dy = t.clientY - drag.y
      if (Math.hypot(dx, dy) < 8) return
      drag.vertical = Math.abs(dy) > Math.abs(dx)
    }
    if (!drag.vertical) return
    e.stopPropagation()
    const scale = drag.scroller.clientHeight / (drag.scroller.getBoundingClientRect().height || 1)
    drag.scroller.scrollTop -= (t.clientY - drag.y) * scale
    drag.y = t.clientY
  }, { passive: true })
  shield.addEventListener('touchend', () => { drag = null })

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
    svg.pp-ink { position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; overflow:visible; z-index:2000; }
    svg.pp-ink .pp-laser { filter: drop-shadow(0 0 3px #ff3b3b); }
    .pp-shield { position:absolute; inset:0; z-index:2500; display:none; touch-action:none; }
    .pp-on .pp-shield { display:block; cursor:crosshair; }
    .pp-bar { position:fixed; left:12px; bottom:12px; z-index:3000; display:flex; align-items:center; gap:4px; flex-wrap:wrap; max-width:calc(100vw - 24px);
      padding:5px; border-radius:22px; background:rgba(20,20,30,0.82); color:#fff; font:13px/1 -apple-system,system-ui,sans-serif; box-shadow:0 4px 16px rgba(0,0,0,0.35); }
    .pp-bar button { all:unset; box-sizing:border-box; min-width:34px; height:34px; padding:0 8px; border-radius:17px; display:inline-flex; align-items:center; justify-content:center; gap:4px; cursor:pointer; }
    .pp-bar button:hover { background:rgba(255,255,255,0.14); }
    .pp-bar button[aria-pressed="true"] { background:rgba(255,255,255,0.26); }
    .pp-bar button:focus-visible { outline:2px solid #818cf8; }
    .pp-bar .pp-sep { width:1px; height:22px; background:rgba(255,255,255,0.2); margin:0 2px; }
    .pp-bar .pp-swatch { width:18px; height:18px; border-radius:50%; border:2px solid rgba(255,255,255,0.5); }
    .pp-bar .pp-dot { border-radius:50%; background:#fff; }
    .pp-bar .pp-status { font-size:11px; opacity:0.75; padding:0 6px; max-width:240px; }
    .pp-bar:not(.pp-open) > :not(.pp-toggle) { display:none; }
    .pp-bar:not(.pp-open) { opacity:0.55; }
    .pp-bar:not(.pp-open):hover { opacity:1; }
    .pp-bar .pp-board-only { display:none; }
    .pp-on-board .pp-bar.pp-open .pp-board-only { display:inline-flex; }
  `
  document.head.appendChild(style)

  const bar = document.createElement('div')
  bar.className = 'pp-bar'
  bar.setAttribute('role', 'toolbar')
  bar.setAttribute('aria-label', 'Annotate')
  const button = (label, content, onClick, extra = '') => {
    const b = document.createElement('button')
    b.type = 'button'
    b.title = label
    b.setAttribute('aria-label', label)
    if (extra) b.className = extra
    b.innerHTML = content
    b.addEventListener('click', e => { e.stopPropagation(); onClick(b) })
    return b
  }
  const sep = () => Object.assign(document.createElement('span'), { className: 'pp-sep' })
  const toolButtons = {}
  const swatchButtons = [], sizeButtons = []

  const toggle = button('Annotate (D)', '&#9998;', () => setTool(tool ? null : 'pen'), 'pp-toggle')
  bar.append(toggle)
  for (const [name, label, icon] of [['pen', 'Pen', '&#9998;'], ['highlighter', 'Highlighter', '&#9646;'], ['eraser', 'Eraser (E)', '&#9003;'], ['laser', 'Laser pointer', '&#9673;']]) {
    toolButtons[name] = button(label, icon, () => setTool(name))
    bar.append(toolButtons[name])
  }
  bar.append(sep())
  for (const c of COLORS) {
    const b = button(`Color ${c}`, `<span class="pp-swatch" style="background:${c}"></span>`, () => { color = c; if (tool !== 'highlighter') setTool('pen'); refresh() })
    b.dataset.color = c
    swatchButtons.push(b)
    bar.append(b)
  }
  bar.append(sep())
  for (const s of SIZES) {
    const b = button(`Width ${s}`, `<span class="pp-dot" style="width:${s + 3}px;height:${s + 3}px"></span>`, () => { size = s; refresh() })
    b.dataset.size = s
    sizeButtons.push(b)
    bar.append(b)
  }
  bar.append(sep())
  bar.append(button('Undo (Ctrl+Z)', '&#8630;', undo))
  bar.append(button('Clear slide', '&#128465;', clearPage))
  bar.append(sep())
  bar.append(button('New board after this slide', '&#65291; Board', addBoard))
  bar.append(button('Delete this board', '&#10005; Board', deleteBoard, 'pp-board-only'))
  const statusEl = Object.assign(document.createElement('span'), { className: 'pp-status' })
  statusEl.setAttribute('aria-live', 'polite')
  bar.append(statusEl)
  bar.append(button('Stop annotating (Esc)', 'Done', () => setTool(null)))
  // Clicks on the toolbar aren't strokes or slide changes
  for (const type of ['pointerdown', 'touchstart', 'mousedown']) bar.addEventListener(type, e => e.stopPropagation())
  document.body.appendChild(bar)

  function status(text) { statusEl.textContent = text }
  function refresh() {
    document.documentElement.classList.toggle('pp-on', !!tool)
    document.documentElement.classList.toggle('pp-on-board', !!boardOf(currentPage()))
    bar.classList.toggle('pp-open', !!tool)
    for (const [name, b] of Object.entries(toolButtons)) b.setAttribute('aria-pressed', String(tool === name))
    for (const b of swatchButtons) b.setAttribute('aria-pressed', String(b.dataset.color === color))
    for (const b of sizeButtons) b.setAttribute('aria-pressed', String(Number(b.dataset.size) === size))
    shield.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair'
  }
  function setTool(name) {
    tool = name
    refresh()
  }
  Reveal.on('slidechanged', refresh)

  // D toggles drawing, E the eraser, Esc stops, Ctrl/Cmd+Z undoes; the rest is reveal.js's
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return
    const key = e.key.toLowerCase()
    let handled = true
    if (key === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) setTool(tool ? null : 'pen')
    else if (tool && key === 'e' && !e.ctrlKey && !e.metaKey) setTool('eraser')
    else if (tool && key === 'escape') setTool(null)
    else if (key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) undo()
    else handled = false
    if (handled) { e.preventDefault(); e.stopPropagation() }
  }, true)

  // ── Start ────────────────────────────────────────────────────────────────
  restoreBoards()
  document.querySelectorAll('.reveal .slides section[data-slide-id], .reveal .slides section[data-board-id]').forEach(s => {
    const board = boardOf(s)
    if ((board ? board.paths : set.slides[keyOf(s)]?.paths || []).length) render(s)
  })
  refresh()
  return { flush, setTool, get set() { return set } }
}
