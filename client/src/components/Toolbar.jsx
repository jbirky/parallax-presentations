// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The toolbar: one row of the basics, as in Google Slides. Undo and Redo, New
// slide, then Text box, Image, Shape, Table, Insert (everything else, in
// groups) and Science (Parallax's own elements), then what the selection
// offers (Crop, Edit, Align) and the slide's Background. While a text box is
// selected or being edited, its formatting tools take the place of the
// insert tools.

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { slideHref, slideIdFromHref, slideLabel } from '../utils/clickActions'
import { keyLabel, withShortcut, SHORTCUTS } from '../utils/shortcuts'
import BackgroundEditor, { BackgroundSwatch } from './BackgroundEditor'
import {
  Undo2, Redo2,
  Pencil,
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered,
  Code, FileCode, Quote,
  Link, Unlink,
  Image,
  Type,
  RemoveFormatting,
  Upload,
  Shapes,
  Table2,
  Highlighter,
  Group,
  Ungroup,
  HelpCircle,
  Check,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Crop,
  ImageUp,
  FlaskConical,
  LayoutGrid,
  AlignHorizontalSpaceAround,
  Palette,
} from 'lucide-react'
import { SHAPES } from '../utils/shapeUtils'

const DOCS_BASE = '/#docs/tutorials/'
const DocsLink = ({ page, onClose }) => (
  <>
    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
    <a href={`${DOCS_BASE}${page}`} target="_blank" rel="noopener noreferrer" onClick={() => onClose?.()} className="tool-menu-docs">
      <HelpCircle size={12} /> How to use
    </a>
  </>
)

const COLOR_PALETTE = [
  '#ffffff','#e2e8f0','#94a3b8','#64748b','#334155','#1e293b','#0f172a','#000000',
  '#fca5a5','#f87171','#ef4444','#dc2626','#fcd34d','#fbbf24','#f59e0b','#d97706',
  '#86efac','#4ade80','#22c55e','#16a34a','#6ee7b7','#34d399','#10b981','#059669',
  '#93c5fd','#60a5fa','#3b82f6','#2563eb','#a5b4fc','#818cf8','#6366f1','#4f46e5',
  '#d8b4fe','#c084fc','#a855f7','#7c3aed','#f5d0fe','#f0abfc','#e879f9','#d946ef',
]

const ICON_NAMES = ['Star','Heart','Check','X','AlertTriangle','Info','ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Zap','Target','Award','BookOpen','Briefcase','Calendar','Camera','Cloud','Coffee','Cpu','Database','Eye','Flag','Globe','Home','Key','Layers','Lock','Mail','Map','MessageCircle','Monitor','Moon','Music','Phone','Play','Search','Settings','Shield','Sun','ThumbsUp','ThumbsDown','Trash2','TrendingUp','TrendingDown','User','Users','Wifi','Wrench','Lightbulb','Rocket','Clock','Gift','Link','Clipboard','FileText','Folder','Image','PieChart','BarChart3']


export const ALIGN_COMMANDS = [
  ['left', 'Align left'], ['center-h', 'Align centers'], ['right', 'Align right'],
  ['top', 'Align top'], ['center-v', 'Align middles'], ['bottom', 'Align bottom'],
  ['distribute-h', 'Distribute horizontally'], ['distribute-v', 'Distribute vertically'],
]

// A toolbar button with a dropdown under it
function ToolMenu({ id, open, onToggle, onClose, icon, label, title, width, align = 'left', minor = false, children }) {
  return (
    <div style={{ position: 'relative' }}>
      <button className={`btn-icon toolbar-labeled ${open ? 'active' : ''}`} title={title || label} aria-label={label}
        aria-haspopup="true" aria-expanded={open} onClick={() => onToggle(id)}>
        {icon} <span className={`tl-text ${minor ? 'tl-minor' : ''}`}>{label}</span> <ChevronDown size={11} style={{ opacity: 0.6 }} aria-hidden="true" />
      </button>
      {open && (<>
        <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={onClose} />
        <div className="tool-menu" data-menu={id} onMouseDown={e => e.stopPropagation()}
          style={{ [align]: 0, ...(width ? { width } : {}) }}>
          {children}
        </div>
      </>)}
    </div>
  )
}

// A rows-by-columns grid: point at the size, click to insert
export function TablePicker({ onPick, rows = 8, cols = 10 }) {
  const [size, setSize] = useState([3, 3])
  const [r, c] = size
  return (
    <div>
      <div role="grid" aria-label="Table size" tabIndex={0} autoFocus
        onKeyDown={e => {
          const moves = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] }
          if (moves[e.key]) {
            e.preventDefault()
            setSize(([a, b]) => [Math.max(1, Math.min(rows, a + moves[e.key][0])), Math.max(1, Math.min(cols, b + moves[e.key][1]))])
          } else if (e.key === 'Enter') { e.preventDefault(); onPick(r, c) }
        }}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 16px)`, gap: 3, outline: 'none' }}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const row = Math.floor(i / cols) + 1
          const col = (i % cols) + 1
          const on = row <= r && col <= c
          return (
            <button key={i} type="button" aria-label={`${row} × ${col}`}
              onMouseEnter={() => setSize([row, col])} onClick={() => onPick(row, col)}
              style={{ width: 16, height: 16, padding: 0, borderRadius: 2, cursor: 'pointer',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(99,102,241,0.35)' : 'var(--bg-hover)' }} />
          )
        })}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }} aria-live="polite">
        {r} {r === 1 ? 'row' : 'rows'} × {c} {c === 1 ? 'column' : 'columns'}
      </div>
    </div>
  )
}

// What can be added, in groups under headings, with a search field when
// asked: [{ heading, docs, items: [{ label, icon, title, keywords, action, items }] }]
export function InsertList({ groups, onClose, searchable = false }) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (item, heading) => words.every(w => `${heading || ''} ${item.label} ${item.keywords || ''}`.toLowerCase().includes(w))
  const shown = groups.filter(Boolean).map(group => ({
    ...group,
    items: group.items.filter(Boolean).flatMap(item => {
      if (!words.length || matches(item, group.heading)) return [item]
      const sub = (item.items || []).filter(s => matches(s, `${group.heading} ${item.label}`))
      return sub.length ? [{ ...item, items: sub }] : []
    }),
  })).filter(group => group.items.length)
  const run = item => { onClose(); item.action() }
  const first = shown[0]?.items[0]

  return (
    <div className="insert-list">
      {searchable && (
        <div className="insert-search">
          <Search size={13} aria-hidden="true" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" aria-label="Search what to insert"
            onKeyDown={e => { if (e.key === 'Enter' && first) { e.preventDefault(); first.items ? setExpanded(first.label) : run(first) } }} />
        </div>
      )}
      {shown.map((group, g) => (
        <div key={group.heading || g} role="group" aria-label={group.heading}>
          {group.heading && (
            <div className="insert-heading">
              <span>{group.heading}</span>
              {group.docs && (
                <a href={`${DOCS_BASE}${group.docs}`} target="_blank" rel="noopener noreferrer" onClick={onClose} title={`How to use: ${group.heading}`} aria-label={`How to use: ${group.heading}`}>
                  <HelpCircle size={11} />
                </a>
              )}
            </div>
          )}
          {group.items.map(item => {
            const open = item.items && (expanded === item.label || words.length > 0)
            return (
              <div key={item.label}>
                <button type="button" className="insert-item" title={item.title} disabled={item.disabled}
                  aria-expanded={item.items ? !!open : undefined}
                  onClick={() => (item.items ? setExpanded(open ? null : item.label) : run(item))}>
                  <span className="insert-icon" aria-hidden="true">{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.items && <ChevronRight size={12} style={{ opacity: 0.6, transform: open ? 'rotate(90deg)' : undefined }} aria-hidden="true" />}
                </button>
                {open && item.items.map(sub => (
                  <button key={sub.label} type="button" className="insert-item insert-sub" title={sub.title} onClick={() => run(sub)}>
                    <span className="insert-icon" aria-hidden="true">{sub.icon}</span>
                    <span style={{ flex: 1 }}>{sub.label}</span>
                  </button>
                ))}
              </div>
            )
          })}
          {!group.heading && group.docs && <DocsLink page={group.docs} onClose={onClose} />}
        </div>
      ))}
      {searchable && !shown.length && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Nothing matches “{query.trim()}”.</div>}
    </div>
  )
}

export default function Toolbar({
  editor, editingElementId, wholeBox = false,
  onUndo, onRedo, canUndo, canRedo,
  onNewSlide, onNewSlideFromLayout,
  onAddText, onAddImage, onUploadImage, onAddShape, onAddIcon, onAddCallout, onAddTable,
  insertGroups = [], scienceItems = [],
  selection = null, onSelectionCommand, onAlignElements,
  slide, slides = [], onUpdateSlide,
  drawTool, onSetDrawTool,
  customFonts = [], onManageFonts,
  request = null,
  theme = 'black', themeColors = null, onTheme, themesOpen = false,
}) {
  // The insert tools' dropdown that's open: 'image', 'shape', 'table',
  // 'insert', 'science', 'align' or 'background'
  const [openMenu, setOpenMenu] = useState(null)
  const toggleMenu = id => setOpenMenu(m => (m === id ? null : id))
  const closeMenu = () => { setOpenMenu(null); setIconSearch('') }
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showColorPalette, setShowColorPalette] = useState(false)
  const [showHighlightPalette, setShowHighlightPalette] = useState(false)
  const [iconSearch, setIconSearch] = useState('')
  const [linkModal, setLinkModal] = useState(null)
  const linkInputRef = useRef(null)
  const [showMoreFormat, setShowMoreFormat] = useState(false)
  const moreFormatRef = useRef(null)

  // While text is being edited, its formatting tools take the place of the
  // insert tools. The toolbar keeps at least the height it had before, so the
  // slide below doesn't move when editing starts or ends
  const toolbarRef = useRef(null)
  const [insertHeight, setInsertHeight] = useState(0)
  const editing = !!editor
  useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el || editing) return
    const measure = () => setInsertHeight(el.getBoundingClientRect().height)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [editing])

  // A toolbar too narrow for one row drops its buttons' words: first the
  // minor ones' (level 1), then all (level 2). The level is worked out
  // before each paint from the row's natural widths, measured unwrapped
  const [compact, setCompact] = useState(0)
  const levelRef = useRef(0)
  const measureCompact = useRef(() => {})
  measureCompact.current = () => {
    const el = toolbarRef.current
    const width = el?.clientWidth
    if (!width) return
    const classes = el.classList
    const had = [...classes].filter(c => c.startsWith('toolbar-compact'))
    const wrap = el.style.flexWrap
    had.forEach(c => classes.remove(c))
    el.style.flexWrap = 'nowrap'
    const natural = el.scrollWidth
    classes.add('toolbar-compact', 'toolbar-compact-1')
    const minorHidden = el.scrollWidth
    classes.remove('toolbar-compact', 'toolbar-compact-1')
    el.style.flexWrap = wrap
    had.forEach(c => classes.add(c))
    const level = natural <= width ? 0 : minorHidden <= width ? 1 : 2
    if (level !== levelRef.current) { levelRef.current = level; setCompact(level) }
  }
  useLayoutEffect(() => measureCompact.current())
  useEffect(() => {
    const el = toolbarRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measureCompact.current())
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The formatting row: alignment, lists, link, math, table, headings and
  // clear formatting take what room is left, in that order; the groups that
  // don't fit are hidden and offered under More
  const zoneRef = useRef(null)
  const [hiddenGroups, setHiddenGroups] = useState([])
  const inLink = !!editor?.isActive?.('link')
  useLayoutEffect(() => {
    const zone = zoneRef.current
    if (!zone) { setHiddenGroups(h => (h.length ? [] : h)); return }
    const measure = () => {
      // Wrapped to a second line, or (the first, which never wraps) too wide
      const hidden = [...zone.children].filter(g => g.offsetTop > 2 || g.offsetLeft + g.offsetWidth > zone.clientWidth + 1).map(g => g.dataset.group)
      setHiddenGroups(prev => (prev.join() === hidden.join() ? prev : hidden))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(zone)
    return () => observer.disconnect()
  }, [editing, wholeBox, inLink])

  useEffect(() => {
    if (!showMoreFormat) return
    const close = e => { if (!moreFormatRef.current?.contains(e.target)) setShowMoreFormat(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showMoreFormat])
  useEffect(() => { if (!editing) setShowMoreFormat(false) }, [editing])
  useEffect(() => { if (editing || drawTool) setOpenMenu(null) }, [editing, drawTool])
  // Undo while editing text undoes the typing; for a selected box (a whole-box
  // stand-in), it's the presentation's
  const textUndo = editing && !wholeBox

  // A menu asking for one of the dropdowns: Slide › Background…, Insert › Table…
  useEffect(() => { if (request?.name) setOpenMenu(request.name) }, [request?.n]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes the dropdown, and nothing else
  useEffect(() => {
    if (!openMenu) return
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [openMenu])

  useEffect(() => {
    if (!showColorPalette) return
    const close = () => setShowColorPalette(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showColorPalette])

  useEffect(() => {
    if (!showHighlightPalette) return
    const close = () => setShowHighlightPalette(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showHighlightPalette])

  function handleLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href || ''
    const linkedSlide = slideIdFromHref(previousUrl)
    setLinkModal({
      mode: linkedSlide ? 'slide' : 'web',
      url: linkedSlide ? 'https://' : previousUrl || 'https://',
      slideId: linkedSlide || slides.find(s => s.id && s.id !== slide?.id)?.id || '',
      isEdit: !!previousUrl,
    })
    if (!linkedSlide) setTimeout(() => linkInputRef.current?.select(), 50)
  }

  function submitLink() {
    if (!editor || !linkModal) return
    // A slide link opens in the same page, and follows the slide wherever it moves
    if (linkModal.mode === 'slide') {
      if (linkModal.slideId) editor.chain().focus().extendMarkRange('link').setLink({ href: slideHref(linkModal.slideId), target: null }).run()
      setLinkModal(null)
      return
    }
    const url = linkModal.url.trim()
    if (url === '' || url === 'https://') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
    setLinkModal(null)
  }

  useEffect(() => {
    if (!editor || !editingElementId) return
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        handleLink()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editor, editingElementId])

  function handleImage() {
    if (!editor) return
    const url = window.prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  function handleClearFormatting() {
    if (!editor) return
    editor.chain().focus().clearNodes().unsetAllMarks().run()
  }

  const currentColor = editor ? (editor.getAttributes('textStyle').color || '#ffffff') : '#ffffff'
  // Falls back to the first preset so the custom picker opens on a usable
  // highlight rather than white when nothing is highlighted yet.
  const currentHighlight = editor ? (editor.getAttributes('highlight').color || '#fef08a') : '#fef08a'

  // The formatting groups as More's items, when they don't fit in the row
  const chain = () => editor.chain().focus()
  const overflowItems = editor ? {
    align: [
      { keys: SHORTCUTS.alignLeft, label: 'Align left', icon: <AlignLeft size={14} />, on: editor.isActive({ textAlign: 'left' }), run: () => chain().setTextAlign('left').run() },
      { keys: SHORTCUTS.alignCenter, label: 'Align center', icon: <AlignCenter size={14} />, on: editor.isActive({ textAlign: 'center' }), run: () => chain().setTextAlign('center').run() },
      { keys: SHORTCUTS.alignRight, label: 'Align right', icon: <AlignRight size={14} />, on: editor.isActive({ textAlign: 'right' }), run: () => chain().setTextAlign('right').run() },
    ],
    lists: [
      { keys: SHORTCUTS.bulletList, label: 'Bullet list', icon: <List size={14} />, on: editor.isActive('bulletList'), run: () => chain().toggleBulletList().run() },
      { keys: SHORTCUTS.orderedList, label: 'Ordered list', icon: <ListOrdered size={14} />, on: editor.isActive('orderedList'), run: () => chain().toggleOrderedList().run() },
    ],
    link: [
      { keys: SHORTCUTS.link, label: 'Link…', icon: <Link size={14} />, on: inLink, run: handleLink },
      inLink && { label: 'Remove link', icon: <Unlink size={14} />, run: () => chain().unsetLink().run() },
    ].filter(Boolean),
    math: [
      { label: 'Inline math…', icon: <span style={{ fontFamily: 'serif', fontWeight: 700, width: 14, textAlign: 'center' }}>∑</span>, run: () => { const latex = window.prompt('LaTeX (inline):', 'E = mc^2'); if (latex) chain().insertMath(latex, false).run() } },
      { label: 'Display math…', icon: <span style={{ fontFamily: 'serif', fontWeight: 700, width: 14, textAlign: 'center' }}>∫</span>, run: () => { const latex = window.prompt('LaTeX (display):', '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}'); if (latex) chain().insertMath(latex, true).run() } },
    ],
    table: [
      { label: 'Insert table…', icon: <Table2 size={14} />, run: () => { const r = parseInt(window.prompt('Rows:', '3') || '3'); const c = parseInt(window.prompt('Cols:', '3') || '3'); if (r && c) chain().insertTable({ rows: r, cols: c, withHeaderRow: true }).run() } },
      ...(editor.isActive('table') ? [
        ['Add row before', c => c.addRowBefore()], ['Add row after', c => c.addRowAfter()], ['Delete row', c => c.deleteRow()],
        ['Add column before', c => c.addColumnBefore()], ['Add column after', c => c.addColumnAfter()], ['Delete column', c => c.deleteColumn()],
        ['Delete table', c => c.deleteTable()],
      ].map(([label, op]) => ({ label, icon: <span style={{ width: 14 }} />, run: () => op(chain()).run() })) : []),
    ],
    headings: [
      { keys: SHORTCUTS.heading1, label: 'Heading 1', icon: <span style={{ fontSize: 11, fontWeight: 700, width: 14 }}>H1</span>, on: editor.isActive('heading', { level: 1 }), run: () => chain().toggleHeading({ level: 1 }).run() },
      { keys: SHORTCUTS.heading2, label: 'Heading 2', icon: <span style={{ fontSize: 11, fontWeight: 700, width: 14 }}>H2</span>, on: editor.isActive('heading', { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
      { keys: SHORTCUTS.heading3, label: 'Heading 3', icon: <span style={{ fontSize: 11, fontWeight: 700, width: 14 }}>H3</span>, on: editor.isActive('heading', { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() },
      { keys: SHORTCUTS.paragraph, label: 'Normal text', icon: <Type size={14} />, on: editor.isActive('paragraph') && !editor.isActive('heading'), run: () => chain().setParagraph().run() },
    ],
    clear: [{ label: 'Clear formatting', icon: <RemoveFormatting size={14} />, run: handleClearFormatting }],
  } : {}

  const menuProps = { onToggle: toggleMenu, onClose: closeMenu }
  const pickFromMenu = action => () => { closeMenu(); action() }

  return (
    <div className={`toolbar ${compact ? `toolbar-compact toolbar-compact-${compact}` : ''}`} ref={toolbarRef}
      style={editing && insertHeight ? { minHeight: insertHeight, boxSizing: 'border-box' } : undefined}>
      {/* Undo / Redo: the presentation's, or while editing text, the text's,
          as Ctrl+Z does */}
      <button className="btn-icon" title={withShortcut('Undo', SHORTCUTS.undo)}
        onClick={textUndo ? () => editor.chain().focus().undo().run() : onUndo}
        disabled={textUndo ? !editor.can().undo() : !canUndo}>
        <Undo2 size={14} />
      </button>
      <button className="btn-icon" title={withShortcut('Redo', SHORTCUTS.redo)}
        onClick={textUndo ? () => editor.chain().focus().redo().run() : onRedo}
        disabled={textUndo ? !editor.can().redo() : !canRedo}>
        <Redo2 size={14} />
      </button>
      {/* New slide: after this one, in the layout that follows; ▾ picks the layout */}
      {onNewSlide && (
        <div className="split-button">
          <button className="btn-icon toolbar-labeled" title={withShortcut('New slide', SHORTCUTS.newSlide)} aria-label="New slide" onClick={onNewSlide}>
            <Plus size={14} />{!editing && <span className="tl-text">New slide</span>}
          </button>
          {onNewSlideFromLayout && (
            <button className="btn-icon split-arrow" title="New slide from a layout" aria-label="New slide from a layout" onClick={onNewSlideFromLayout}>
              <ChevronDown size={11} />
            </button>
          )}
        </div>
      )}
      <span className="toolbar-divider" />

      {/* The insert tools, out of the way while text is being edited or drawn */}
      {!editor && !drawTool && (<>
        <button className="btn-icon toolbar-labeled" title="Text box" aria-label="Text box" onClick={onAddText}>
          <Type size={14} /> <span className="tl-text">Text box</span>
        </button>

        <ToolMenu id="image" minor open={openMenu === 'image'} {...menuProps} icon={<Image size={14} />} label="Image">
          <button className="tool-menu-item" onClick={pickFromMenu(onUploadImage)}><Upload size={14} /> Upload image…</button>
          <button className="tool-menu-item" onClick={pickFromMenu(onAddImage)}><Link size={14} /> Image from URL…</button>
          <DocsLink page="images" onClose={closeMenu} />
        </ToolMenu>

        <ToolMenu id="shape" minor open={openMenu === 'shape'} {...menuProps} icon={<Shapes size={14} />} label="Shape" width={260}>
          <div style={{ padding: '4px 6px' }}>
            <div className="tool-menu-heading">Shapes</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 8 }}>
              {SHAPES.map(s => (
                <button key={s.id} title={s.name} aria-label={s.name} className="shape-choice" onClick={pickFromMenu(() => onAddShape(s.id))}>
                  <span>{s.icon}</span><span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            {onAddCallout && (
              <button className="tool-menu-item" style={{ padding: '6px 4px' }} onClick={pickFromMenu(onAddCallout)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>1</span> Callout
              </button>
            )}
            {onAddIcon && (<>
              <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
              <div className="tool-menu-heading">Icons</div>
              <input type="text" placeholder="Search icons..." aria-label="Search icons" value={iconSearch} onChange={e => setIconSearch(e.target.value)} style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3, maxHeight: 140, overflow: 'auto' }}>
                {ICON_NAMES.filter(name => !iconSearch || name.toLowerCase().includes(iconSearch.toLowerCase())).map(name => (
                  <button key={name} title={name} style={{ padding: 6, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: 'var(--text-primary)', textAlign: 'center' }} onClick={pickFromMenu(() => onAddIcon(name))}>{name.slice(0, 3)}</button>
                ))}
              </div>
            </>)}
          </div>
          <DocsLink page="shapes-drawing" onClose={closeMenu} />
        </ToolMenu>

        {onAddTable && (
          <ToolMenu id="table" minor open={openMenu === 'table'} {...menuProps} icon={<Table2 size={14} />} label="Table" title="Table: pick its rows and columns">
            <div style={{ padding: 8 }}>
              <TablePicker onPick={(r, c) => { closeMenu(); onAddTable(r, c) }} />
            </div>
            <DocsLink page="tables" onClose={closeMenu} />
          </ToolMenu>
        )}

        {insertGroups.length > 0 && (
          <ToolMenu id="insert" open={openMenu === 'insert'} {...menuProps} icon={<LayoutGrid size={14} />} label="Insert" title="Everything else that can go on a slide" width={250}>
            <InsertList groups={insertGroups} onClose={closeMenu} searchable />
          </ToolMenu>
        )}

        {scienceItems.length > 0 && (
          <ToolMenu id="science" open={openMenu === 'science'} {...menuProps} icon={<FlaskConical size={14} />} label="Science" title="Graphs, diagrams, molecules and more" width={230}>
            <InsertList groups={[{ items: scienceItems, docs: 'diagrams' }]} onClose={closeMenu} />
          </ToolMenu>
        )}

        {/* What the selection offers: an image's Crop and Replace, a
            diagram's Edit, and for several elements, Align and Group */}
        {selection && (selection.image || selection.editLabel || selection.count >= 2 || selection.canUngroup) && (<>
          <span className="toolbar-divider" />
          {selection.image && (<>
            <button className="btn-icon toolbar-labeled" title="Crop the image" aria-label="Crop" onClick={() => onSelectionCommand?.('crop')}><Crop size={14} /> <span className="tl-text tl-minor">Crop</span></button>
            <button className="btn-icon toolbar-labeled" title="Replace the image with another file" aria-label="Replace image" onClick={() => onSelectionCommand?.('replace-image')}><ImageUp size={14} /> <span className="tl-text tl-minor">Replace</span></button>
          </>)}
          {selection.editLabel && (
            <button className="btn-icon toolbar-labeled" title={selection.editLabel} aria-label={selection.editLabel} onClick={() => onSelectionCommand?.('edit')}><Pencil size={14} /> <span className="tl-text tl-minor">Edit</span></button>
          )}
          {selection.count >= 2 && onAlignElements && (
            <ToolMenu id="align" minor open={openMenu === 'align'} {...menuProps} icon={<AlignHorizontalSpaceAround size={14} />} label="Align" title={`Align or distribute the ${selection.count} selected`}>
              {ALIGN_COMMANDS.map(([type, label]) => (
                <button key={type} className="tool-menu-item" onClick={pickFromMenu(() => onAlignElements(type))}>{label}</button>
              ))}
            </ToolMenu>
          )}
          {selection.count >= 2 && (
            <button className="btn-icon" title={withShortcut('Group', SHORTCUTS.group)} aria-label="Group" onClick={() => onSelectionCommand?.('group')}><Group size={14} /></button>
          )}
          {selection.canUngroup && (
            <button className="btn-icon" title={withShortcut('Ungroup', SHORTCUTS.ungroup)} aria-label="Ungroup" onClick={() => onSelectionCommand?.('ungroup')}><Ungroup size={14} /></button>
          )}
        </>)}

        <span className="toolbar-divider" />
        {/* The deck's theme, in a panel beside the slide */}
        {onTheme && (
          <button className={`btn-icon toolbar-labeled ${themesOpen ? 'active' : ''}`} title="Themes: the presentation's colors and text styles" aria-label="Theme" aria-pressed={themesOpen} onClick={onTheme}>
            <Palette size={14} /> <span className="tl-text tl-minor">Theme</span>
          </button>
        )}
        {/* The slide's background */}
        {slide && onUpdateSlide && (
          <ToolMenu id="background" minor open={openMenu === 'background'} {...menuProps} icon={<BackgroundSwatch background={slide.background} theme={theme} colors={themeColors} />} label="Background" title="The slide's background" width={260}>
            <div style={{ padding: 8 }}>
              <BackgroundEditor slide={slide} onUpdateSlide={onUpdateSlide} theme={theme} colors={themeColors} />
            </div>
          </ToolMenu>
        )}

        {/* Hint when nothing is selected or being edited */}
        {!selection?.count && (
          <span className="toolbar-hint"><span>Double-click a text box to edit</span></span>
        )}
      </>)}

      {/* Drawing: the pen, in place of the insert tools */}
      {!editor && drawTool && (<>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '0 6px', display: 'flex', alignItems: 'center', gap: 4 }}><Pencil size={14} /> Drawing</span>
        <input type="color"
          title="Stroke color"
          aria-label="Stroke color"
          value={drawTool.color || '#ffffff'}
          onChange={e => onSetDrawTool({ ...drawTool, color: e.target.value })}
          style={{ width: 28, height: 28, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
        />
        <select
          title="Stroke width"
          value={drawTool.strokeWidth || 3}
          onChange={e => onSetDrawTool({ ...drawTool, strokeWidth: Number(e.target.value) })}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '2px 4px', borderRadius: 4, fontSize: 12, width: 52 }}
        >
          {[1, 2, 3, 4, 6, 8, 12, 18].map(w => <option key={w} value={w}>{w}px</option>)}
        </select>
        <select
          title="Opacity"
          value={drawTool.opacity ?? 1}
          onChange={e => onSetDrawTool({ ...drawTool, opacity: Number(e.target.value) })}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '2px 4px', borderRadius: 4, fontSize: 12, width: 60 }}
        >
          {[1, 0.75, 0.5, 0.25].map(o => <option key={o} value={o}>{Math.round(o * 100)}%</option>)}
        </select>
        <button
          className={`btn-icon ${drawTool.smooth ? 'active' : ''}`}
          title={drawTool.smooth ? 'Auto-smooth: on' : 'Auto-smooth: off'}
          onClick={() => onSetDrawTool({ ...drawTool, smooth: !drawTool.smooth })}
          style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
        >
          ~
        </button>
        <button className="btn btn-primary" title="Stop drawing (Esc)" onClick={() => onSetDrawTool(null)} style={{ padding: '3px 10px', fontSize: 12, marginLeft: 4 }}>
          Done
        </button>
      </>)}


      {editor && (
        <>
          {/* Font Family */}
          <select
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
            className="font-family-select"
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={e => e.target.value ? editor.chain().focus().setFontFamily(e.target.value).run() : editor.chain().focus().unsetFontFamily().run()}
            title="Font family"
          >
            <option value="">Default</option>
            {customFonts.length > 0 && (
              <optgroup label="My Fonts">
                {customFonts.map(f => (
                  <option key={f.id} value={`'${f.familyName}', sans-serif`}>{f.familyName}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Sans-serif">
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Helvetica Neue', sans-serif">Helvetica</option>
              <option value="Verdana, sans-serif">Verdana</option>
              <option value="Tahoma, sans-serif">Tahoma</option>
              <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
              <option value="Inter, sans-serif">Inter</option>
              <option value="'Inter Tight', sans-serif">Inter Tight</option>
              <option value="Roboto, sans-serif">Roboto</option>
              <option value="'Roboto Flex', sans-serif">Roboto Flex</option>
              <option value="'Open Sans', sans-serif">Open Sans</option>
              <option value="'Source Sans Pro', sans-serif">Source Sans Pro</option>
              <option value="'Source Sans 3', sans-serif">Source Sans 3</option>
              <option value="'Fira Sans', sans-serif">Fira Sans</option>
              <option value="'IBM Plex Sans', sans-serif">IBM Plex Sans</option>
              <option value="Manrope, sans-serif">Manrope</option>
              <option value="Geist, sans-serif">Geist</option>
              <option value="Figtree, sans-serif">Figtree</option>
              <option value="'Public Sans', sans-serif">Public Sans</option>
              <option value="Jost, sans-serif">Jost</option>
              <option value="'Pixelify Sans', sans-serif">Pixelify Sans</option>
              <option value="'Press Start 2P', monospace">Press Start 2P</option>
              <option value="VT323, monospace">VT323</option>
              <option value="Ubuntu, sans-serif">Ubuntu</option>
              <option value="Rubik, sans-serif">Rubik</option>
              <option value="'PT Sans', sans-serif">PT Sans</option>
              <option value="'Istok Web', sans-serif">Istok Web</option>
              <option value="'Didact Gothic', sans-serif">Didact Gothic</option>
              <option value="Questrial, sans-serif">Questrial</option>
              <option value="Barlow, sans-serif">Barlow</option>
              <option value="'Libre Franklin', sans-serif">Libre Franklin</option>
              <option value="'Bricolage Grotesque', sans-serif">Bricolage Grotesque</option>
              <option value="Lexend, sans-serif">Lexend</option>
              <option value="Archivo, sans-serif">Archivo</option>
              <option value="'Computer Modern Sans', sans-serif">Computer Modern Sans</option>
              <option value="'Humanist 777 BT', 'Gill Sans', 'Gill Sans MT', Calibri, sans-serif">Humanist 777</option>
            </optgroup>
            <optgroup label="Rounded">
              <option value="Comfortaa, sans-serif">Comfortaa</option>
              <option value="Nunito, sans-serif">Nunito</option>
              <option value="'Nunito Sans', sans-serif">Nunito Sans</option>
              <option value="Quicksand, sans-serif">Quicksand</option>
              <option value="Dosis, sans-serif">Dosis</option>
              <option value="'M PLUS Rounded 1c', sans-serif">M PLUS Rounded 1c</option>
              <option value="Jura, sans-serif">Jura</option>
            </optgroup>
            <optgroup label="Condensed">
              <option value="'Barlow Condensed', sans-serif">Barlow Condensed</option>
              <option value="'Asap Condensed', sans-serif">Asap Condensed</option>
              <option value="'Roboto Condensed', sans-serif">Roboto Condensed</option>
            </optgroup>
            <optgroup label="Serif">
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'Playfair Display', serif">Playfair Display</option>
              <option value="Merriweather, serif">Merriweather</option>
              <option value="'STIX Two Text', serif">STIX Two Text</option>
              <option value="'Computer Modern Serif', serif">Computer Modern</option>
              <option value="'Latin Modern Roman', serif">Latin Modern Roman</option>
            </optgroup>
            <optgroup label="Monospace">
              <option value="'Courier New', monospace">Courier New</option>
              <option value="'Courier Prime', monospace">Courier Prime</option>
              <option value="'Fira Code', monospace">Fira Code</option>
              <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
              <option value="'DM Mono', monospace">DM Mono</option>
              <option value="Inconsolata, monospace">Inconsolata</option>
              <option value="'Roboto Mono', monospace">Roboto Mono</option>
              <option value="'Space Mono', monospace">Space Mono</option>
            </optgroup>
            <optgroup label="Display">
              <option value="Impact, sans-serif">Impact</option>
              <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
              <option value="Codystar, sans-serif">Codystar</option>
              <option value="'National Park', sans-serif">National Park</option>
              <option value="'Futura PT', Futura, 'Century Gothic', sans-serif">Futura</option>
              <option value="'Bauhaus 93', Impact, sans-serif">Bauhaus 93</option>
              <option value="Caveat, cursive">Caveat</option>
              <option value="'Architects Daughter', cursive">Architects Daughter</option>
            </optgroup>
          </select>
          {onManageFonts && (
            <button
              onClick={onManageFonts}
              title="Manage custom fonts"
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 4, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
            >
              +
            </button>
          )}

          {/* Font Size */}
          <select
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: 4, fontSize: 12, width: 60, cursor: 'pointer' }}
            value={editor.getAttributes('textStyle').fontSize || ''}
            onChange={e => e.target.value ? editor.chain().focus().setFontSize(e.target.value).run() : editor.chain().focus().unsetFontSize().run()}
            title="Font size"
          >
            <option value="">Auto</option>
            {['10px','12px','14px','16px','18px','20px','24px','28px','32px','36px','40px','48px','56px','64px','72px','96px'].map(s => (
              <option key={s} value={s}>{s.replace('px','')}</option>
            ))}
          </select>

          <span className="toolbar-divider" />

          {/* Text formatting */}
          <button
            className={`btn-icon ${editor.isActive('bold') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title={withShortcut('Bold', SHORTCUTS.bold)}
          >
            <Bold size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive('italic') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title={withShortcut('Italic', SHORTCUTS.italic)}
          >
            <Italic size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive('underline') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title={withShortcut('Underline', SHORTCUTS.underline)}
          >
            <Underline size={15} />
          </button>

          <span className="toolbar-divider" />

          {/* Text color palette */}
          <div style={{ position: 'relative' }}>
            <button
              className={`btn-icon ${showColorPalette ? 'active' : ''}`}
              style={{ position: 'relative' }}
              onClick={() => setShowColorPalette(v => !v)}
              title="Text color"
            >
              <Type size={15} />
              <span className="color-indicator" style={{ background: currentColor }} />
            </button>
            {showColorPalette && (
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)',
                  zIndex: 1000, background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 3,
                }}
              >
                {COLOR_PALETTE.map(color => (
                  <button
                    key={color}
                    title={color}
                    style={{
                      width: 22, height: 22, background: color, padding: 0,
                      border: currentColor.toLowerCase() === color.toLowerCase() ? '2px solid white' : '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                    }}
                    onMouseDown={e => {
                      e.preventDefault()
                      editor.chain().focus().setColor(color).run()
                      setShowColorPalette(false)
                    }}
                  />
                ))}
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Custom</span>
                  <div className="color-btn-wrapper" style={{ flex: 1 }}>
                    <div style={{ width: '100%', height: 22, borderRadius: 4, background: currentColor, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }} />
                    <input
                      type="color"
                      value={currentColor}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                      onChange={e => editor.chain().focus().setColor(e.target.value).run()}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Highlight color palette */}
          <div style={{ position: 'relative' }}>
            <button
              className={`btn-icon ${showHighlightPalette ? 'active' : ''}`}
              style={{ position: 'relative' }}
              onClick={() => setShowHighlightPalette(v => !v)}
              title="Highlight color"
            >
              <Highlighter size={15} />
              <span className="color-indicator" style={{ background: editor.getAttributes('highlight').color || 'transparent', border: '1px solid rgba(255,255,255,0.2)' }} />
            </button>
            {showHighlightPalette && (
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)',
                  zIndex: 1000, background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'grid', gridTemplateColumns: 'repeat(6, 26px)', gap: 3,
                }}
              >
                {[
                  '#fef08a','#fde047','#facc15',
                  '#bbf7d0','#86efac','#4ade80',
                  '#bfdbfe','#93c5fd','#60a5fa',
                  '#fbcfe8','#f9a8d4','#f472b6',
                  '#fed7aa','#fdba74','#fb923c',
                  '#e9d5ff','#d8b4fe','#c084fc',
                  '#fecaca','#fca5a5','#f87171',
                  '#e2e8f0','#94a3b8','#64748b',
                ].map(color => (
                  <button
                    key={color}
                    title={color}
                    style={{
                      width: 26, height: 26, background: color, padding: 0,
                      border: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: 4, cursor: 'pointer',
                    }}
                    onMouseDown={e => {
                      e.preventDefault()
                      editor.chain().focus().setHighlight({ color }).run()
                      setShowHighlightPalette(false)
                    }}
                  />
                ))}
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Custom</span>
                  <div className="color-btn-wrapper" style={{ flex: 1 }}>
                    <div style={{ width: '100%', height: 22, borderRadius: 4, background: currentHighlight, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }} />
                    <input
                      type="color"
                      value={currentHighlight}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                      onChange={e => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
                    />
                  </div>
                </div>
                <button
                  title="Remove highlight"
                  style={{
                    gridColumn: '1 / -1', padding: '4px 8px', marginTop: 4,
                    background: 'var(--bg-hover)', border: '1px solid var(--border)',
                    borderRadius: 4, cursor: 'pointer', color: 'var(--text-primary)',
                    fontSize: 11, textAlign: 'center',
                  }}
                  onMouseDown={e => {
                    e.preventDefault()
                    editor.chain().focus().unsetHighlight().run()
                    setShowHighlightPalette(false)
                  }}
                >
                  Remove highlight
                </button>
              </div>
            )}
          </div>


          {/* What fits of the rest, in one row; what doesn't is under More */}
          <div className="format-overflow" ref={zoneRef}>
            <span className="format-group" data-group="align" data-hidden={hiddenGroups.includes('align') || undefined} aria-hidden={hiddenGroups.includes('align') || undefined}>
              <span className="toolbar-divider" />
              <button
                className={`btn-icon ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                title={withShortcut('Align left', SHORTCUTS.alignLeft)}
              >
                <AlignLeft size={15} />
              </button>
              <button
                className={`btn-icon ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                title={withShortcut('Align center', SHORTCUTS.alignCenter)}
              >
                <AlignCenter size={15} />
              </button>
              <button
                className={`btn-icon ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                title={withShortcut('Align right', SHORTCUTS.alignRight)}
              >
                <AlignRight size={15} />
              </button>
            </span>
            <span className="format-group" data-group="lists" data-hidden={hiddenGroups.includes('lists') || undefined} aria-hidden={hiddenGroups.includes('lists') || undefined}>
              <span className="toolbar-divider" />
              <button
                className={`btn-icon ${editor.isActive('bulletList') ? 'active' : ''}`}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title={withShortcut('Bullet list', SHORTCUTS.bulletList)}
              >
                <List size={15} />
              </button>
              <button
                className={`btn-icon ${editor.isActive('orderedList') ? 'active' : ''}`}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title={withShortcut('Ordered list', SHORTCUTS.orderedList)}
              >
                <ListOrdered size={15} />
              </button>
            </span>
            {!wholeBox && (<>
            <span className="format-group" data-group="link" data-hidden={hiddenGroups.includes('link') || undefined} aria-hidden={hiddenGroups.includes('link') || undefined}>
              <span className="toolbar-divider" />
              <button
                className={`btn-icon ${editor.isActive('link') ? 'active' : ''}`}
                onClick={handleLink}
                title={withShortcut('Add link', SHORTCUTS.link)}
              >
                <Link size={15} />
              </button>
              {editor.isActive('link') && (
                <button
                  className="btn-icon"
                  onClick={() => editor.chain().focus().unsetLink().run()}
                  title="Remove link"
                >
                  <Unlink size={15} />
                </button>
              )}
            </span>
            <span className="format-group" data-group="math" data-hidden={hiddenGroups.includes('math') || undefined} aria-hidden={hiddenGroups.includes('math') || undefined}>
              <span className="toolbar-divider" />
              <button
                className="btn-icon"
                title="Insert inline math ($…$)"
                onClick={() => {
                  const latex = window.prompt('LaTeX (inline):', 'E = mc^2')
                  if (latex) editor.chain().focus().insertMath(latex, false).run()
                }}
                style={{ fontFamily: 'serif', fontWeight: 'bold', fontSize: 14 }}
              >
                ∑
              </button>
              <button
                className="btn-icon"
                title="Insert display math ($$…$$)"
                onClick={() => {
                  const latex = window.prompt('LaTeX (display):', '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}')
                  if (latex) editor.chain().focus().insertMath(latex, true).run()
                }}
                style={{ fontFamily: 'serif', fontWeight: 'bold', fontSize: 14 }}
              >
                ∫
              </button>
            </span>
            <span className="format-group" data-group="table" data-hidden={hiddenGroups.includes('table') || undefined} aria-hidden={hiddenGroups.includes('table') || undefined}>
              <span className="toolbar-divider" />
              <div style={{ position: 'relative' }}>
                <button
                  className={`btn-icon ${editor.isActive('table') ? 'active' : ''}`}
                  title="Table"
                  onClick={() => setShowTableMenu(v => !v)}
                  style={{ fontSize: 13 }}
                >
                  ⊞
                </button>
                {showTableMenu && (
                  <div
                    style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: 4,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: 4, zIndex: 1000, width: 160, display: 'flex', flexDirection: 'column', gap: 2
                    }}
                    onMouseLeave={() => setShowTableMenu(false)}
                  >
                    {[
                      ['Insert Table', () => { const r=parseInt(window.prompt('Rows:','3')||'3'); const c=parseInt(window.prompt('Cols:','3')||'3'); if(r&&c) editor.chain().focus().insertTable({rows:r,cols:c,withHeaderRow:true}).run() }],
                      ['Add Row Before', () => editor.chain().focus().addRowBefore().run()],
                      ['Add Row After',  () => editor.chain().focus().addRowAfter().run()],
                      ['Delete Row',     () => editor.chain().focus().deleteRow().run()],
                      ['Add Col Before', () => editor.chain().focus().addColumnBefore().run()],
                      ['Add Col After',  () => editor.chain().focus().addColumnAfter().run()],
                      ['Delete Col',     () => editor.chain().focus().deleteColumn().run()],
                      ['Delete Table',   () => editor.chain().focus().deleteTable().run()],
                    ].map(([label, action]) => (
                      <button
                        key={label}
                        style={{ padding: '6px 10px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', textAlign: 'left', borderRadius: 4 }}
                        onMouseEnter={e => e.target.style.background='var(--bg-hover)'}
                        onMouseLeave={e => e.target.style.background='none'}
                        onClick={() => { action(); setShowTableMenu(false) }}
                      >{label}</button>
                    ))}
                  </div>
                )}
              </div>
            </span>
            </>)}
            <span className="format-group" data-group="headings" data-hidden={hiddenGroups.includes('headings') || undefined} aria-hidden={hiddenGroups.includes('headings') || undefined}>
              <span className="toolbar-divider" />
              <button
                className={`btn-icon ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                title={withShortcut('Heading 1', SHORTCUTS.heading1)}
                style={{ fontSize: 12, fontWeight: 700, width: 'auto', padding: '0 6px' }}
              >
                H1
              </button>
              <button
                className={`btn-icon ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title={withShortcut('Heading 2', SHORTCUTS.heading2)}
                style={{ fontSize: 12, fontWeight: 700, width: 'auto', padding: '0 6px' }}
              >
                H2
              </button>
              <button
                className={`btn-icon ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title={withShortcut('Heading 3', SHORTCUTS.heading3)}
                style={{ fontSize: 12, fontWeight: 700, width: 'auto', padding: '0 6px' }}
              >
                H3
              </button>
              <button
                className={`btn-icon ${editor.isActive('paragraph') && !editor.isActive('heading') ? 'active' : ''}`}
                onClick={() => editor.chain().focus().setParagraph().run()}
                title={withShortcut('Normal text', SHORTCUTS.paragraph)}
              >
                <Type size={15} />
              </button>
            </span>
            <span className="format-group" data-group="clear" data-hidden={hiddenGroups.includes('clear') || undefined} aria-hidden={hiddenGroups.includes('clear') || undefined}>
              <span className="toolbar-divider" />
              <button
                className="btn-icon"
                onClick={handleClearFormatting}
                title="Clear formatting"
              >
                <RemoveFormatting size={15} />
              </button>
            </span>
          </div>

          <span className="toolbar-divider" />
          {/* The less-used formatting, and what didn't fit in the row */}
          <div ref={moreFormatRef} style={{ position: 'relative' }}>
            <button
              className={`btn-icon ${showMoreFormat ? 'active' : ''}`}
              title="More formatting"
              aria-haspopup="menu"
              aria-expanded={showMoreFormat}
              onClick={() => setShowMoreFormat(v => !v)}
              style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}
            >
              More <span style={{ fontSize: 9, marginLeft: 1, opacity: 0.6 }}>&#9660;</span>
            </button>
            {showMoreFormat && (
              <div role="menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 1000, minWidth: 240, padding: '4px 0' }}>
                {[
                  ...hiddenGroups.flatMap(key => overflowItems[key] || []),
                  hiddenGroups.length > 0 && '-',
                  { label: 'Strikethrough', icon: <Strikethrough size={14} />, keys: SHORTCUTS.strike, on: editor.isActive('strike'), run: () => editor.chain().focus().toggleStrike().run() },
                  { label: 'Inline code', icon: <Code size={14} />, keys: SHORTCUTS.code, on: editor.isActive('code'), run: () => editor.chain().focus().toggleCode().run() },
                  { label: 'Code block', icon: <FileCode size={14} />, keys: SHORTCUTS.codeBlock, on: editor.isActive('codeBlock'), run: () => editor.chain().focus().toggleCodeBlock().run() },
                  { label: 'Quote', icon: <Quote size={14} />, keys: SHORTCUTS.quote, on: editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
                  !wholeBox && { label: 'Image in text', icon: <Image size={14} />, run: handleImage },
                ].filter(Boolean).map((item, i) => item === '-' ? <div key={`line-${i}`} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} /> : (
                  <button
                    key={item.label}
                    role="menuitem"
                    onClick={() => { setShowMoreFormat(false); item.run() }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {item.icon} {item.label}
                    {item.keys && <span className="menu-shortcut" style={{ marginLeft: 'auto', paddingLeft: 12, fontSize: 11, color: 'var(--text-muted)' }}>{keyLabel(item.keys)}</span>}
                    {item.on && <Check size={13} style={{ marginLeft: item.keys ? 6 : 'auto', color: 'var(--accent-light)' }} aria-label="on" />}
                  </button>
                ))}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Weight
                  <select
                    style={{ marginLeft: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: 4, fontSize: 12, width: 110, cursor: 'pointer' }}
                    value={editor.getAttributes('textStyle').fontWeight || ''}
                    onChange={e => e.target.value ? editor.chain().focus().setFontWeight(e.target.value).run() : editor.chain().focus().unsetFontWeight().run()}
                  >
                    <option value="">Default</option>
                    <option value="100">100 Thin</option>
                    <option value="200">200 XLight</option>
                    <option value="300">300 Light</option>
                    <option value="400">400 Regular</option>
                    <option value="500">500 Medium</option>
                    <option value="600">600 SemiBold</option>
                    <option value="700">700 Bold</option>
                    <option value="800">800 ExtraBold</option>
                    <option value="900">900 Black</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Line spacing
                  <select
                    style={{ marginLeft: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: 4, fontSize: 12, width: 110, cursor: 'pointer' }}
                    value={editor.getAttributes('paragraph').lineHeight || editor.getAttributes('heading').lineHeight || ''}
                    onChange={e => e.target.value ? editor.chain().focus().setLineHeight(e.target.value).run() : editor.chain().focus().unsetLineHeight().run()}
                  >
                    <option value="">Default</option>
                    {['0.7', '0.75', '0.8', '0.85', '0.9', '0.95', '1', '1.15', '1.25', '1.5', '1.75', '2', '2.5', '3'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </>
      )}

      {linkModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setLinkModal(null) }}>
          <div style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 10, padding: '20px 24px', width: 380, maxWidth: '90vw', border: '1px solid var(--border, #333)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: 12 }}>
              {linkModal.isEdit ? 'Edit Link' : 'Insert Link'}
            </div>
            <div role="radiogroup" aria-label="Link to" style={{ display: 'flex', gap: 4, marginBottom: 12, padding: 3, borderRadius: 7, background: 'var(--bg-hover, #252530)' }}>
              {[['web', 'Web page'], ['slide', 'Slide']].map(([mode, label]) => (
                <button key={mode} role="radio" aria-checked={linkModal.mode === mode}
                  onClick={() => setLinkModal(prev => ({ ...prev, mode }))}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    background: linkModal.mode === mode ? 'var(--accent, #6366f1)' : 'none', color: linkModal.mode === mode ? '#fff' : 'var(--text-secondary, #aaa)' }}>
                  {label}
                </button>
              ))}
            </div>
            {linkModal.mode === 'slide' ? (<>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 4 }}>Slide</div>
              <select
                value={slides.some(s => s.id && s.id === linkModal.slideId) ? linkModal.slideId : ''}
                onChange={e => setLinkModal(prev => ({ ...prev, slideId: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitLink() } else if (e.key === 'Escape') setLinkModal(null) }}
                aria-label="Slide"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)', color: 'var(--text-primary, #fff)', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                autoFocus
              >
                {!slides.some(s => s.id && s.id === linkModal.slideId) && <option value="">{linkModal.slideId ? 'Slide was deleted' : 'Choose a slide'}</option>}
                {slides.map((s, i) => s.id && <option key={s.id} value={s.id}>{slideLabel(s, i)}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 6 }}>Goes to this slide when presenting, even after slides are reordered.</div>
            </>) : (<>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 4 }}>URL</div>
            <input
              ref={linkInputRef}
              type="text"
              value={linkModal.url}
              onChange={e => setLinkModal(prev => ({ ...prev, url: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitLink() } else if (e.key === 'Escape') setLinkModal(null) }}
              placeholder="https://..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)', color: 'var(--text-primary, #fff)', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
              autoFocus
            />
            </>)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              {linkModal.isEdit && (
                <button onClick={() => { editor?.chain().focus().unsetLink().run(); setLinkModal(null) }}
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border, #333)', background: 'none', color: 'var(--danger, #ef4444)', cursor: 'pointer', fontSize: 12 }}>
                  Remove Link
                </button>
              )}
              <button onClick={() => setLinkModal(null)}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border, #333)', background: 'none', color: 'var(--text-primary, #fff)', cursor: 'pointer', fontSize: 12 }}>
                Cancel
              </button>
              <button onClick={submitLink} disabled={linkModal.mode === 'slide' && !slides.some(s => s.id && s.id === linkModal.slideId)}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent, #6366f1)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {linkModal.isEdit ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
