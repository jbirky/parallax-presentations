// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { ChevronLeft, Pencil, List, ChevronDown, Play, Timer, ListChecks, Github, Settings, Check, X, Search, Share2, CloudUpload, Bot, Video, Music, Clock, History, Monitor, FileText, Users, Type, Box, Code2, Star, Minus, LayoutGrid, Puzzle, ChartSpline, Atom, CircuitBoard, Binary, ArrowDownToDot, Blend, Activity, DraftingCompass, FlaskConical, Grid3x3, Globe, FileCode } from 'lucide-react'
import { api, getAuthToken } from '../utils/api'
import { connectLive } from '../utils/liveDeck'
import { peersFrom, distinctPeople, peopleBySlide, elementsInUse, editorOf, shouldLetGo, editingMessage } from '../utils/presence'
import { SLIDE_TEMPLATES, layoutElements } from '../utils/slideLayouts'
import DiffViewer from '../components/DiffViewer'
import { generateLatexIframeHtml } from '../utils/latexRenderer'
import { downloadHTML, downloadSlideHTML, presentInWindow, presenterInWindow, livePresentInWindow, previewSlideInWindow, exportPDF, generateRevealHTML } from '../utils/generateHTML'
import { reorderSlides } from '../utils/slideReorder'
import { nextLayoutKey, newSlideIndex, nudgeFor, typesCharacter } from '../utils/slideEditing'
import { writeElements, readElements, elementsFromHtml, sanitizePastedHtml, textToHtml, placePasted } from '../utils/elementClipboard'
import { createWholeBoxEditor, toggleMarkAcross } from '../utils/wholeBoxEditor'
import { useDeckDoc } from '../utils/useDeckDoc'
import { exportToPptx } from '../utils/exportPptx'
import { getCanvasHeight, getCanvasWidth, isPinned } from '../utils/scrollingSlides'
import { simplifyPoints } from '../utils/drawingUtils'
import { generateOfflineHTML } from '../utils/offlineExport'
import Toolbar, { ALIGN_COMMANDS } from '../components/Toolbar'
import MenuBar, { MenuSearch } from '../components/MenuBar'
import NotesStrip from '../components/NotesStrip'
import PdfPagesModal, { loadPdfPages } from '../components/PdfPagesModal'
import PlotImportModal from '../components/PlotImportModal'
import { figureFromFile, wholeFigure, plotKind, baseName } from '../utils/plotImport'
import LayoutPicker from '../components/LayoutPicker'
import GettingStarted from '../components/GettingStarted'
import { useChecklist, showChecklist, tickStep, reopenChecklist } from '../utils/gettingStarted'
import { ThemePanel } from '../components/ThemeGallery'
import { setDocumentThemeCss } from '../utils/scopeCss'
import { applyThemeDoc } from '../utils/customTheme'
import DeckFontOptions from '../components/DeckFontOptions'
import { deckFontName } from '../utils/deckFont'
import { slidePalette, ownBackground, themeOf, deckTheme, isLegacyBackground, newSlideBackground, deckTextFont } from '../utils/themes'
import { changeLayout, editingHint, placeholderHint } from '../utils/placeholders'
import { pickFile } from '../utils/pickFile'
import KeyboardShortcuts from '../components/KeyboardShortcuts'
import { keyLabel, SHORTCUTS, matchesShortcut } from '../utils/shortcuts'
import SlidePanel from '../components/SlidePanel'
import OutlinePanel, { PanelViewSwitch } from '../components/OutlinePanel'
import PracticeRunsModal from '../components/PracticeRunsModal'
import { practiceInWindow, PRACTICE_MESSAGE, upsertPracticeRun, removePracticeRun, minutesFromRun } from '../utils/practice'
import SlideCanvas, { editLabelFor } from '../components/SlideCanvas'
import PropertiesPanel from '../components/PropertiesPanel'
import HtmlEmbedModal from '../components/HtmlEmbedModal'
import FindReplaceBar from '../components/FindReplaceBar'
import TransitionPreview from '../components/TransitionPreview'
import AnimationTimeline from '../components/AnimationTimeline'
import KineticTextModal from '../components/KineticTextModal'
import MathGridModal from '../components/MathGridModal'
import AnimeModal from '../components/AnimeModal'
import ThreeModal from '../components/ThreeModal'
import { MODEL_DEFAULTS, isModelFile } from '../utils/modelViewer'
import { MOLECULE_DEFAULTS } from '../utils/moleculeViewer'
import { TEXT3D_DEFAULTS } from '../utils/text3d'
import GraphEditorModal from '../components/GraphEditorModal'
import { setGraphDataPresentation, refreshGraphData, loadGraphData, loadEmbedData, deckGraphs } from '../utils/graphData'
import datasetManager from '../datasets/DatasetManager'
import { installEmbedDatasets } from '../datasets/embedBridge'
import { EMBED_DATASETS_SCRIPT } from '../utils/deckData'
import { defaultGraph, defaultGraph3d, GRAPH_FIELDS } from '../utils/graphPage'
import EquationEditorModal from '../components/EquationEditorModal'
import FeynmanEditorModal from '../components/FeynmanEditorModal'
import CircuitEditorModal from '../components/CircuitEditorModal'
import LogicEditorModal from '../components/LogicEditorModal'
import FreebodyEditorModal from '../components/FreebodyEditorModal'
import VennEditorModal from '../components/VennEditorModal'
import MoleculeModal from '../components/MoleculeModal'
import { defaultEquation, EQUATION_FIELDS, EQUATION_SIZE } from '../utils/equationTerms'
import { defaultFeynman, FEYNMAN_FIELDS, feynmanBox } from '../utils/feynmanDiagram'
import { defaultCircuit, circuitBox } from '../utils/circuitDiagram'
import { CIRCUIT_FIELDS } from '../utils/circuitParts'
import { defaultLogic, logicBox } from '../utils/logicDiagram'
import { LOGIC_FIELDS } from '../utils/logicParts'
import { defaultFreebody, freebodyBox } from '../utils/freebodyDiagram'
import { defaultPeriodic, periodicBox } from '../utils/periodicTable'
import { defaultHarmonics } from '../utils/harmonicsView'
import { FREEBODY_FIELDS } from '../utils/freebodySolve'
import { defaultVenn, vennBox, VENN_FIELDS } from '../utils/vennDiagram'
import TimingEditorModal from '../components/TimingEditorModal'
import { defaultTiming, timingBox, TIMING_FIELDS } from '../utils/timingDiagram'
import GeometryEditorModal from '../components/GeometryEditorModal'
import { defaultGeometry, GEOMETRY_FIELDS, GEOMETRY_SIZE } from '../utils/geometryDiagram'
import BibliographyModal from '../components/BibliographyModal'
import DiagramModal from '../components/DiagramModal'
import TikzEditorModal from '../components/TikzEditorModal'
import {
  ANNOTATION_MESSAGE, newAnnotationSet, upsertAnnotationSet, recoverAnnotationBackups,
  recentAnnotationSets, inkedSlideCount,
  renameAnnotationSet, deleteAnnotationSet, inkedPresentation,
} from '../utils/annotations'
import AnnotationSessionsModal from '../components/AnnotationSessionsModal'
import EditorsModal from '../components/EditorsModal'
import AiLinkModal from '../components/AiLinkModal'
import HeaderMenu from '../components/HeaderMenu'
import { renewSlideIds, renewElementIds, countLinksTo, buildTabs, buildHotspot, buildFlipCard, buildQuiz, canvasClickPreview, previewForSelection, seenLast, elementLabels, hoverPreview, withState, recordIntoState } from '../utils/clickActions'
import ImportSlideModal from '../components/ImportSlideModal'
import BeamerImportModal from '../components/BeamerImportModal'
import DatasetPanel from '../components/DatasetPanel'
import EquationPalette from '../components/EquationPalette'
import { formatAuthorLine, webLink, pageRange } from '../utils/bibtexParser'
import { workFinder } from '../utils/bibDuplicates'
import { buildCitationIndex, nextCitationLabel, applyCitationNumbering, countStaleMarkers, resolveCitationsInHtml } from '../utils/citationIndex'
import { MathNode } from '../extensions/MathExtension'
import { CitationNode } from '../extensions/CitationExtension'
import { BlockStyle } from '../extensions/BlockStyle'
import { FontSize } from '../extensions/FontSize'
import { FontFamily } from '../extensions/FontFamily'
import { FontWeight } from '../extensions/FontWeight'
import { LineHeight } from '../extensions/LineHeight'
import monokaiCSS from '../../../node_modules/highlight.js/styles/monokai.min.css?raw'
import githubDarkCSS from '../../../node_modules/highlight.js/styles/github-dark.min.css?raw'
import atomOneDarkCSS from '../../../node_modules/highlight.js/styles/atom-one-dark.min.css?raw'
import tokyoNightCSS from '../../../node_modules/highlight.js/styles/tokyo-night-dark.min.css?raw'
import vs2015CSS from '../../../node_modules/highlight.js/styles/vs2015.min.css?raw'
import nightOwlCSS from '../../../node_modules/highlight.js/styles/night-owl.min.css?raw'
import anOldHopeCSS from '../../../node_modules/highlight.js/styles/an-old-hope.min.css?raw'
import atomOneLightCSS from '../../../node_modules/highlight.js/styles/atom-one-light.min.css?raw'
import githubCSS from '../../../node_modules/highlight.js/styles/github.min.css?raw'
import vsCSS from '../../../node_modules/highlight.js/styles/vs.min.css?raw'
import { loadPlugins, unloadPlugin, getInsertablePluginTypes, createPluginElement } from '../plugins/PluginLoader'
import { loadVersionSandbox, pluginVersionsIn, versionSandbox } from '../plugins/versionSandboxes'
import { pluginUpdates, withPluginVersion } from '../plugins/pluginUpdates'
import registry from '../plugins/PluginRegistry'
import PluginBrowser from '../components/PluginBrowser'
import { libUrl, localizeLibraries } from '../utils/libraries'

// A new graph's size on the slide
const GRAPH_SIZE = { w: 560, h: 400 }

// Share links and live presenting exist only in the cloud version
const isCloud = import.meta.env.VITE_PARALLAX_MODE === 'cloud'
// How long to wait for live editing to connect before saving the usual way
const LIVE_WAIT_MS = 10000
// Publishing to Zenodo is turned off for now; its code stays for when it's
// brought back, along with ZENODO_ENABLED in server/index.js
const ZENODO_ENABLED = false

// Downloads the presentation as one HTML file with its libraries and uploads
// inlined, so it works offline and anywhere
async function downloadOfflineHTML(presentation) {
  const offline = await generateOfflineHTML(generateRevealHTML(presentation))
  const blob = new Blob([offline], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}_offline.html`
  a.click()
  URL.revokeObjectURL(url)
}

const CODE_THEME_CSS = {
  'monokai': monokaiCSS,
  'github-dark': githubDarkCSS,
  'atom-one-dark': atomOneDarkCSS,
  'tokyo-night-dark': tokyoNightCSS,
  'vs2015': vs2015CSS,
  'night-owl': nightOwlCSS,
  'an-old-hope': anOldHopeCSS,
  'atom-one-light': atomOneLightCSS,
  'github': githubCSS,
  'vs': vsCSS,
}

const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom', 'differential-rotation']


// The text editor's extensions: for editing a text box, and for formatting a
// selected one as a whole (utils/wholeBoxEditor.js)
const textExtensions = () => [
  StarterKit,
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Color,
  TextStyle,
  Link.configure({ openOnClick: false }),
  Image.configure({ inline: false }),
  // A placeholder's own hint while it's empty (utils/placeholders.js)
  Placeholder.configure({ placeholder: () => editingHint.current || 'Click to start typing...' }),
  MathNode,
  CitationNode,
  BlockStyle,
  FontFamily,
  FontSize,
  FontWeight,
  LineHeight,
  Highlight.configure({ multicolor: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
]

// An element with `updates`, or, while one of its states is being recorded
// (`recording`), with what a state can change going into that state
const editElement = (recording, el, updates) =>
  recording?.elementId === el.id ? recordIntoState(el, recording.stateId, updates) : { ...el, ...updates }

const migrateSlide = (slide) => {
  if (!slide.elements) {
    return {
      ...slide,
      elements: slide.html ? [{
        id: crypto.randomUUID(), type: 'text',
        x: 80, y: 100, width: 800, height: 340, zIndex: 1,
        content: slide.html
      }] : []
    }
  }
  return slide
}

export default function EditorPage({ presentationId, isTemplate = false, onGoHome, guest = null, theme, onThemeChange }) {
  // The deck lives in a Yjs document; setPresentation works like a useState setter
  const { deck: presentation, setDeck: setPresentation, resetDeck, attachDeck, undo: undoDeck, redo: redoDeck, canUndo, canRedo, stopCapturing } = useDeckDoc()
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [selectedSlideIds, setSelectedSlideIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('') // '', 'saving', 'saved'
  const [loading, setLoading] = useState(true)
  const [selectedElementIds, setSelectedElementIds] = useState([])
  const [editingElementId, setEditingElementId] = useState(null)
  // The left panel: the slides, or the outline (remembered in this browser)
  const [leftView, setLeftView] = useState(() => { try { return localStorage.getItem('parallax-left-panel') === 'outline' ? 'outline' : 'slides' } catch (e) { return 'slides' } })
  const chooseLeftView = useCallback(view => { setLeftView(view); try { localStorage.setItem('parallax-left-panel', view) } catch (e) { /* not remembered */ } }, [])
  // The element state being recorded, { elementId, stateId }: moving,
  // resizing, turning or recoloring the element changes that state
  const [recording, setRecording] = useState(null)
  const recordingRef = useRef(null)
  recordingRef.current = recording

  // Derived from selectedElementIds — must be declared before any useEffect that references it
  const selectedElementId = selectedElementIds[selectedElementIds.length - 1] ?? null
  const [showGrid, setShowGrid] = useState(false)
  const [gridSize, setGridSize] = useState(40) // synced to presentation.gridSize when changed
  // The last elements copied in this tab, for Paste on the menus when the
  // browser won't let the page read the system clipboard
  const clipboardRef = useRef(null)
  // Pastes onto the slide a copy came from, each stepping further
  const pasteCountRef = useRef(0)
  const addSlideAfterRef = useRef(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  // Help › Search the menus (Alt+/)
  const [showMenuSearch, setShowMenuSearch] = useState(false)
  // A menu asking the toolbar for a dropdown (Slide › Background…, Insert ›
  // Table…), and the canvas for what its right-click menu does (Crop, Edit,
  // layer order): { name, id, n }, n counting the asks
  const [toolbarRequest, setToolbarRequest] = useState(null)
  const askToolbar = useCallback(name => setToolbarRequest(r => ({ name, n: (r?.n ?? 0) + 1 })), [])
  const [canvasRequest, setCanvasRequest] = useState(null)
  const askCanvas = useCallback((name, id) => setCanvasRequest(r => ({ name, id, n: (r?.n ?? 0) + 1 })), [])
  // The inspector's tab: Format, Animate or Slide
  const [inspectorTab, setInspectorTab] = useState('format')
  // The themes panel, in the inspector's place (components/ThemeGallery.jsx)
  const [showThemes, setShowThemes] = useState(false)
  // The Themes panel's tab: its colors, or the deck's text styles
  const [themeTab, setThemeTab] = useState('colors')
  // The slide whose layout is being changed (Slide › Change layout…)
  const [layoutChangeIndex, setLayoutChangeIndex] = useState(null)
  // The getting-started checklist (utils/gettingStarted.js), and asking the
  // notes strip to open for typing
  const checklist = useChecklist()
  const [notesRequest, setNotesRequest] = useState(0)
  // A PDF's pages, to pick which go on the slide as images
  const [pdfPages, setPdfPages] = useState(null)
  const [plotImport, setPlotImport] = useState(null) // { file }: a figure to import; { source, figure }: one kept as it is, opened again
  const [htmlEditorState, setHtmlEditorState] = useState(null) // { elementId, content, width, height, mode }
  const [p5EditorState, setP5EditorState] = useState(null) // { elementId, content }
  const [codeEditorState, setCodeEditorState] = useState(null) // { elementId, content, language }
  const [latexEditorState, setLatexEditorState] = useState(null) // { elementId, content }
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showGithubModal, setShowGithubModal] = useState(false)
  const [githubConfig, setGithubConfig] = useState({ owner: '', repo: '', hasToken: false })
  const [githubToken, setGithubToken] = useState('')
  const [githubPushing, setGithubPushing] = useState(false)
  const [githubStatus, setGithubStatus] = useState(null) // { type: 'success'|'error', message }
  const [githubCommitMsg, setGithubCommitMsg] = useState('')

  const [showZenodoModal, setShowZenodoModal] = useState(false)
  const [zenodoConfig, setZenodoConfig] = useState({ hasToken: false, sandbox: false })
  const [zenodoToken, setZenodoToken] = useState('')
  const [zenodoPublishing, setZenodoPublishing] = useState(false)
  const [zenodoStatus, setZenodoStatus] = useState(null)
  const [zenodoMeta, setZenodoMeta] = useState({
    creators: [{ name: '', affiliation: '', orcid: '' }],
    description: '',
    keywords: '',
    license: 'cc-by-4.0',
  })
  const [zenodoPubStatus, setZenodoPubStatus] = useState(null)

  // New feature state
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showTransitionPreview, setShowTransitionPreview] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  // Who edits this presentation (cloud): { role, you, people, inviteToken }.
  // An editor doesn't get the owner's share, live, GitHub and Zenodo menus.
  const [access, setAccess] = useState(null)
  const isEditor = access?.role === 'editor'
  const [showEditorsModal, setShowEditorsModal] = useState(false)
  const [showAiLinks, setShowAiLinks] = useState(false)
  // Autosave stopped: { kind: 'conflict', version } when someone else saved
  // first, { kind: 'gone' } when the presentation is gone or this user was
  // removed from it
  const [saveProblem, setSaveProblem] = useState(null)
  // Editing live: { status: 'connecting' | 'connected' | 'disconnected',
  // unsent: changes the server hasn't confirmed, synced: the deck arrived },
  // or null when edits are saved by autosave instead
  const liveEligible = isCloud && !guest && !isTemplate
  const [live, setLive] = useState(null)
  const liveRef = useRef(null)
  // Everyone's tab's state, from live editing's awareness (utils/presence.js)
  const [awarenessStates, setAwarenessStates] = useState(() => new Map())
  const peers = useMemo(
    () => peersFrom(awarenessStates, liveRef.current?.awareness?.clientID, access?.people, access?.you),
    [awarenessStates, access],
  )
  const peersRef = useRef(peers)
  peersRef.current = peers
  // A short message at the bottom of the window
  const [notice, setNotice] = useState(null)
  const noticeTimerRef = useRef(null)
  const showNotice = useCallback((message) => {
    setNotice(message)
    clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000)
  }, [])
  // Whether someone else has the element open (a text box they're typing in,
  // or its editor); if so, says who
  const heldByOther = useCallback((elementId, why = '') => {
    const peer = editorOf(peersRef.current, elementId)
    if (peer) showNotice(editingMessage(peer) + why)
    return !!peer
  }, [showNotice])
  const [shareStatus, setShareStatus] = useState({ shared: false, token: null })
  // The Share button beside Present (components/HeaderMenu.jsx): a share link
  // for the owner, who edits it, and the owner's AI collaborator links (cloud,
  // not for guests; a template has no editors)
  const shareItems = [
    isCloud && !guest && !isEditor && { label: 'Share link…', icon: <Share2 size={13} />, action: async () => { const status = await api.getShareStatus(presentationId); setShareStatus(status); setShowShareModal(true) } },
    isCloud && !guest && !isTemplate && { label: 'Editors…', icon: <Users size={13} />, action: async () => { setAccess(await api.getCollaborators(presentationId)); setShowEditorsModal(true) } },
    isCloud && !guest && !isEditor && !isTemplate && { label: 'AI collaborator link…', icon: <Bot size={13} />, title: 'Let an AI chat app such as Claude or ChatGPT read and change this presentation', action: () => setShowAiLinks(true) },
  ].filter(Boolean)
  const [showTimeline, setShowTimeline] = useState(false)
  const [smartGuidesEnabled, setSmartGuidesEnabled] = useState(true)
  const [showMasterPanel, setShowMasterPanel] = useState(false)
  const [showDefaultSettings, setShowDefaultSettings] = useState(false)
  const [showPresentDropdown, setShowPresentDropdown] = useState(false)
  const [showKineticModal, setShowKineticModal] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [fileBrowserFiles, setFileBrowserFiles] = useState([])
  const [fileBrowserLoading, setFileBrowserLoading] = useState(false)
  const [fileBrowserFilter, setFileBrowserFilter] = useState('all')
  const [fileBrowserCopied, setFileBrowserCopied] = useState(null)
  const [showMathGridModal, setShowMathGridModal] = useState(false)
  const [showAnimeModal, setShowAnimeModal] = useState(false)
  const [showThreeModal, setShowThreeModal] = useState(false)
  const [showBibliographyModal, setShowBibliographyModal] = useState(false)
  const [showDiagramModal, setShowDiagramModal] = useState(false)
  const [tikzEditor, setTikzEditor] = useState(null) // { elementId (null for a new diagram), state, dark }
  const [graphEditor, setGraphEditor] = useState(null) // { elementId (null for a new graph), graph, size, slideBg }
  const [equationEditor, setEquationEditor] = useState(null) // { elementId (null for a new one), equation, size, slideBg, dark }
  const [feynmanEditor, setFeynmanEditor] = useState(null) // { elementId (null for a new one), diagram, slideBg }
  const [circuitEditor, setCircuitEditor] = useState(null) // { elementId (null for a new one), circuit, slideBg }
  const [logicEditor, setLogicEditor] = useState(null) // { elementId (null for a new one), logic, slideBg }
  const [freebodyEditor, setFreebodyEditor] = useState(null) // { elementId (null for a new one), diagram, slideBg }
  const [vennEditor, setVennEditor] = useState(null) // { elementId (null for a new one), diagram, slideBg }
  const [timingEditor, setTimingEditor] = useState(null) // { elementId (null for a new one), diagram, slideBg }
  const [geometryEditor, setGeometryEditor] = useState(null) // { elementId (null for a new one), diagram, size, slideBg }
  const [moleculePicker, setMoleculePicker] = useState(null) // { elementId (null for a new one) }
  const [liveSession, setLiveSession] = useState(null) // { sessionId, url }
  const [liveViewers, setLiveViewers] = useState(0)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [snapshots, setSnapshots] = useState([])
  const [snapshotName, setSnapshotName] = useState('')
  const [showGitHistory, setShowGitHistory] = useState(false)
  const [gitCommits, setGitCommits] = useState([])
  const [gitLoading, setGitLoading] = useState(false)
  const [gitRestoring, setGitRestoring] = useState(null)
  const [showDiffViewer, setShowDiffViewer] = useState(false)
  const [showFontManager, setShowFontManager] = useState(false)
  const [showDatasetPanel, setShowDatasetPanel] = useState(false)
  const [customFonts, setCustomFonts] = useState([])
  const [fontGoogleName, setFontGoogleName] = useState('')
  const [fontUploading, setFontUploading] = useState(false)
  const [diffOldData, setDiffOldData] = useState(null)
  const [diffOldLabel, setDiffOldLabel] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [showRulers, setShowRulers] = useState(false)
  const [guides, setGuides] = useState([]) // persistent guide lines: [{ axis: 'x'|'y', position: number }]
  const [drawTool, setDrawTool] = useState(null) // null = off, { color, strokeWidth, opacity, smooth } = drawing mode
  const [pendingAddColumn, setPendingAddColumn] = useState(null) // colNum to add slide to when template modal confirms
  const [showImportSlideModal, setShowImportSlideModal] = useState(false)
  const [showBeamerModal, setShowBeamerModal] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const [showPracticeRuns, setShowPracticeRuns] = useState(false)
  const [activeMathNode, setActiveMathNode] = useState(null) // { latex, display, fontSize, color } when inline math node is clicked
  const mathNodeUpdateRef = useRef(null) // holds the TipTap updateAttributes fn for the active math node

  // Track if we're programmatically setting editor content (to avoid loops)
  const settingContent = useRef(false)
  const saveTimerRef = useRef(null)
  const isFirstLoad = useRef(true)
  const editingElementIdRef = useRef(null)
  const currentSlideIndexRef = useRef(0)
  const selectedElementIdsRef = useRef([])

  // Keep refs in sync with state
  useEffect(() => {
    editingElementIdRef.current = editingElementId
  }, [editingElementId])

  // Clear active math node when the text element stops being edited
  useEffect(() => {
    if (!editingElementId) {
      setActiveMathNode(null)
      mathNodeUpdateRef.current = null
    }
  }, [editingElementId])

  // Listen for clicks on inline math nodes (fired by MathExtension node view)
  useEffect(() => {
    const handler = (e) => {
      setActiveMathNode({
        latex:    e.detail.latex,
        display:  e.detail.display,
        fontSize: e.detail.fontSize,
        color:    e.detail.color,
      })
      mathNodeUpdateRef.current = e.detail.update
    }
    document.addEventListener('math-node-edit', handler)
    return () => document.removeEventListener('math-node-edit', handler)
  }, [])

  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
  }, [currentSlideIndex])

  useEffect(() => { selectedElementIdsRef.current = selectedElementIds }, [selectedElementIds])

  // Load presentation (or template) on mount. Signed in to the cloud version,
  // it's edited live: the deck comes from the server's document, which keeps
  // everyone's copy in step (utils/liveDeck.js), and there's no autosave. If
  // that doesn't connect within LIVE_WAIT_MS, edits are saved as before.
  useEffect(() => {
    if (!presentationId) return
    let cancelled = false
    const loadFn = isTemplate ? api.getTemplate : api.getPresentation
    // Ink a Present window kept on this device because this tab was closed
    const recoverInk = deck => {
      let storage = null
      try { storage = window.localStorage } catch {}
      return recoverAnnotationBackups(deck, storage)
    }
    const opened = deck => {
      if (deck.gridSize) setGridSize(deck.gridSize)
      if (deck.guides && deck.guides.length) setGuides(deck.guides)
      setLoading(false)
      isFirstLoad.current = true
    }
    const openSaved = saved => {
      let migrated = saved
      // saved straight away, since autosave skips the first load
      if (!isTemplate) {
        const { presentation: withInk, recovered } = recoverInk(migrated)
        if (recovered) {
          migrated = withInk
          api.updatePresentation(migrated.id, migrated).catch(err => console.error('Saving recovered annotations failed', err))
        }
      }
      setPresentation(migrated)
      opened(migrated)
    }
    const openLive = saved => {
      let arrived = false
      const fallBack = () => {
        clearTimeout(giveUp)
        connection.disconnect()
        liveRef.current = null
        if (cancelled) return
        setLive(null)
        openSaved(saved)
      }
      const connection = connectLive({
        id: presentationId,
        token: getAuthToken,
        onSynced: doc => {
          if (cancelled) return
          arrived = true
          clearTimeout(giveUp)
          const deck = attachDeck(doc, saved)
          const { awareness } = connection
          const onAwareness = () => setAwarenessStates(new Map(awareness.getStates()))
          awareness.on('change', onAwareness)
          onAwareness()
          const { presentation: withInk, recovered } = recoverInk(deck)
          if (recovered) setPresentation(withInk)
          setLive(l => ({ ...l, synced: true }))
          opened(deck)
        },
        onStatus: status => setLive(l => l && { ...l, status }),
        onUnsent: unsent => setLive(l => l && { ...l, unsent }),
        // Removed as an editor, or the presentation deleted; before the
        // document arrives, it's more likely live editing that's broken
        onRefused: () => {
          if (!arrived) return fallBack()
          connection.disconnect()
          setSaveProblem({ kind: 'gone' })
        },
      })
      liveRef.current = connection
      setLive({ status: 'connecting', unsent: 0, synced: false })
      const giveUp = setTimeout(() => { if (!arrived) fallBack() }, LIVE_WAIT_MS)
    }
    loadFn(presentationId).then(data => {
      if (cancelled) return
      // Migrate old slide format to new elements-based format
      const migrated = {
        ...data,
        slides: (data.slides || []).map(migrateSlide)
      }
      if (liveEligible) openLive(migrated)
      else openSaved(migrated)
    }).catch(err => {
      console.error('Failed to load presentation', err)
      setLoading(false)
    })
    return () => {
      cancelled = true
      liveRef.current?.disconnect()
      liveRef.current = null
    }
  }, [presentationId])

  // Changes not yet sent live: ask before the tab closes
  useEffect(() => {
    if (!live?.synced || (live.status === 'connected' && !live.unsent)) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [live])

  // Load plugins on mount; guests don't get plugins. In the cloud, the
  // community plugins you installed load too, and again when you install one
  // from the Plugins dialog
  const [pluginsLoaded, setPluginsLoaded] = useState(false)
  const [, setPluginsChanged] = useState(0)
  const [showPluginBrowser, setShowPluginBrowser] = useState(false)
  const startPlugins = useCallback(() => loadPlugins({
    getPresentation: () => presentation,
    updateElement: (id, patch) => {
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map(s => ({ ...s, elements: (s.elements || []).map(el => el.id === id ? { ...el, ...patch } : el) })) }
      })
    },
    getInstalled: isCloud ? () => api.getInstalledPlugins() : null,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (guest) return
    startPlugins().then(() => setPluginsLoaded(true)).catch(() => setPluginsLoaded(true))
  }, [])

  // Community plugin elements' pages, at the versions the deck's elements
  // record, so presenting and exporting from here have them
  const deckPluginVersions = useMemo(() => pluginVersionsIn(presentation), [presentation?.slides])
  const [versionPagesSeen, setVersionPagesSeen] = useState(0)
  useEffect(() => {
    for (const v of deckPluginVersions) loadVersionSandbox(v.pluginId, v.version).then(() => setVersionPagesSeen(n => n + 1))
  }, [deckPluginVersions.map(v => `${v.pluginId}@${v.version}`).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Newer versions of the community plugins the deck uses (or, for a
  // version that's been withdrawn, one that can be had), offered above the
  // canvas and in the properties panel; plugins/pluginUpdates.js
  const [pluginCatalog, setPluginCatalog] = useState([])
  const [dismissedUpdates, setDismissedUpdates] = useState(() => new Set())
  useEffect(() => {
    if (guest) return
    api.getPluginCatalog().then(list => setPluginCatalog(Array.isArray(list) ? list : [])).catch(() => {})
  }, [])
  const pluginUpdatesAll = useMemo(
    () => pluginUpdates(presentation, pluginCatalog, { unavailable: (id, version) => versionSandbox(id, version) === null }),
    [presentation?.slides, pluginCatalog, versionPagesSeen], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const offeredUpdates = pluginUpdatesAll.filter(u => !dismissedUpdates.has(`${u.pluginId}@${u.to}`))
  const updatePlugin = useCallback((u) => {
    setPresentation(prev => (prev ? withPluginVersion(prev, u.pluginId, u.to) : prev))
    // New elements of it start at that version too
    if (registry.getPlugin(u.pluginId)?.community) {
      unloadPlugin(u.pluginId)
      startPlugins().then(() => setPluginsChanged(n => n + 1))
    }
    showNotice(`${u.name} in this deck is now version ${u.to}`)
  }, [startPlugins, showNotice])

  // Load GitHub + Zenodo config on mount
  useEffect(() => {
    if (!guest) {
      api.getGithubConfig().then(setGithubConfig).catch(() => {})
      if (ZENODO_ENABLED) api.getZenodoConfig().then(setZenodoConfig).catch(() => {})
    }
    api.getFonts().then(fonts => {
      if (Array.isArray(fonts)) {
        setCustomFonts(fonts)
        fonts.forEach(f => {
          if (f.source === 'google') {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = f.url
            document.head.appendChild(link)
          } else if (f.source === 'upload' && f.url) {
            const style = document.createElement('style')
            style.textContent = `@font-face { font-family: '${f.familyName}'; src: url('${f.url}'); }`
            document.head.appendChild(style)
          }
        })
      }
    }).catch(() => {})
  }, [])

  // Load who edits it
  useEffect(() => {
    if (presentationId && !guest && isCloud && !isTemplate) {
      api.getCollaborators(presentationId).then(setAccess).catch(() => {})
    }
  }, [presentationId])

  // Load share status
  useEffect(() => {
    if (presentationId && !guest && isCloud) {
      api.getShareStatus(presentationId).then(setShareStatus).catch(() => {})
    }
  }, [presentationId])

  const handleGithubSaveConfig = async () => {
    const data = { owner: githubConfig.owner, repo: githubConfig.repo, pagesUrl: githubConfig.pagesUrl || '' }
    if (githubToken) data.token = githubToken
    const result = await api.saveGithubConfig(data)
    setGithubConfig(result)
    setGithubToken('')
  }

  const handleGithubPush = async () => {
    setGithubPushing(true)
    setGithubStatus(null)
    try {
      const result = await api.pushToGithub(presentationId, githubCommitMsg.trim() || undefined)
      setGithubStatus({ type: 'success', message: 'Pushed to GitHub', url: result.url })
      setGithubCommitMsg('')
    } catch (err) {
      setGithubStatus({ type: 'error', message: err.message })
    } finally {
      setGithubPushing(false)
    }
  }

  const handleZenodoSaveConfig = async () => {
    const data = { sandbox: zenodoConfig.sandbox }
    if (zenodoToken) data.token = zenodoToken
    try {
      const result = await api.saveZenodoConfig(data)
      setZenodoConfig(result)
      setZenodoToken('')
      setZenodoStatus({ type: 'success', message: 'Settings saved' })
    } catch (err) {
      setZenodoStatus({ type: 'error', message: err.message })
    }
  }

  const handleZenodoPublish = async () => {
    setZenodoPublishing(true)
    setZenodoStatus(null)
    try {
      const meta = {
        creators: zenodoMeta.creators.filter(c => c.name.trim()),
        description: zenodoMeta.description.trim() || undefined,
        keywords: zenodoMeta.keywords.trim() ? zenodoMeta.keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
        license: zenodoMeta.license || undefined,
      }
      if (!meta.creators.length) throw new Error('At least one creator name is required')
      const result = await api.publishToZenodo(presentationId, meta)
      const verb = result.isNewVersion ? 'New version published' : 'Published'
      setZenodoStatus({ type: 'success', message: `${verb}! DOI: ${result.doi}`, url: result.url, doi: result.doi })
      api.getZenodoStatus(presentationId).then(setZenodoPubStatus).catch(() => {})
    } catch (err) {
      setZenodoStatus({ type: 'error', message: err.message })
    } finally {
      setZenodoPublishing(false)
    }
  }

  const currentSlide = presentation?.slides[currentSlideIndex]

  // Editing live: tell the others where this tab is, what it has selected,
  // and what it has open (the text box being typed in, or an element editor)
  const openElementId = editingElementId || htmlEditorState?.elementId || p5EditorState?.elementId || codeEditorState?.elementId
    || latexEditorState?.elementId || tikzEditor?.elementId || graphEditor?.elementId || equationEditor?.elementId || feynmanEditor?.elementId || circuitEditor?.elementId || logicEditor?.elementId || freebodyEditor?.elementId || vennEditor?.elementId || timingEditor?.elementId || geometryEditor?.elementId || moleculePicker?.elementId || recording?.elementId || null
  useEffect(() => {
    const awareness = live?.synced && liveRef.current?.awareness
    if (!awareness) return
    awareness.setLocalState({ user: access?.you || null, slide: currentSlide?.id || null, selected: selectedElementIds, editing: openElementId })
  }, [live?.synced, access?.you, currentSlide?.id, selectedElementIds, openElementId])

  // Someone joined since the people list was loaded: load it again
  const unknownPeople = peers.filter(p => !p.known).map(p => p.userId).sort().join()
  useEffect(() => {
    if (unknownPeople) api.getCollaborators(presentationId).then(setAccess).catch(() => {})
  }, [unknownPeople])

  // Two tabs opened the same element at the same moment: the other one keeps
  // it. A text box stops being edited here (what was typed is kept); an
  // element editor stays open, with a warning, so nothing in it is lost.
  const warnedRef = useRef(null)
  useEffect(() => {
    const own = liveRef.current?.awareness?.clientID
    if (!openElementId || own == null || !shouldLetGo(peers, own, openElementId)) return
    const peer = editorOf(peers, openElementId)
    if (openElementId === editingElementId) {
      stopEditingElement()
      showNotice(`${peer.self ? 'Your other tab' : peer.name} started editing this at the same moment`)
    } else if (openElementId === recording?.elementId) {
      setRecording(null)
      showNotice(`${peer.self ? 'Your other tab' : peer.name} opened this at the same moment, so recording its state stopped`)
    } else if (warnedRef.current !== openElementId) {
      warnedRef.current = openElementId
      showNotice(`${peer.self ? 'Your other tab' : peer.name} opened this at the same moment. Whoever saves last replaces the other's changes.`)
    }
  }, [peers, openElementId])

  // The slides changed under the same position (someone else moved or deleted
  // slides, or undo did): keep showing the slide that was showing. When it was
  // deleted, show the one now in its place.
  const followRef = useRef({ index: 0, id: null })
  useEffect(() => {
    const slides = presentation?.slides
    if (!slides) return
    const { index, id } = followRef.current
    if (currentSlideIndex === index && id && slides[currentSlideIndex]?.id !== id) {
      const now = slides.findIndex(s => s.id === id)
      const next = now >= 0 ? now : Math.max(0, Math.min(currentSlideIndex, slides.length - 1))
      if (next !== currentSlideIndex) {
        setCurrentSlideIndex(next)
        return
      }
    }
    followRef.current = { index: currentSlideIndex, id: slides[currentSlideIndex]?.id || null }
  }, [presentation?.slides, currentSlideIndex])

  // The text box being typed in was deleted (by someone else, or with its
  // slide): stop editing it
  useEffect(() => {
    if (editingElementId && presentation && !currentSlide?.elements?.some(el => el.id === editingElementId)) {
      stopEditingElement()
      setSelectedElementIds([])
    }
  }, [presentation, editingElementId])

  // Where the others are: dots on the slides, outlines on this slide's elements
  const presenceBySlide = useMemo(() => peopleBySlide(peers), [peers])
  const remoteUse = useMemo(() => elementsInUse(peers, currentSlide?.id), [peers, currentSlide?.id])
  const othersHere = useMemo(() => distinctPeople(peers).filter(p => !p.self), [peers])

  const slideW = presentation?.slideWidth || 960
  const slideH = presentation?.slideHeight || 540

  // Previewing a slide's clicks and hovers on the canvas (utils/clickActions.js),
  // chosen per slide while editing
  const [clickPreview, setClickPreview] = useState({})
  const preview = canvasClickPreview(currentSlide?.elements, currentSlide ? clickPreview[currentSlide.id] : null, selectedElementIds)
  // The element whose state is being recorded shows in that state
  const canvasElements = recording ? preview.elements.map(el => el.id === recording.elementId ? withState(el, recording.stateId) : el) : preview.elements
  const canvasSlide = currentSlide && canvasElements !== currentSlide.elements ? { ...currentSlide, elements: canvasElements } : currentSlide
  const canvasFadedIds = recording && preview.fadedIds.has(recording.elementId) ? new Set([...preview.fadedIds].filter(id => id !== recording.elementId)) : preview.fadedIds

  // Recording stops when something else is selected, or the element or its
  // state goes (deleted here or by someone else, or undone)
  useEffect(() => {
    if (!recording) return
    const el = currentSlide?.elements?.find(e => e.id === recording.elementId)
    const only = selectedElementIds.length === 1 && selectedElementIds[0] === recording.elementId
    if (!only || !el?.states?.some(st => st.id === recording.stateId)) setRecording(null)
  }, [recording, selectedElementIds, currentSlide])
  // A selected flip card is edited on the face the new preview shows
  const setPreviewMode = mode => {
    if (!currentSlide) return
    setClickPreview(prev => ({ ...prev, [currentSlide.id]: mode }))
    setSelectedElementIds(ids => seenLast(currentSlide.elements, ids, mode))
  }

  // Selecting a tab or hotspot previews its click or hover, and selecting
  // something the preview hides switches to a click or hover that shows it
  useEffect(() => {
    if (!currentSlide || selectedElementIds.length !== 1) return
    const mode = previewForSelection(currentSlide.elements, selectedElementIds[0], preview.mode)
    if (mode) setPreviewMode(mode)
  }, [selectedElementIds, currentSlide?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Only what the deck cites is numbered, in the order the deck is set to, and
  // the references slide lists the same entries (utils/citationIndex.js)
  const citationIndex = useMemo(() => buildCitationIndex(presentation), [presentation])
  const referencedEntries = citationIndex.entries
  const citationMarkerCounts = useMemo(() => (showBibliographyModal ? countStaleMarkers(presentation) : { stale: 0, unlinked: 0 }), [showBibliographyModal, presentation])
  const hasReferencesSlide = referencedEntries.length > 0
  const referencesSlideIndex = hasReferencesSlide ? presentation.slides.length : -1
  const isViewingReferences = currentSlideIndex === referencesSlideIndex && hasReferencesSlide

  // TipTap editor
  const editor = useEditor({
    extensions: textExtensions(),
    content: '',
    onUpdate: ({ editor }) => {
      // Don't trigger if we're setting content programmatically
      if (settingContent.current) return
      const elemId = editingElementIdRef.current
      const slideIdx = currentSlideIndexRef.current
      if (!elemId) return
      const html = editor.getHTML()
      setPresentation(prev => {
        if (!prev) return prev
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === slideIdx ? {
              ...s,
              elements: s.elements.map(el =>
                el.id === elemId ? { ...el, content: html } : el
              )
            } : s
          )
        }
      })
    }
  })

  // When presentation first loads, clear editor content
  useEffect(() => {
    if (editor && presentation && isFirstLoad.current) {
      isFirstLoad.current = false
      settingContent.current = true
      editor.commands.setContent('', false)
      settingContent.current = false
    }
  }, [editor, presentation])

  // When currentSlideIndex changes, reset selection and editing
  useEffect(() => {
    setSelectedElementIds([])
    setEditingElementId(null)
    editingElementIdRef.current = null
    if (editor) {
      settingContent.current = true
      editor.commands.setContent('', false)
      settingContent.current = false
    }
  }, [currentSlideIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Present-mode ink: the Present window sends its annotation set after each
  // change; saving it goes through autosave like any other edit
  useEffect(() => {
    const onMessage = e => {
      if (e.origin !== window.location.origin || e.data?.type !== ANNOTATION_MESSAGE || e.data.presentationId !== presentationId) return
      setPresentation(prev => upsertAnnotationSet(prev, e.data.set))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [presentationId])

  // Practice runs: the practice window sends its run as it goes; it's kept
  // with the deck (not an undo step) and saved like any other edit
  useEffect(() => {
    const onMessage = e => {
      if (e.origin !== window.location.origin || e.data?.type !== PRACTICE_MESSAGE || e.data.presentationId !== presentationId) return
      setPresentation(prev => upsertPracticeRun(prev, e.data.run))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [presentationId])

  // The rows graphs' data lines plot, and the datasets HTML, p5 and plugin
  // elements name, fetched for the canvas, the graph editor and Present,
  // whose page is built at the click (graphData.js). Those elements'
  // parallax.datasets is answered from them (embedBridge.js); plugins'
  // ctx.datasets reads the deck's datasets through datasetManager
  useEffect(() => {
    const id = isTemplate ? null : presentationId
    setGraphDataPresentation(id)
    datasetManager.setPresentation(id)
  }, [presentationId, isTemplate])
  useEffect(() => {
    if (!presentation || isTemplate) return
    loadGraphData(deckGraphs(presentation))
    loadEmbedData(presentation)
  }, [presentation, isTemplate])
  const dataPresentation = useRef(presentation)
  dataPresentation.current = presentation
  useEffect(() => installEmbedDatasets(() => dataPresentation.current), [])

  // Presents with drawing on, into a new annotation set or on with `set`
  const presentAnnotated = useCallback((set = null) => {
    tickStep('present')
    if (isTemplate) return presentInWindow(presentation)
    presentInWindow(presentation, { annotationSet: set ? JSON.parse(JSON.stringify(set)) : newAnnotationSet() })
  }, [presentation, isTemplate])

  // Auto-save with debounce; stopped while a save was refused, and not used
  // while editing live
  useEffect(() => {
    if (!presentation || isFirstLoad.current || saveProblem || live) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      try {
        const saveFn = isTemplate ? api.updateTemplate : api.updatePresentation
        await saveFn(presentation.id, presentation)
        setSaveStatus('saved')
        setLastSavedAt(new Date())
        setTimeout(() => setSaveStatus(''), 2000)
      } catch (err) {
        console.error('Auto-save failed', err)
        setSaveStatus('')
        if (err.code === 'conflict') setSaveProblem({ kind: 'conflict', version: err.version })
        else if (err.status === 404) setSaveProblem({ kind: 'gone' })
      }
    }, 1500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [presentation, saveProblem, live])

  // After a refused save: start over from what's saved, dropping this tab's
  // changes since, or save this tab's copy over it
  const loadSavedVersion = async () => {
    if (editingElementId) stopEditingElement()
    const saved = await api.getPresentation(presentationId)
    resetDeck({ ...saved, slides: (saved.slides || []).map(migrateSlide) })
    setCurrentSlideIndex(i => Math.max(0, Math.min(i, (saved.slides?.length || 1) - 1)))
    setSaveProblem(null)
  }
  const saveOverVersion = () => {
    api.saveOverVersion(presentationId, saveProblem.version)
    setSaveProblem(null)
  }

  const updateCurrentSlide = useCallback((updates) => {
    setPresentation(prev => {
      if (!prev) return prev
      if (updates.__replaceAllSlides) {
        return { ...prev, slides: updates.__replaceAllSlides }
      }
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndex ? { ...s, ...updates } : s
        )
      }
    })
  }, [currentSlideIndex])

  const updateElement = useCallback((id, updates) => {
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: s.elements.map(el =>
              el.id === id ? editElement(recordingRef.current, el, updates) : el
            )
          } : s
        )
      }
    })
  }, [])

  // A caption citing `entry`, fetched for an element (a PubChem compound's
  // record): the entry joins the library unless it holds the same work, and
  // the caption cites whichever is there. By id, on whichever slide it's on,
  // since the slide or the selection may have changed while it was fetched.
  const citeElement = useCallback((id, entry, caption) => {
    setPresentation(prev => {
      if (!prev) return prev
      const library = prev.bibliography || []
      const known = workFinder(library)(entry)
      return {
        ...prev,
        bibliography: known ? library : [...library, entry],
        slides: prev.slides.map(s => s.elements?.some(el => el.id === id) ? {
          ...s,
          elements: s.elements.map(el => el.id === id ? { ...el, ...caption, citationKey: (known || entry).key } : el),
        } : s),
      }
    })
  }, [])

  const deleteElement = useCallback((id) => {
    if (heldByOther(id, ', so it wasn’t deleted')) return
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: s.elements.filter(el => el.id !== id)
          } : s
        )
      }
    })
    setSelectedElementIds(prev => prev.filter(x => x !== id))
    if (editingElementId === id) setEditingElementId(null)
  }, [editingElementId])

  const addTextElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'text',
      x: 80, y: 160, width: 600, height: 180, zIndex: 1,
      content: '<p><span style="font-size: 32px; color: #94a3b8">New text</span></p>'
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: [...(s.elements || []), newEl]
          } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addTextPathElement = useCallback(() => {
    const angle = 15
    const fontSize = 64
    const width = 500
    const dy = Math.abs(width * Math.tan((angle * Math.PI) / 180))
    const height = Math.ceil(dy + fontSize * 2.4)
    const newEl = {
      id: crypto.randomUUID(),
      type: 'textpath',
      x: 230, y: Math.round((slideH - height) / 2),
      width, height, zIndex: 2,
      content: 'Text on path',
      fontSize, fontFamily: 'sans-serif',
      color: '#ffffff', fontWeight: 'normal', fontStyle: 'normal',
      letterSpacing: 0, textAnchor: 'start', startOffset: 0,
      angle, showPath: true, pathSide: 'bottom',
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [slideH])

  const addText3dElement = useCallback(() => {
    const width = 640, height = 220
    const newEl = {
      id: crypto.randomUUID(),
      type: 'text3d',
      x: Math.round((slideW - width) / 2), y: Math.round((slideH - height) / 2),
      width, height, zIndex: 2,
      ...TEXT3D_DEFAULTS,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [slideW, slideH])

  const addImageElement = useCallback((src, dropX, dropY) => {
    tickStep('image')
    const newEl = {
      id: crypto.randomUUID(),
      type: 'image',
      x: dropX !== undefined ? Math.max(0, Math.min(560, dropX - 200)) : 130,
      y: dropY !== undefined ? Math.max(0, Math.min(240, dropY - 150)) : 100,
      width: 400, height: 300, zIndex: 2,
      src,
      objectFit: 'contain',
      alt: ''
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: [...(s.elements || []), newEl]
          } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const DEFAULT_HTML = `<style>* { box-sizing: border-box; margin: 0; } body { background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: white; font-family: sans-serif; }</style>
<div style="text-align:center;padding:20px;">
  <h2>HTML Embed</h2>
  <p>Edit this content</p>
</div>`

  const DEFAULT_D3 = `<script src="${libUrl('d3', 'dist/d3.min.js')}"><\/script>
<style>* { box-sizing: border-box; margin: 0; } body { background: transparent; overflow: hidden; }</style>
<svg id="viz" width="100%" height="100%" style="display:block;"></svg>
<script>
const W = window.innerWidth, H = window.innerHeight;
const svg = d3.select('#viz').attr('viewBox', \`0 0 \${W} \${H}\`);
const data = Array.from({length: 30}, () => ({ x: Math.random()*W, y: Math.random()*H, r: 8+Math.random()*20 }));
svg.selectAll('circle').data(data).join('circle')
  .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r)
  .attr('fill', (d,i) => d3.schemeTableau10[i%10]).attr('opacity', 0.8);
<\/script>`

  const addPluginElement = useCallback((fullType) => {
    const el = createPluginElement(fullType)
    if (!el) return
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), el] } : s) }
    })
    setSelectedElementIds([el.id])
  }, [])

  const addHtmlElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'html',
      x: 0, y: 0, width: slideW, height: slideH, zIndex: 2,
      content: DEFAULT_HTML
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setHtmlEditorState({ elementId: newEl.id, content: DEFAULT_HTML, width: newEl.width, height: newEl.height, mode: 'code' })
  }, [DEFAULT_HTML])

  const addD3Element = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'html',
      x: 0, y: 0, width: slideW, height: slideH, zIndex: 2,
      content: DEFAULT_D3
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setHtmlEditorState({ elementId: newEl.id, content: DEFAULT_D3, width: newEl.width, height: newEl.height, mode: 'code' })
  }, [DEFAULT_D3])

  const insertKineticText = useCallback((html, width, height) => {
    const w = width || slideW - 80
    const h = height || 120
    const newEl = {
      id: crypto.randomUUID(),
      type: 'html',
      x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
      width: w, height: h, zIndex: 2,
      content: html
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setShowKineticModal(false)
  }, [slideW])

  // mode: 'content' or 'code'; left out, an embed with a content block opens
  // on its form (utils/embedContent.js) and any other on its code
  const openHtmlEditor = useCallback((elementId, mode) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'html' || heldByOther(elementId)) return
    setHtmlEditorState({ elementId, content: element.content || '', width: element.width, height: element.height, mode })
  }, [presentation])

  const commitHtmlEdit = useCallback((content) => {
    if (!htmlEditorState) return
    updateElement(htmlEditorState.elementId, { content })
    setHtmlEditorState(null)
  }, [htmlEditorState, updateElement])

  const DEFAULT_P5 = `function setup() {
  createCanvas(windowWidth, windowHeight)
  noLoop()
}

function draw() {
  clear()
  fill(255)
  noStroke()
  textAlign(CENTER, CENTER)
  const str = 'Hello World'
  for (let i = 0; i < str.length; i++) {
    const t = i / (str.length - 1)
    const x = map(t, 0, 1, 80, width - 80)
    const y = height / 2 + sin(t * TWO_PI) * height * 0.2
    const angle = cos(t * TWO_PI) * 0.4
    textSize(map(sin(t * PI), 0, 1, 24, 54))
    push()
    translate(x, y)
    rotate(angle)
    text(str[i], 0, 0)
    pop()
  }
}`

  const addP5Element = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'p5',
      x: 0, y: 0, width: slideW, height: slideH, zIndex: 2,
      content: DEFAULT_P5,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setP5EditorState({ elementId: newEl.id, content: DEFAULT_P5 })
  }, [DEFAULT_P5, slideW, slideH])

  const openP5Editor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'p5' || heldByOther(elementId)) return
    setP5EditorState({ elementId, content: element.content || '' })
  }, [presentation])

  const commitP5Edit = useCallback(() => {
    if (!p5EditorState) return
    updateElement(p5EditorState.elementId, { content: p5EditorState.content })
    setP5EditorState(null)
  }, [p5EditorState, updateElement])

  const addCodeElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'code',
      x: 80, y: 80, width: 600, height: 320, zIndex: 2,
      content: '// Write your code here\nfunction hello() {\n  return "Hello, World!"\n}',
      language: 'javascript',
      fontSize: 14,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setCodeEditorState({ elementId: newEl.id, content: newEl.content, language: newEl.language })
  }, [])

  const openCodeEditor = useCallback((elementId) => {
    const slide = presentation?.slides[currentSlideIndexRef.current]
    const element = slide?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'code' || heldByOther(elementId)) return
    setCodeEditorState({ elementId, content: element.content || '', language: element.language || 'javascript' })
  }, [presentation])

  const commitCodeEdit = useCallback(() => {
    if (!codeEditorState) return
    updateElement(codeEditorState.elementId, { content: codeEditorState.content, language: codeEditorState.language })
    setCodeEditorState(null)
  }, [codeEditorState, updateElement])

  const DEFAULT_LATEX = `\\begin{tikzpicture}
  \\draw[thick,->] (0,0) -- (4,0) node[right] {$x$};
  \\draw[thick,->] (0,0) -- (0,3) node[above] {$y$};
  \\draw[blue,thick] (0,0) sin (1,1) cos (2,0) sin (3,-1) cos (4,0);
  \\node at (2,-0.8) {$f(x) = \\sin(x)$};
\\end{tikzpicture}`

  const addLatexElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'latex',
      x: 80, y: 80, width: 500, height: 380, zIndex: 2,
      content: DEFAULT_LATEX
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
    setLatexEditorState({ elementId: newEl.id, content: DEFAULT_LATEX })
  }, [])

  const openLatexEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'latex' || heldByOther(elementId)) return
    setLatexEditorState({ elementId, content: element.content || '' })
  }, [presentation])

  const commitLatexEdit = useCallback(() => {
    if (!latexEditorState) return
    updateElement(latexEditorState.elementId, { content: latexEditorState.content })
    setLatexEditorState(null)
  }, [latexEditorState, updateElement])

  // Opens the TikZ diagram editor on a canvas as dark or light as the slide,
  // so the diagram looks there as it will on the slide
  const slideIsDark = useCallback(() => {
    // The slide's own background, or the theme's (utils/themes.js)
    return slidePalette(presentation?.slides[currentSlideIndexRef.current], presentation?.theme, presentation?.themeColors).dark
  }, [presentation])

  const openTikzEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'tikz' || heldByOther(elementId)) return
    setTikzEditor({ elementId, state: element.editorState || null, dark: slideIsDark() })
  }, [presentation, slideIsDark])

  // The slide's color behind the graph editor's preview
  const slideBackdrop = useCallback(() => {
    const slide = presentation?.slides[currentSlideIndexRef.current]
    const bg = slide?.background
    if (bg?.type === 'color' && bg.color) return bg.color
    if (!ownBackground(bg)) return deckTheme(presentation?.theme, presentation?.themeColors).background
    return slideIsDark() ? '#1e1e2e' : '#ffffff'
  }, [presentation, slideIsDark])

  const addGraph = useCallback(() => {
    setGraphEditor({ elementId: null, graph: defaultGraph(slideIsDark()), size: GRAPH_SIZE, slideBg: slideBackdrop() })
  }, [slideIsDark, slideBackdrop])
  const addGraph3d = useCallback(() => {
    setGraphEditor({ elementId: null, graph: defaultGraph3d(slideIsDark()), size: GRAPH_SIZE, slideBg: slideBackdrop() })
  }, [slideIsDark, slideBackdrop])

  const openGraphEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'graph' || heldByOther(elementId)) return
    const graph = {}
    for (const key of GRAPH_FIELDS) if (element[key] !== undefined) graph[key] = element[key]
    setGraphEditor({ elementId, graph, size: { w: element.width, h: element.height }, slideBg: slideBackdrop() })
  }, [presentation, slideBackdrop])

  const saveGraph = useCallback((graph) => {
    const elementId = graphEditor?.elementId
    if (elementId) {
      updateElement(elementId, graph)
    } else {
      const newEl = {
        id: crypto.randomUUID(), type: 'graph', x: Math.round((slideW - GRAPH_SIZE.w) / 2), y: Math.round((slideH - GRAPH_SIZE.h) / 2),
        width: GRAPH_SIZE.w, height: GRAPH_SIZE.h, zIndex: 2, ...graph,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setGraphEditor(null)
  }, [graphEditor, updateElement, slideW, slideH])

  // An imported figure's graph (PlotImportModal), in the middle of the slide
  const insertImportedPlot = useCallback((graph, size) => {
    const w = Math.round(size?.w || GRAPH_SIZE.w), h = Math.round(size?.h || GRAPH_SIZE.h)
    const newEl = {
      id: crypto.randomUUID(), type: 'graph', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
      width: w, height: h, zIndex: 2, ...graph,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
    setPlotImport(null)
  }, [slideW, slideH])

  // A PDF or SVG dropped on the slide: a figure matplotlib saved goes in
  // whole, as one image, with its file, to be cut into pieces that come and
  // go when it's opened again (right-click › Edit figure layers…); anything
  // else, as before: an SVG as an image, a PDF's pages to choose from
  const addDroppedFigure = useCallback(async (file, dropX, dropY) => {
    const made = await figureFromFile(file).catch(() => null)
    if (!made) {
      if (plotKind(file) === 'svg') {
        try { const r = await api.uploadFile(file); if (r.url) addImageElement(r.url, dropX, dropY) }
        catch (err) { showNotice(`The image couldn’t be uploaded: ${err.message}`) }
        return
      }
      showNotice('Reading the PDF…')
      try { setPdfPages(await loadPdfPages(file)) }
      catch (err) { showNotice(`The PDF couldn’t be read: ${err.message}`) }
      return
    }
    try {
      const upload = async f => { const r = await api.uploadFile(f); if (!r?.url) throw new Error('nothing came back'); return r.url }
      const kind = made.result.kind
      const src = await upload(file.type ? file : new File([file], file.name, { type: kind === 'pdf' ? 'application/pdf' : 'image/svg+xml' }))
      const name = baseName(file.name).replace(/[^\w.-]+/g, '-').slice(0, 40) || 'figure'
      const url = kind === 'svg' ? src : await upload(new File([made.image], `${name}.png`, { type: made.type }))
      const el = wholeFigure(made.result.plot, { url, meta: { src, file: file.name } })
      // Centered where it was dropped, on the slide
      el.x = Math.max(0, Math.min(slideW - el.width, Math.round(dropX - el.width / 2)))
      el.y = Math.max(0, Math.min(slideH - el.height, Math.round(dropY - el.height / 2)))
      // Over what's on the slide
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), { ...el, zIndex: Math.max(1, ...(s.elements || []).map(e => e.zIndex || 0)) + 1 }] } : s) }
      })
      setSelectedElementIds([el.id])
      showNotice('Figure added: right-click it and choose Edit figure layers… to make its layers come and go.')
    } catch (err) {
      showNotice(`The figure couldn’t be added: ${err.message}`)
    }
  }, [addImageElement, showNotice, slideW, slideH])

  // A figure kept as it is (PlotImportModal): its pieces, stacked in one
  // group in the middle of the slide; or, opened again, in place of the
  // pieces it had, wherever they are
  const insertKeptFigure = useCallback((elements, { replace } = {}) => {
    if (!elements?.length) return
    if (replace?.length) {
      const gone = new Set(replace)
      setPresentation(prev => {
        if (!prev) return prev
        return {
          ...prev,
          slides: prev.slides.map(s => {
            const els = s.elements || []
            const at = els.findIndex(e => gone.has(e.id))
            if (at < 0) return s
            const before = els.slice(0, at).filter(e => !gone.has(e.id))
            return { ...s, elements: [...before, ...elements, ...els.slice(at).filter(e => !gone.has(e.id))] }
          }),
        }
      })
      setSelectedElementIds(elements.map(el => el.id))
      setPlotImport(null)
      return
    }
    const { width: w, height: h } = elements[0]
    const dx = Math.round((slideW - w) / 2), dy = Math.round((slideH - h) / 2)
    const placed = elements.map(el => ({ ...el, x: el.x + dx, y: el.y + dy }))
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), ...placed] } : s) }
    })
    setSelectedElementIds(placed.map(el => el.id))
    setPlotImport(null)
  }, [slideW, slideH])

  const addEquation = useCallback(() => {
    setEquationEditor({ elementId: null, equation: defaultEquation(slideIsDark()), size: EQUATION_SIZE, slideBg: slideBackdrop(), dark: slideIsDark() })
  }, [slideIsDark, slideBackdrop])

  const openEquationEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'equation' || heldByOther(elementId)) return
    const equation = {}
    for (const key of EQUATION_FIELDS) if (element[key] !== undefined) equation[key] = element[key]
    setEquationEditor({ elementId, equation, size: { w: element.width, h: element.height }, slideBg: slideBackdrop(), dark: slideIsDark() })
  }, [presentation, slideBackdrop, slideIsDark])

  const saveEquation = useCallback((equation, size) => {
    const elementId = equationEditor?.elementId
    const w = Math.round(size?.w || EQUATION_SIZE.w), h = Math.round(size?.h || EQUATION_SIZE.h)
    if (elementId) {
      updateElement(elementId, { ...equation, width: w, height: h })
    } else {
      const newEl = {
        id: crypto.randomUUID(), type: 'equation', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, ...equation,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setEquationEditor(null)
  }, [equationEditor, updateElement, slideW, slideH])

  const addFeynman = useCallback(() => {
    setFeynmanEditor({ elementId: null, diagram: defaultFeynman(slideIsDark()), slideBg: slideBackdrop() })
  }, [slideIsDark, slideBackdrop])

  const openFeynmanEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'feynman' || heldByOther(elementId)) return
    const diagram = {}
    for (const key of FEYNMAN_FIELDS) if (element[key] !== undefined) diagram[key] = element[key]
    setFeynmanEditor({ elementId, diagram, slideBg: slideBackdrop() })
  }, [presentation, slideBackdrop])

  const saveFeynman = useCallback((diagram) => {
    const elementId = feynmanEditor?.elementId
    const box = feynmanBox(diagram)
    if (elementId) {
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
      // Keep its width; its height follows the diagram's new shape
      const w = element?.width || Math.round(box.w)
      updateElement(elementId, { ...diagram, height: Math.max(20, Math.round(w * box.h / box.w)) })
    } else {
      const scale = Math.min(1, (slideW * 0.6) / box.w, (slideH * 0.7) / box.h)
      const w = Math.round(box.w * scale), h = Math.round(box.h * scale)
      const newEl = {
        id: crypto.randomUUID(), type: 'feynman', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, ...diagram,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setFeynmanEditor(null)
  }, [feynmanEditor, presentation, updateElement, slideW, slideH])

  const addCircuit = useCallback(() => {
    setCircuitEditor({ elementId: null, circuit: defaultCircuit(slideIsDark()), slideBg: slideBackdrop() })
  }, [slideIsDark, slideBackdrop])

  const openCircuitEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'circuit' || heldByOther(elementId)) return
    const circuit = {}
    for (const key of CIRCUIT_FIELDS) if (element[key] !== undefined) circuit[key] = element[key]
    setCircuitEditor({ elementId, circuit, slideBg: slideBackdrop() })
  }, [presentation, slideBackdrop])

  const saveCircuit = useCallback((circuit) => {
    const elementId = circuitEditor?.elementId
    const box = circuitBox(circuit)
    if (elementId) {
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
      // Keep its width; its height follows the circuit's new shape
      const w = element?.width || Math.round(box.w)
      updateElement(elementId, { ...circuit, height: Math.max(20, Math.round(w * box.h / box.w)) })
    } else {
      const scale = Math.min(1, (slideW * 0.6) / box.w, (slideH * 0.7) / box.h)
      const w = Math.round(box.w * scale), h = Math.round(box.h * scale)
      const newEl = {
        id: crypto.randomUUID(), type: 'circuit', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, ...circuit,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setCircuitEditor(null)
  }, [circuitEditor, presentation, updateElement, slideW, slideH])

  const addLogic = useCallback(() => {
    setLogicEditor({ elementId: null, logic: defaultLogic(slideIsDark()), slideBg: slideBackdrop() })
  }, [slideIsDark, slideBackdrop])

  const openLogicEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'logic' || heldByOther(elementId)) return
    const logic = {}
    for (const key of LOGIC_FIELDS) if (element[key] !== undefined) logic[key] = element[key]
    setLogicEditor({ elementId, logic, slideBg: slideBackdrop() })
  }, [presentation, slideBackdrop])

  const saveLogic = useCallback((logic) => {
    const elementId = logicEditor?.elementId
    const box = logicBox(logic)
    if (elementId) {
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
      // Keep its width; its height follows the diagram's new shape
      const w = element?.width || Math.round(box.w)
      updateElement(elementId, { ...logic, height: Math.max(20, Math.round(w * box.h / box.w)) })
    } else {
      const scale = Math.min(1, (slideW * 0.7) / box.w, (slideH * 0.7) / box.h)
      const w = Math.round(box.w * scale), h = Math.round(box.h * scale)
      const newEl = {
        id: crypto.randomUUID(), type: 'logic', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, ...logic,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setLogicEditor(null)
  }, [logicEditor, presentation, updateElement, slideW, slideH])

  const addFreebody = useCallback(() => {
    setFreebodyEditor({ elementId: null, diagram: defaultFreebody(slideIsDark()), slideBg: slideBackdrop() })
  }, [slideIsDark, slideBackdrop])

  const openFreebodyEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'freebody' || heldByOther(elementId)) return
    const diagram = {}
    for (const key of FREEBODY_FIELDS) if (element[key] !== undefined) diagram[key] = element[key]
    setFreebodyEditor({ elementId, diagram, slideBg: slideBackdrop() })
  }, [presentation, slideBackdrop])

  const saveFreebody = useCallback((diagram) => {
    const elementId = freebodyEditor?.elementId
    const box = freebodyBox(diagram)
    if (elementId) {
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
      // Keep its width; its height follows the diagram's new shape
      const w = element?.width || Math.round(box.w)
      updateElement(elementId, { ...diagram, height: Math.max(20, Math.round(w * box.h / box.w)) })
    } else {
      const scale = Math.min(1, (slideW * 0.6) / box.w, (slideH * 0.75) / box.h)
      const w = Math.round(box.w * scale), h = Math.round(box.h * scale)
      const newEl = {
        id: crypto.randomUUID(), type: 'freebody', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, ...diagram,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setFreebodyEditor(null)
  }, [freebodyEditor, presentation, updateElement, slideW, slideH])

  const addVenn = useCallback(() => {
    setVennEditor({ elementId: null, diagram: defaultVenn(slideIsDark()), slideBg: slideBackdrop() })
  }, [slideIsDark, slideBackdrop])

  const openVennEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'venn' || heldByOther(elementId)) return
    const diagram = {}
    for (const key of VENN_FIELDS) if (element[key] !== undefined) diagram[key] = element[key]
    setVennEditor({ elementId, diagram, slideBg: slideBackdrop() })
  }, [presentation, slideBackdrop])

  const saveVenn = useCallback((diagram) => {
    const elementId = vennEditor?.elementId
    const box = vennBox(diagram)
    if (elementId) {
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
      // Keep its width; its height follows the diagram's new shape
      const w = element?.width || Math.round(box.w)
      updateElement(elementId, { ...diagram, height: Math.max(20, Math.round(w * box.h / box.w)) })
    } else {
      const fit = Math.min(1, (slideW * 0.6) / box.w, (slideH * 0.75) / box.h)
      const w = Math.round(box.w * fit), h = Math.round(box.h * fit)
      const newEl = {
        id: crypto.randomUUID(), type: 'venn', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, ...diagram,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setVennEditor(null)
  }, [vennEditor, presentation, updateElement, slideW, slideH])

  const addTiming = useCallback(() => {
    setTimingEditor({ elementId: null, diagram: defaultTiming(slideIsDark()), slideBg: slideBackdrop() })
  }, [slideIsDark, slideBackdrop])

  const openTimingEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'timing' || heldByOther(elementId)) return
    const diagram = {}
    for (const key of TIMING_FIELDS) if (element[key] !== undefined) diagram[key] = element[key]
    setTimingEditor({ elementId, diagram, slideBg: slideBackdrop() })
  }, [presentation, slideBackdrop])

  const saveTiming = useCallback((diagram) => {
    const elementId = timingEditor?.elementId
    const box = timingBox(diagram)
    if (elementId) {
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
      // Keep its width; its height follows the diagram's new shape
      const w = element?.width || Math.round(box.w)
      updateElement(elementId, { ...diagram, height: Math.max(20, Math.round(w * box.h / box.w)) })
    } else {
      // As wide as fits: timing diagrams are long
      const fit = Math.min(1.6, (slideW * 0.9) / box.w, (slideH * 0.8) / box.h)
      const w = Math.round(box.w * fit), h = Math.round(box.h * fit)
      const newEl = {
        id: crypto.randomUUID(), type: 'timing', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, ...diagram,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setTimingEditor(null)
  }, [timingEditor, presentation, updateElement, slideW, slideH])

  const addGeometry = useCallback(() => {
    setGeometryEditor({ elementId: null, diagram: defaultGeometry(slideIsDark()), size: GEOMETRY_SIZE, slideBg: slideBackdrop() })
  }, [slideIsDark, slideBackdrop])

  const openGeometryEditor = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'geometry' || heldByOther(elementId)) return
    const diagram = {}
    for (const key of GEOMETRY_FIELDS) if (element[key] !== undefined) diagram[key] = element[key]
    setGeometryEditor({ elementId, diagram, size: { w: element.width || GEOMETRY_SIZE.w, h: element.height || GEOMETRY_SIZE.h }, slideBg: slideBackdrop() })
  }, [presentation, slideBackdrop])

  const saveGeometry = useCallback((diagram) => {
    const elementId = geometryEditor?.elementId
    if (elementId) {
      // The figure was edited at the element's shape, so it keeps it
      updateElement(elementId, diagram)
    } else {
      const w = Math.min(GEOMETRY_SIZE.w, Math.round(slideW * 0.9)), h = Math.round(w * GEOMETRY_SIZE.h / GEOMETRY_SIZE.w)
      const newEl = {
        id: crypto.randomUUID(), type: 'geometry', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, ...diagram,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setGeometryEditor(null)
  }, [geometryEditor, updateElement, slideW, slideH])

  const addMolecule = useCallback(() => setMoleculePicker({ elementId: null }), [])

  // A periodic table, as large as the slide allows, in the slide's colors;
  // everything about it is set in the properties panel
  const addPeriodic = useCallback(() => {
    const table = defaultPeriodic(slideIsDark())
    const box = periodicBox(table)
    const scale = Math.min((slideW * 0.94) / box.w, (slideH * 0.92) / box.h)
    const w = Math.round(box.w * scale), h = Math.round(box.h * scale)
    const newEl = {
      id: crypto.randomUUID(), type: 'periodic', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
      width: w, height: h, zIndex: 2, ...table,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [slideIsDark, slideW, slideH])

  // Spherical harmonics, Y_2^1 to start, in the slide's colors; everything
  // about it is set in the properties panel
  const addHarmonics = useCallback(() => {
    const w = Math.round(slideW * 0.6), h = Math.round(slideH * 0.72)
    const newEl = {
      id: crypto.randomUUID(), type: 'harmonics', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
      width: w, height: h, zIndex: 2, ...defaultHarmonics(slideIsDark()),
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [slideIsDark, slideW, slideH])

  const openMoleculePicker = useCallback((elementId) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'molecule' || heldByOther(elementId)) return
    setMoleculePicker({ elementId })
  }, [presentation])

  // The structure is uploaded like any other file, so presenting it needs
  // nothing from PubChem or the PDB; a new structure starts framed to fit
  const pickMolecule = useCallback(async (structure) => {
    const elementId = moleculePicker?.elementId
    const file = new File([structure.text], structure.fileName, { type: 'text/plain' })
    const result = await api.uploadFileToPresentation(presentation.id, file)
    if (!result?.url) throw new Error('The structure couldn’t be uploaded.')
    const fields = { src: result.url, format: structure.format, name: structure.name, source: structure.source || null, view: null }
    if (elementId) {
      updateElement(elementId, fields)
    } else {
      const w = 420, h = 360
      const newEl = {
        id: crypto.randomUUID(), type: 'molecule', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, ...MOLECULE_DEFAULTS, ...fields,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setMoleculePicker(null)
  }, [moleculePicker, presentation?.id, updateElement, slideW, slideH])

  const saveTikzDiagram = useCallback(({ state, tikz, svg, width, height }) => {
    const elementId = tikzEditor?.elementId
    if (elementId) {
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
      // Keep its width; its height follows the diagram's new shape
      updateElement(elementId, { editorState: state, tikz, svg, height: Math.round((element?.width || width) * height / width) })
    } else {
      const scale = Math.min(1, (slideW * 0.6) / width, (slideH * 0.6) / height)
      const w = Math.round(width * scale), h = Math.round(height * scale)
      const newEl = {
        id: crypto.randomUUID(), type: 'tikz', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2),
        width: w, height: h, zIndex: 2, editorState: state, tikz, svg,
      }
      setPresentation(prev => {
        if (!prev) return prev
        return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
      })
      setSelectedElementIds([newEl.id])
    }
    setTikzEditor(null)
  }, [tikzEditor, presentation, updateElement, slideW, slideH])

  const addMarkdownElement = useCallback(() => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'markdown',
      x: 80, y: 80, width: 600, height: 380, zIndex: 2,
      content: '## Hello Markdown\n\n- Item one\n- Item two\n- Item three\n\n**Bold** and *italic* text with [links](https://example.com).\n\n```python\ndef hello():\n    print("Hello!")\n```'
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addTimelineElement = useCallback(() => {
    const now = new Date()
    const startYear = now.getFullYear() - 2
    const endYear = now.getFullYear() + 1
    const newEl = {
      id: crypto.randomUUID(),
      type: 'timeline',
      x: 40, y: 140, width: slideW - 80, height: 260, zIndex: 2,
      startDate: `${startYear}-01-01`,
      endDate: `${endYear}-01-01`,
      lineColor: '#6366f1',
      dotColor: '#6366f1',
      textColor: '#ffffff',
      fontSize: 11,
      items: [
        { id: crypto.randomUUID(), date: `${startYear}-06-01`, label: 'Event 1', description: '', image: '', side: 'top' },
        { id: crypto.randomUUID(), date: `${startYear + 1}-03-01`, label: 'Event 2', description: '', image: '', side: 'bottom' },
        { id: crypto.randomUUID(), date: `${startYear + 2}-01-01`, label: 'Event 3', description: '', image: '', side: 'top' },
      ],
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [slideW])

  const addCalloutElement = useCallback((number) => {
    const num = number || ((currentSlide?.elements || []).filter(el => el.type === 'callout').length + 1)
    const newEl = {
      id: crypto.randomUUID(),
      type: 'callout',
      x: 200, y: 200, width: 36, height: 36, zIndex: 10,
      calloutNumber: num,
      calloutColor: '#ef4444',
      calloutTextColor: '#ffffff',
      fontSize: 16,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [currentSlide])

  const addIconElement = useCallback((iconName) => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'icon',
      x: 200, y: 200, width: 80, height: 80, zIndex: 2,
      iconName: iconName || 'Star',
      iconColor: '#ffffff',
      iconStrokeWidth: 2,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addShapeElement = useCallback((shape) => {
    const defaults = { line: { width: 300, height: 40 }, 'line-arrow': { width: 300, height: 40 }, circle: { width: 200, height: 200 } }
    const dim = defaults[shape] || { width: 200, height: 150 }
    const newEl = {
      id: crypto.randomUUID(),
      type: 'shape',
      shape,
      x: (slideW - dim.width) / 2,
      y: (slideH - dim.height) / 2,
      width: dim.width,
      height: dim.height,
      zIndex: (currentSlide?.elements?.length || 0) + 1,
      fill: '#6366f1',
      stroke: 'none',
      strokeWidth: 0,
      borderRadius: 0,
      opacity: 1,
      text: '',
      fontSize: 16,
      textColor: '#ffffff'
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [currentSlide])

  const addNonobjectiveElement = useCallback((preset) => {
    const presets = {
      'rule-h-thin':    { shape: 'rect', width: 400, height: 2,   fill: 'rgba(255,255,255,0.5)', locked: true },
      'rule-h-medium':  { shape: 'rect', width: 500, height: 4,   fill: 'rgba(255,255,255,0.7)', locked: true },
      'rule-h-heavy':   { shape: 'rect', width: 600, height: 8,   fill: '#ffffff', locked: true },
      'rule-v-thin':    { shape: 'rect', width: 2,   height: 300, fill: 'rgba(255,255,255,0.5)', locked: true },
      'rule-v-medium':  { shape: 'rect', width: 4,   height: 350, fill: 'rgba(255,255,255,0.7)', locked: true },
      'rule-v-heavy':   { shape: 'rect', width: 8,   height: 400, fill: '#ffffff', locked: true },
      'rule-diagonal':  { shape: 'line', width: 500, height: 40,  fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2, rotation: -15 },
      'circle-dot':     { shape: 'circle', width: 24,  height: 24,  fill: '#ffffff' },
      'circle-medium':  { shape: 'circle', width: 80,  height: 80,  fill: '#6366f1', opacity: 0.8 },
      'circle-large':   { shape: 'circle', width: 200, height: 200, fill: '#6366f1', opacity: 0.15, stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      'tone-dark':      { shape: 'rect', width: 300, height: 200, fill: '#0a0a14', opacity: 0.9 },
      'tone-medium':    { shape: 'rect', width: 300, height: 200, fill: '#2d2d4e', opacity: 0.8 },
      'tone-light':     { shape: 'rect', width: 300, height: 200, fill: 'rgba(255,255,255,0.08)' },
      'tone-accent':    { shape: 'rect', width: 300, height: 200, fill: 'rgba(99,102,241,0.15)' },
    }
    const p = presets[preset]
    if (!p) return
    const newEl = {
      id: crypto.randomUUID(),
      type: 'shape',
      x: (slideW - p.width) / 2,
      y: (slideH - p.height) / 2,
      zIndex: p.locked ? 0 : (currentSlide?.elements?.length || 0) + 1,
      stroke: 'none',
      strokeWidth: 0,
      borderRadius: 0,
      opacity: 1,
      text: '',
      fontSize: 16,
      textColor: '#ffffff',
      ...p,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
    })
    setSelectedElementIds([newEl.id])
  }, [currentSlide, slideW, slideH])

  // Tabs, already wired to show their own panels; tab 1 is selected, so its
  // On click shows how
  const addTabs = useCallback((count) => {
    const top = Math.max(0, ...(currentSlide?.elements || []).map(el => el.zIndex || 0))
    const newElements = buildTabs(count, { slideW, slideH, zIndex: top + 1, makeId: () => crypto.randomUUID() })
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), ...newElements] } : s
        )
      }
    })
    setSelectedElementIds([newElements[1].id])
  }, [currentSlide, slideW, slideH])

  // A hotspot: a marker whose hover shows a card; the marker is selected, so
  // its On hover shows how
  const addHotspot = useCallback(() => {
    const top = Math.max(0, ...(currentSlide?.elements || []).map(el => el.zIndex || 0))
    const newElements = buildHotspot({ slideW, slideH, zIndex: top + 1, makeId: () => crypto.randomUUID() })
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), ...newElements] } : s
        )
      }
    })
    setSelectedElementIds([newElements[0].id])
  }, [currentSlide, slideW, slideH])

  // Presets with states: a flip card (its front selected) and quiz answers
  // (the first answer selected), so their On click shows how
  const addStatePreset = useCallback((build, pick) => {
    const top = Math.max(0, ...(currentSlide?.elements || []).map(el => el.zIndex || 0))
    const newElements = build({ slideW, slideH, zIndex: top + 1, makeId: () => crypto.randomUUID() })
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), ...newElements] } : s
        )
      }
    })
    // With the rest of its group, as clicking it would
    const picked = newElements[pick]
    setSelectedElementIds([...newElements.filter(el => picked.groupId && el.groupId === picked.groupId && el !== picked).map(el => el.id), picked.id])
  }, [currentSlide, slideW, slideH])

  const addModularGrid = useCallback((moduleShape, cols, rows, gap) => {
    const mx = 32, my = 32
    const usableW = slideW - 2 * mx
    const usableH = slideH - 2 * my
    const modW = (usableW - (cols - 1) * gap) / cols
    const modH = (usableH - (rows - 1) * gap) / rows
    const newElements = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        newElements.push({
          id: crypto.randomUUID(),
          type: 'shape',
          shape: moduleShape,
          x: mx + c * (modW + gap),
          y: my + r * (modH + gap),
          width: modW,
          height: moduleShape === 'circle' ? modW : modH,
          zIndex: 0,
          fill: 'rgba(99,102,241,0.08)',
          stroke: 'rgba(99,102,241,0.25)',
          strokeWidth: 1,
          borderRadius: 0,
          opacity: 1,
          text: '',
          fontSize: 11,
          textColor: 'rgba(255,255,255,0.4)',
        })
      }
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? {
            ...s,
            elements: [...(s.elements || []), ...newElements],
            layoutGrid: { enabled: true, columns: cols, rows, gutter: gap, marginX: mx, marginY: my, snap: true },
          } : s
        )
      }
    })
  }, [slideW, slideH])

  const addDrawingStroke = useCallback((stroke) => {
    const pts = simplifyPoints(stroke.points, 1.5)
    if (pts.length < 2) return
    const newPath = { points: pts, color: stroke.color, strokeWidth: stroke.strokeWidth, opacity: stroke.opacity }
    setPresentation(prev => {
      if (!prev) return prev
      const slides = prev.slides.map((s, i) => {
        if (i !== currentSlideIndexRef.current) return s
        const elements = s.elements || []
        const existing = [...elements].reverse().find(el => el.type === 'drawing')
        if (existing) {
          return {
            ...s,
            elements: elements.map(el =>
              el.id === existing.id
                ? { ...el, paths: [...(el.paths || []), newPath], smooth: stroke.smooth }
                : el
            )
          }
        }
        const maxZ = elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0)
        return {
          ...s,
          elements: [...elements, {
            id: crypto.randomUUID(),
            type: 'drawing',
            x: 0, y: 0,
            width: slideW, height: slideH,
            zIndex: maxZ + 1,
            paths: [newPath],
            smooth: stroke.smooth,
          }]
        }
      })
      return { ...prev, slides }
    })
  }, [slideW, slideH])

  const addVideoElement = useCallback((src) => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'video',
      x: 130, y: 100, width: 480, height: 270, zIndex: 2,
      src,
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
      objectFit: 'contain',
      poster: '',
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addModelElement = useCallback((src, name) => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'model',
      x: 240, y: 90, width: 480, height: 360, zIndex: 2,
      src,
      name,
      ...MODEL_DEFAULTS,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addAudioElement = useCallback((src) => {
    const newEl = {
      id: crypto.randomUUID(),
      type: 'audio',
      x: 80, y: 400, width: 400, height: 60, zIndex: 2,
      src,
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  const addTableElement = useCallback((rows = 3, cols = 3) => {
    const data = Array.from({ length: rows }, (_, ri) =>
      Array.from({ length: cols }, (_, ci) => ri === 0 ? `Header ${ci + 1}` : '')
    )
    const newEl = {
      id: crypto.randomUUID(),
      type: 'table',
      x: 80, y: 100, width: 600, height: 300, zIndex: 2,
      data,
      headerRow: true,
      cellPadding: 8,
      borderColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      headerBgColor: 'rgba(99,102,241,0.3)',
      cellBgColor: 'transparent',
      textColor: '#ffffff',
      fontSize: 14,
    }
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s
        )
      }
    })
    setSelectedElementIds([newEl.id])
  }, [])

  // Editing a text box: where a click put it, at the end of its text
  // (caret: 'end'), or with a typed character added there (insert)
  const startEditingElement = useCallback((elementId, { caret = null, insert = null } = {}) => {
    const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(el => el.id === elementId)
    if (!element || element.type !== 'text' || heldByOther(elementId)) return
    setEditingElementId(elementId)
    editingElementIdRef.current = elementId
    setSelectedElementIds([elementId])
    editingHint.current = element.placeholder ? placeholderHint(element) : ''
    settingContent.current = true
    // With its citations' labels as the index has them now
    editor?.commands.setContent(resolveCitationsInHtml(element.content || '', citationIndex.labelByKey), false)
    settingContent.current = false
    setTimeout(() => {
      if (!editor) return
      if (insert) editor.chain().focus('end').command(({ tr }) => { tr.insertText(insert); return true }).run()
      else editor.commands.focus(caret || undefined)
    }, 10)
  }, [presentation, editor, citationIndex])

  const stopEditingElement = useCallback(() => {
    // A citation inserted while editing was labelled as if it came last; with
    // the text in place, the stored labels catch up with the index (a deck
    // with nothing to change comes back as it was)
    if (editingElementIdRef.current) setPresentation(prev => prev && applyCitationNumbering(prev))
    setEditingElementId(null)
    editingElementIdRef.current = null
  }, [])

  const bringElementForward = useCallback((id) => {
    if (recordingRef.current) return
    updateElement(id, {
      zIndex: (currentSlide?.elements?.find(el => el.id === id)?.zIndex || 1) + 1
    })
  }, [currentSlide, updateElement])

  const sendElementBackward = useCallback((id) => {
    if (recordingRef.current) return
    updateElement(id, {
      zIndex: Math.max(1, (currentSlide?.elements?.find(el => el.id === id)?.zIndex || 1) - 1)
    })
  }, [currentSlide, updateElement])

  // Undo and redo leave present-mode ink alone, and a change to the ink alone
  // isn't an undo step (see utils/deckDoc.js)
  const doUndo = useCallback(() => {
    const deck = undoDeck()
    if (deck) setCurrentSlideIndex(ci => Math.max(0, Math.min(ci, deck.slides.length - 1)))
  }, [])

  const updateMathNode = useCallback((attrs) => {
    setActiveMathNode(prev => prev ? { ...prev, ...attrs } : null)
    if (mathNodeUpdateRef.current) mathNodeUpdateRef.current(attrs)
  }, [])

  const doRedo = useCallback(() => {
    const deck = redoDeck()
    if (deck) setCurrentSlideIndex(ci => Math.max(0, Math.min(ci, deck.slides.length - 1)))
  }, [])

  // Esc stops recording a state, and does nothing else: it's caught before
  // the canvas, which would unselect the element
  useEffect(() => {
    if (!recording) return
    const onKeyDown = e => {
      if (e.key !== 'Escape') return
      setRecording(null)
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording])


  // Inject hljs theme CSS into the document head for the editor preview
  useEffect(() => {
    const theme = presentation?.codeTheme || 'monokai'
    let style = document.getElementById('hljs-theme-css')
    if (!style) {
      style = document.createElement('style')
      style.id = 'hljs-theme-css'
      document.head.appendChild(style)
    }
    style.textContent = CODE_THEME_CSS[theme] || CODE_THEME_CSS['monokai']
  }, [presentation?.codeTheme])

  // A template's custom CSS applies to presented decks, where its selectors
  // (.reveal .slides …) match; it isn't put into the editor's own page, where
  // it matched nothing of the slides and all of the editor: a collaborator's
  // could cover it, or read what's typed into its fields through selectors

  const selectedBase = currentSlide?.elements?.find(el => el.id === selectedElementId) || null
  // The Properties panel shows the state being recorded
  const selectedElement = selectedBase && recording?.elementId === selectedBase.id ? withState(selectedBase, recording.stateId) : selectedBase

  const toggleElementSelection = useCallback((id, multi = false) => {
    if (!id) { setSelectedElementIds([]); return }
    if (multi) {
      setSelectedElementIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    } else {
      // If element is in a group, select all group members, with the one
      // clicked last for the Properties panel to edit
      const slide = presentation?.slides[currentSlideIndexRef.current]
      const el = slide?.elements?.find(e => e.id === id)
      if (el?.groupId) {
        const groupIds = (slide?.elements || []).filter(e => e.groupId === el.groupId && e.id !== id).map(e => e.id)
        setSelectedElementIds([...groupIds, id])
      } else {
        setSelectedElementIds([id])
      }
    }
  }, [presentation])

  // Updates an element and the rest of its group: click actions, hover styles
  // and being hidden at start apply to a grouped card or button as a whole
  const updateWithGroup = useCallback((id, updates) => {
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) => {
          if (i !== currentSlideIndexRef.current) return s
          const groupId = s.elements.find(el => el.id === id)?.groupId
          return { ...s, elements: s.elements.map(el => el.id === id || (groupId && el.groupId === groupId) ? editElement(recordingRef.current, el, updates) : el) }
        })
      }
    })
  }, [])

  const updateElements = useCallback((updates) => {
    setPresentation(prev => {
      if (!prev) return prev
      const map = {}
      updates.forEach(u => { map[u.id] = u })
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: s.elements.map(el => map[el.id] ? editElement(recordingRef.current, el, map[el.id]) : el) } : s
        )
      }
    })
  }, [])

  const deleteSelectedElements = useCallback(() => {
    // What someone else has open stays
    const held = selectedElementIdsRef.current.find(id => editorOf(peersRef.current, id))
    if (held) heldByOther(held, ', so it wasn’t deleted')
    const ids = selectedElementIdsRef.current.filter(id => !editorOf(peersRef.current, id))
    if (!ids.length) return
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current ? { ...s, elements: s.elements.filter(el => !ids.includes(el.id)) } : s
        )
      }
    })
    setSelectedElementIds([])
    setEditingElementId(null)
    editingElementIdRef.current = null
  }, [])

  const groupElements = useCallback(() => {
    if (recordingRef.current) return
    const ids = selectedElementIdsRef.current
    if (ids.length < 2) return
    const groupId = crypto.randomUUID()
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? {
          ...s,
          elements: s.elements.map(el => ids.includes(el.id) ? { ...el, groupId } : el)
        } : s)
      }
    })
  }, [])

  const ungroupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    setPresentation(prev => {
      if (!prev) return prev
      const slide = prev.slides[currentSlideIndexRef.current]
      // Find all groupIds for selected elements
      const groupIds = new Set((slide?.elements || []).filter(el => ids.includes(el.id) && el.groupId).map(el => el.groupId))
      if (!groupIds.size) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? {
          ...s,
          elements: s.elements.map(el => groupIds.has(el.groupId) ? { ...el, groupId: undefined } : el)
        } : s)
      }
    })
  }, [])

  const alignElements = useCallback((type) => {
    if (recordingRef.current) return
    const ids = selectedElementIdsRef.current
    if (ids.length < 2) return
    setPresentation(prev => {
      if (!prev) return prev
      const slide = prev.slides[currentSlideIndexRef.current]
      const els = slide.elements.filter(el => ids.includes(el.id))
      const upd = {}
      if (type === 'left') { const v = Math.min(...els.map(e => e.x)); els.forEach(e => { upd[e.id] = { x: v } }) }
      else if (type === 'right') { const v = Math.max(...els.map(e => e.x + e.width)); els.forEach(e => { upd[e.id] = { x: v - e.width } }) }
      else if (type === 'center-h') { const v = (Math.min(...els.map(e=>e.x)) + Math.max(...els.map(e=>e.x+e.width))) / 2; els.forEach(e => { upd[e.id] = { x: v - e.width/2 } }) }
      else if (type === 'top') { const v = Math.min(...els.map(e => e.y)); els.forEach(e => { upd[e.id] = { y: v } }) }
      else if (type === 'bottom') { const v = Math.max(...els.map(e => e.y + e.height)); els.forEach(e => { upd[e.id] = { y: v - e.height } }) }
      else if (type === 'center-v') { const v = (Math.min(...els.map(e=>e.y)) + Math.max(...els.map(e=>e.y+e.height))) / 2; els.forEach(e => { upd[e.id] = { y: v - e.height/2 } }) }
      else if (type === 'distribute-h') {
        const s = [...els].sort((a,b)=>a.x-b.x)
        if (s.length > 1) { const l=s[0].x, r=s[s.length-1].x+s[s.length-1].width, tw=s.reduce((a,e)=>a+e.width,0), gap=(r-l-tw)/(s.length-1); let cx=l; s.forEach(e=>{upd[e.id]={x:cx};cx+=e.width+gap}) }
      }
      else if (type === 'distribute-v') {
        const s = [...els].sort((a,b)=>a.y-b.y)
        if (s.length > 1) { const t=s[0].y, b=s[s.length-1].y+s[s.length-1].height, th=s.reduce((a,e)=>a+e.height,0), gap=(b-t-th)/(s.length-1); let cy=t; s.forEach(e=>{upd[e.id]={y:cy};cy+=e.height+gap}) }
      }
      return { ...prev, slides: prev.slides.map((sl,i) => i===currentSlideIndexRef.current ? { ...sl, elements: sl.elements.map(el => upd[el.id] ? {...el,...upd[el.id]} : el) } : sl) }
    })
  }, [])

  // What's selected on the current slide, in the slide's order
  const selectedOnSlide = useCallback(() => {
    const ids = selectedElementIdsRef.current
    return (presentation?.slides[currentSlideIndexRef.current]?.elements || []).filter(el => ids.includes(el.id))
  }, [presentation])

  // Elements onto the current slide, on top of what's there, selected:
  // pasted (copied from the slide `slideId`) or duplicated. On the slide
  // they came from, each paste steps down and to the right.
  const pasteElements = useCallback(({ slideId, elements }) => {
    if (!elements?.length) return
    const slide = presentation?.slides[currentSlideIndexRef.current]
    if (!slide) return
    const here = new Set((slide.elements || []).map(el => el.id))
    const sameSlide = slide.id === slideId && elements.some(el => here.has(el.id))
    const pastes = sameSlide ? ++pasteCountRef.current : 0
    const top = Math.max(0, ...(slide.elements || []).map(el => el.zIndex || 0))
    const lowest = Math.min(...elements.map(el => el.zIndex || 1))
    // New ids, links between them following, and groups of their own
    const groups = new Map()
    const groupOf = id => { if (!groups.has(id)) groups.set(id, crypto.randomUUID()); return groups.get(id) }
    const renewed = renewElementIds(elements, () => crypto.randomUUID()).map(({ layoutPart, ...el }) => ({
      ...el,
      zIndex: (el.zIndex || 1) - lowest + top + 1,
      ...(el.groupId ? { groupId: groupOf(el.groupId) } : {}),
    }))
    const placed = placePasted(renewed, { sameSlide, pastes, width: getCanvasWidth(slide, slideW, slideH), height: getCanvasHeight(slide, slideH) })
    setPresentation(prev => prev && ({
      ...prev,
      slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), ...placed] } : s),
    }))
    setSelectedElementIds(placed.map(el => el.id))
  }, [presentation, slideW, slideH])

  // A copy of what's selected: for Paste on the menus, and, given a copy
  // event's clipboard, for pasting here, in another tab or presentation, or
  // as text in another app
  const copySelection = useCallback((dataTransfer = null) => {
    const elements = selectedOnSlide()
    if (!elements.length) return false
    const slideId = presentation?.slides[currentSlideIndexRef.current]?.id ?? null
    clipboardRef.current = { slideId, elements }
    pasteCountRef.current = 0
    if (dataTransfer) writeElements(dataTransfer, elements, slideId)
    return true
  }, [presentation, selectedOnSlide])

  const duplicateSelection = useCallback(() => {
    const elements = selectedOnSlide()
    if (!elements.length) return
    pasteCountRef.current = 0
    pasteElements({ slideId: presentation?.slides[currentSlideIndexRef.current]?.id, elements })
  }, [presentation, selectedOnSlide, pasteElements])

  // Text from another app, as a text box; a long text in smaller type
  const pasteText = useCallback((html, length = 0) => {
    const slide = presentation?.slides[currentSlideIndexRef.current]
    if (!html || !slide) return
    const content = length > 120 ? html.replace(/<(p|li)>/g, '<$1 style="font-size: 24px">') : html
    const width = Math.min(720, slideW - 80)
    const newEl = {
      id: crypto.randomUUID(), type: 'text', sizeMode: 'auto',
      x: Math.round((slideW - width) / 2), y: 120, width, height: 120,
      zIndex: Math.max(0, ...(slide.elements || []).map(el => el.zIndex || 0)) + 1,
      content,
    }
    setPresentation(prev => prev && ({
      ...prev,
      slides: prev.slides.map((s, i) => i === currentSlideIndexRef.current ? { ...s, elements: [...(s.elements || []), newEl] } : s),
    }))
    setSelectedElementIds([newEl.id])
  }, [presentation, slideW])

  // An image from the clipboard, uploaded as a dropped one is
  const pasteImage = useCallback(async (file) => {
    try {
      const result = await api.uploadFile(file)
      if (result.url) addImageElement(result.url)
    } catch (err) { showNotice(`The image couldn’t be uploaded: ${err.message}`) }
  }, [addImageElement, showNotice])

  // A paste event's clipboard: elements copied from Parallax, an image, or
  // text. Whether there was something to paste.
  const pasteFromClipboard = useCallback((data) => {
    const own = readElements(data)
    if (own) { pasteElements(own); return true }
    const image = [...(data.files || [])].find(f => f.type.startsWith('image/'))
    if (image) { pasteImage(image); return true }
    const html = data.getData('text/html')
    const text = data.getData('text/plain')
    const content = html ? sanitizePastedHtml(html) : textToHtml(text)
    if (!content) return false
    pasteText(content, text.length)
    return true
  }, [pasteElements, pasteImage, pasteText])

  // Paste on a menu: what's on the system clipboard, where the browser lets
  // the page read it, else the last copy made in this tab
  const pasteFromMenu = useCallback(async () => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const image = item.types.find(t => t.startsWith('image/'))
        if (image) { await pasteImage(new File([await item.getType(image)], 'pasted-image', { type: image })); return }
        if (item.types.includes('text/html')) {
          const html = await (await item.getType('text/html')).text()
          const own = elementsFromHtml(html)
          if (own) { pasteElements(own); return }
          const content = sanitizePastedHtml(html)
          if (content) { pasteText(content, content.length); return }
        }
        if (item.types.includes('text/plain')) {
          const text = await (await item.getType('text/plain')).text()
          if (text) { pasteText(textToHtml(text), text.length); return }
        }
      }
    } catch {
      if (clipboardRef.current) { pasteElements(clipboardRef.current); return }
      showNotice('To paste from another app, press Ctrl+V')
    }
  }, [pasteElements, pasteImage, pasteText, showNotice])

  // Copy and Cut on a menu: the copy event the browser fires puts the copy
  // on the system clipboard; where it doesn't, the copy stays in this tab
  const copyFromMenu = useCallback((cut = false) => {
    let copied = false
    try { copied = document.execCommand('copy') } catch { /* refused */ }
    if (!copied) copySelection()
    if (cut) deleteSelectedElements()
  }, [copySelection, deleteSelectedElements])

  // Arrow keys: what's selected moves by `dx`, `dy`, onto the grid when it's
  // on; what's locked or open in someone else's editor stays put
  const nudgeSelection = useCallback(({ dx, dy }) => {
    const grid = showGrid ? gridSize : 0
    const to = (v, d) => (!d ? v : grid ? Math.round((v + d) / grid) * grid : v + d)
    const movable = selectedOnSlide().filter(el => !el.locked && !editorOf(peersRef.current, el.id))
    if (!movable.length) return
    updateElements(movable.map(el => ({ id: el.id, x: to(el.x || 0, dx), y: to(el.y || 0, dy) })))
  }, [showGrid, gridSize, selectedOnSlide, updateElements])

  // Ctrl+B, Ctrl+I, Ctrl+U on selected text boxes: all of their text
  const formatSelectedText = useCallback((key) => {
    const mark = { b: 'bold', i: 'italic', u: 'underline' }[key]
    const texts = selectedOnSlide().filter(el => el.type === 'text' && !editorOf(peersRef.current, el.id))
    if (!mark || !texts.length) return false
    const htmls = toggleMarkAcross(textExtensions(), texts.map(el => resolveCitationsInHtml(el.content || '', citationIndex.labelByKey)), mark)
    updateElements(texts.map((el, i) => ({ id: el.id, content: htmls[i] })))
    return true
  }, [selectedOnSlide, updateElements, citationIndex])

  // The keys PowerPoint, Keynote and Google Slides users bring, on the slide
  // (utils/shortcuts.js lists them for the Ctrl+/ sheet)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (drawTool) { setDrawTool(null); e.preventDefault(); return }
        if (editingElementId) { stopEditingElement(); setSelectedElementIds([]); e.preventDefault(); return }
        if (selectedElementIds.length > 0) { setSelectedElementIds([]); e.preventDefault(); return }
      }
      // Alt+/ searches the menus, as in Google Slides, even while typing
      // (on a Mac, Option+/ types ÷, so it's the key that counts)
      if (matchesShortcut(e, SHORTCUTS.searchMenus)) { setShowMenuSearch(true); e.preventDefault(); return }
      if (editingElementIdRef.current) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // Typing elsewhere, as in the outline, which has its own undo keys
      if (document.activeElement?.isContentEditable) return
      // A key the slide list took
      if (e.defaultPrevented) return
      const ctrl = e.ctrlKey || e.metaKey
      const slide = presentation?.slides[currentSlideIndex]
      const selected = (slide?.elements || []).filter(el => selectedElementIds.includes(el.id))
      const inSlideList = !!document.activeElement?.closest?.('.slide-panel')

      // The keys in the shortcuts table (utils/shortcuts.js), which the
      // Ctrl+/ sheet, the menus and the tooltips show
      const is = name => matchesShortcut(e, SHORTCUTS[name])
      if (ctrl && !e.altKey) {
        if (is('undo')) { doUndo(); e.preventDefault(); return }
        if (is('redo') || is('redoAlt')) { doRedo(); e.preventDefault(); return }
        if (is('find')) { setShowFindReplace(v => !v); e.preventDefault(); return }
        if (is('newSlide')) { addSlideAfterRef.current?.(); e.preventDefault(); return }
        if (is('shortcuts')) { setShowShortcuts(v => !v); e.preventDefault(); return }
        if (inSlideList) return
        if (is('selectAll')) { setSelectedElementIds((slide?.elements || []).map(el => el.id)); e.preventDefault(); return }
        if (!selected.length) return
        if (is('duplicate')) { duplicateSelection(); e.preventDefault(); return }
        if (is('group')) { groupElements(); e.preventDefault(); return }
        if (is('ungroup')) { ungroupElements(); e.preventDefault(); return }
        const mark = is('bold') ? 'b' : is('italic') ? 'i' : is('underline') ? 'u' : null
        if (mark && formatSelectedText(mark)) e.preventDefault()
        return
      }
      if (e.altKey || inSlideList || !selected.length) return
      const move = nudgeFor(e.key, { shift: e.shiftKey, grid: showGrid, gridSize })
      if (move) { nudgeSelection(move); e.preventDefault(); return }
      // Typing on a selected text box edits it, at the end of its text, as do
      // Enter and F2
      const box = selected.length === 1 && selected[0].type === 'text' && !selected[0].locked ? selected[0] : null
      if (!box) return
      if (e.key === 'Enter' || e.key === 'F2') { startEditingElement(box.id, { caret: 'end' }); e.preventDefault() }
      else if (typesCharacter(e)) { startEditingElement(box.id, { insert: e.key }); e.preventDefault() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedElementIds, editingElementId, presentation, currentSlideIndex, stopEditingElement, startEditingElement, doUndo, doRedo, drawTool, showGrid, gridSize, duplicateSelection, groupElements, ungroupElements, formatSelectedText, nudgeSelection])

  // Copy, cut and paste with the system clipboard, from the keys or the
  // browser's own menu; not while text is being typed or is selected
  useEffect(() => {
    const typing = () => {
      if (editingElementIdRef.current) return true
      const active = document.activeElement
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName) || !!active?.isContentEditable
    }
    const textSelected = () => String(window.getSelection?.() || '').length > 0
    const onCopy = e => {
      if (typing() || textSelected() || !e.clipboardData) return
      if (copySelection(e.clipboardData)) e.preventDefault()
    }
    const onCut = e => {
      if (typing() || textSelected() || !e.clipboardData) return
      if (copySelection(e.clipboardData)) { e.preventDefault(); deleteSelectedElements() }
    }
    const onPaste = e => {
      if (typing() || !e.clipboardData) return
      if (pasteFromClipboard(e.clipboardData)) e.preventDefault()
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
    }
  }, [copySelection, deleteSelectedElements, pasteFromClipboard])

  // A selected text box, formatted as a whole from the toolbar
  // (utils/wholeBoxEditor.js)
  const boxElement = !editingElementId && selectedElementIds.length === 1
    ? (currentSlide?.elements?.find(el => el.id === selectedElementIds[0] && el.type === 'text') ?? null)
    : null
  const [boxEditor, setBoxEditor] = useState(null)
  useEffect(() => {
    if (!boxElement) { setBoxEditor(null); return }
    const id = boxElement.id
    const box = createWholeBoxEditor(textExtensions(), resolveCitationsInHtml(boxElement.content || '', citationIndex.labelByKey), html => {
      if (heldByOther(id)) return
      updateElement(id, { content: html })
    })
    setBoxEditor(box)
    return () => box.destroy()
  }, [boxElement?.id, boxElement?.content]) // eslint-disable-line react-hooks/exhaustive-deps

  // Background… on a menu: the background popup, for the slide at `index`
  const openBackground = (index = null) => {
    if (index !== null && index !== currentSlideIndex) setCurrentSlideIndex(index)
    stopEditingElement()
    setSelectedElementIds([])
    askToolbar('background')
  }

  // Replace image… on an image's menu: another file in its place
  const replaceImage = (id) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const result = await api.uploadFile(file)
        if (result.url) updateElement(id, { src: result.url, crop: null, imageW: null, imageH: null, imageOffsetX: null, imageOffsetY: null })
      } catch (err) { showNotice(`The image couldn’t be uploaded: ${err.message}`) }
    }
    input.click()
  }

  // An element's right-click menu, for what's selected (the element
  // right-clicked is)
  const elementCommand = (command, id) => {
    if (command === 'cut') copyFromMenu(true)
    else if (command === 'copy') copyFromMenu(false)
    else if (command === 'paste') pasteFromMenu()
    else if (command === 'duplicate') duplicateSelection()
    else if (command === 'delete') deleteSelectedElements()
    else if (command === 'group') groupElements()
    else if (command === 'ungroup') ungroupElements()
    else if (command === 'lock' || command === 'unlock') updateElements(selectedOnSlide().map(el => ({ id: el.id, locked: command === 'lock' })))
    else if (command === 'replace-image') replaceImage(id)
    else if (command === 'edit-figure') editFigure(id)
  }

  // A figure kept as it is, opened again in the plot import: its elements on
  // this slide (those still grouped with the one right-clicked), and its file
  const editFigure = (id) => {
    const els = currentSlide?.elements || []
    const el = els.find(e => e.id === id)
    if (!el?.figure?.src) return
    const figure = els.filter(e => e.figure?.id === el.figure.id && (!el.groupId || e.groupId === el.groupId))
    setPlotImport({ source: { url: el.figure.src, name: el.figure.file }, figure })
  }

  // The empty slide's right-click menu
  const canvasCommand = (command) => {
    if (command === 'paste') pasteFromMenu()
    else if (command === 'select-all') setSelectedElementIds((currentSlide?.elements || []).map(el => el.id))
    else if (command === 'background') openBackground()
    else if (command === 'change-layout') setLayoutChangeIndex(currentSlideIndex)
    else if (command === 'toggle-grid') setShowGrid(v => !v)
    else if (command === 'toggle-rulers') setShowRulers(v => !v)
  }

  // Helper: build a map of colNum → flat indices within that column
  const getColumnsMap = (slides) => {
    const colMap = {}
    slides.forEach((s, i) => {
      const c = s.column ?? 0
      if (!colMap[c]) colMap[c] = []
      colMap[c].push(i)
    })
    return colMap
  }

  // A slide from the layout `templateKey`, right after the slide at
  // `afterIndex` (the current one), as PowerPoint, Keynote and Google Slides
  // add it. In a deck of columns, a slide for another column (`targetColNum`)
  // goes at the end of that column.
  const addSlide = (templateKey = null, targetColNum = null, afterIndex = currentSlideIndex) => {
    const is2D = presentation.slides.some(s => s.column !== undefined)
    const colNum = targetColNum !== null
      ? targetColNum
      : is2D
        ? (presentation.slides[afterIndex]?.column ?? 0)
        : null

    const key = templateKey && SLIDE_TEMPLATES[templateKey] ? templateKey : 'title-content'
    const template = SLIDE_TEMPLATES[key]
    tickStep('slide')
    // The theme's background, unless the slide before has the old default
    // (utils/themes.js)
    const background = newSlideBackground(presentation.slides[afterIndex])
    const newSlide = {
      id: crypto.randomUUID(),
      ...(colNum !== null ? { column: colNum } : {}),
      // Which layout it came from, for the next new slide to follow
      layout: key,
      elements: layoutElements(template),
      notes: '',
      ...(background ? { background } : {}),
      ...(template?.layoutGrid ? { layoutGrid: { ...template.layoutGrid } } : {}),
      ...(template?.axisLines ? { axisLines: template.axisLines.map(a => ({ ...a, id: crypto.randomUUID() })) } : {}),
    }
    const index = newSlideIndex(presentation.slides, afterIndex, is2D ? colNum : null)
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides.splice(index, 0, newSlide)
      return { ...prev, slides }
    })
    setCurrentSlideIndex(index)
  }

  // A slide after the one at `index`, in the layout that follows its own:
  // Ctrl+M, Enter in the slide list, and New slide on a slide's menu
  const addSlideAfter = (index = currentSlideIndex) => {
    if (!presentation?.slides[index]) return
    addSlide(nextLayoutKey(presentation.slides[index], SLIDE_TEMPLATES), null, index)
  }
  addSlideAfterRef.current = addSlideAfter

  // Slide › Change layout: the slide's title and body text move into the
  // layout's placeholders; the rest stays (utils/placeholders.js)
  const changeSlideLayout = (index, key) => {
    const layout = SLIDE_TEMPLATES[key]
    if (!layout || !presentation?.slides[index]) return
    stopEditingElement()
    setSelectedElementIds([])
    setPresentation(prev => {
      const slides = [...prev.slides]
      const slide = slides[index]
      slides[index] = {
        ...slide,
        layout: key,
        elements: changeLayout(slide, layout, () => crypto.randomUUID()),
        ...(layout.layoutGrid ? { layoutGrid: { ...layout.layoutGrid } } : {}),
        ...(layout.axisLines ? { axisLines: layout.axisLines.map(a => ({ ...a, id: crypto.randomUUID() })) } : {}),
      }
      return { ...prev, slides }
    })
    if (index !== currentSlideIndex) setCurrentSlideIndex(index)
  }

  // A theme from the gallery: the deck's, and every slide that still has the
  // old dark default takes the theme's page instead (one undo step)
  const applyTheme = (id) => {
    tickStep('theme')
    setPresentation(({ themeColors, themeSource, ...prev }) => ({
      // A new theme brings its own colors: the deck's Customize ones go, and
      // the deck no longer has the saved theme it came from
      ...prev,
      theme: id,
      slides: prev.slides.map(slide => {
        if (!isLegacyBackground(slide.background)) return slide
        const { background, ...rest } = slide
        return rest
      }),
    }))
  }

  // The deck's text styles (utils/textStyles.js), from the Themes panel's
  // Text tab; none when they're back at the defaults
  const applyTextStyles = (styles) => {
    setPresentation(prev => {
      const { textStyles, ...rest } = prev
      return styles ? { ...rest, textStyles: styles } : rest
    })
  }

  // The deck's own colors over its theme's (Themes panel › Customize) and its
  // stylesheet (the CSS tab, utils/scopeCss.js); none when cleared
  const applyThemeColors = (colors) => {
    setPresentation(({ themeColors, ...rest }) => (colors ? { ...rest, themeColors: colors } : rest))
  }
  const applyThemeCss = (css) => {
    setPresentation(({ themeCss, ...rest }) => (css && css.trim() ? { ...rest, themeCss: css } : rest))
  }

  // A saved theme (Themes panel › My themes, utils/customTheme.js): its base,
  // colors, font, text styles and stylesheet replace the deck's, and the deck
  // remembers which theme and version it has. Slides with the old dark
  // default take the theme's page, as applyTheme does.
  const applySavedTheme = (doc, source) => {
    tickStep('theme')
    setPresentation(prev => {
      const next = applyThemeDoc(prev, doc, source)
      return { ...next, slides: next.slides.map(slide => {
        if (!isLegacyBackground(slide.background)) return slide
        const { background, ...rest } = slide
        return rest
      }) }
    })
  }
  const setThemeSource = (source) => {
    setPresentation(({ themeSource, ...rest }) => (source ? { ...rest, themeSource: source } : rest))
  }

  // The deck's stylesheet on the editor's own page, where the canvas and
  // thumbnails read it; gone when the editor closes
  useEffect(() => { setDocumentThemeCss(presentation?.themeCss || '') }, [presentation?.themeCss])
  useEffect(() => () => setDocumentThemeCss(''), [])

  const addColumn = () => {
    const slides = presentation?.slides || []
    const is2D = slides.some(s => s.column !== undefined)
    const maxCol = is2D ? slides.reduce((m, s) => Math.max(m, s.column ?? 0), 0) : 0
    const newColNum = maxCol + 1
    tickStep('slide')
    const newSlide = {
      id: crypto.randomUUID(),
      column: newColNum,
      layout: 'title-content',
      elements: layoutElements(SLIDE_TEMPLATES['title-content']),
      notes: '',
      ...(newSlideBackground(slides[currentSlideIndex]) ? { background: newSlideBackground(slides[currentSlideIndex]) } : {}),
    }
    setPresentation(prev => ({
      ...prev,
      slides: [
        ...(is2D ? prev.slides : prev.slides.map(s => ({ ...s, column: 0 }))),
        newSlide
      ]
    }))
    setCurrentSlideIndex(slides.length) // new slide appended at end
  }

  const moveSlideToColumn = (flatIndex, newColNum) => {
    setPresentation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) => i === flatIndex ? { ...s, column: newColNum } : s)
      }
    })
  }

  const moveSlideInColumn = (flatIndex, direction) => {
    if (!presentation) return
    const slides = presentation.slides
    const col = slides[flatIndex]?.column ?? 0
    const colItems = slides
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => (s.column ?? 0) === col)
    const rowIdx = colItems.findIndex(({ i }) => i === flatIndex)
    const targetRowIdx = rowIdx + direction
    if (targetRowIdx < 0 || targetRowIdx >= colItems.length) return
    const targetFlatIndex = colItems[targetRowIdx].i
    setPresentation(prev => {
      const arr = [...prev.slides]
      ;[arr[flatIndex], arr[targetFlatIndex]] = [arr[targetFlatIndex], arr[flatIndex]]
      return { ...prev, slides: arr }
    })
    if (currentSlideIndex === flatIndex) setCurrentSlideIndex(targetFlatIndex)
    else if (currentSlideIndex === targetFlatIndex) setCurrentSlideIndex(flatIndex)
  }

  const handleImportPptx = async (file) => {
    if (!file || !presentationId) return
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/presentations/${presentationId}/import-pptx`, { method: 'POST', body: fd })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Import failed') }
    const { urls } = await res.json()
    const sw = presentation.slideWidth || 960
    const sh = presentation.slideHeight || 540
    const newSlides = urls.map(url => ({
      id: crypto.randomUUID(),
      elements: [{ id: crypto.randomUUID(), type: 'image', src: url, x: 0, y: 0, width: sw, height: sh, objectFit: 'contain', zIndex: 1 }],
      notes: '',
      background: { type: 'color', color: '#000000' },
    }))
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides.splice(currentSlideIndex + 1, 0, ...newSlides)
      return { ...prev, slides }
    })
    setCurrentSlideIndex(currentSlideIndex + 1)
  }

  const importSlidesFromPresentation = (importedSlides) => {
    if (!importedSlides.length) return
    const is2D = presentation.slides.some(s => s.column !== undefined)
    // New ids, with links between the imported slides following them
    const newSlides = renewSlideIds(importedSlides, () => crypto.randomUUID())
      .map(slide => is2D ? { ...slide, column: presentation.slides[currentSlideIndex]?.column ?? 0 } : slide)
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides.splice(currentSlideIndex + 1, 0, ...newSlides)
      return { ...prev, slides }
    })
    setCurrentSlideIndex(currentSlideIndex + 1)
  }

  // Slides made from LaTeX Beamer (BeamerImportModal), after this one, with
  // the references they cite joined to the bibliography
  const insertBeamerSlides = (newSlides, bibliography) => {
    if (!newSlides.length) return
    const column = presentation.slides.some(s => s.column !== undefined) ? presentation.slides[currentSlideIndex]?.column ?? 0 : undefined
    const placed = column === undefined ? newSlides : newSlides.map(slide => ({ ...slide, column }))
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides.splice(currentSlideIndex + 1, 0, ...placed)
      return applyCitationNumbering({ ...prev, slides, ...(bibliography ? { bibliography } : {}) })
    })
    setCurrentSlideIndex(currentSlideIndex + 1)
    setShowBeamerModal(false)
  }

  const deleteSlide = (index) => {
    if (!presentation || presentation.slides.length <= 1) return
    // Not while someone else has something on it open
    const open = presentation.slides[index]?.elements?.map(el => editorOf(peersRef.current, el.id)).find(Boolean)
    if (open) {
      return showNotice(open.self
        ? 'You’re editing something on this slide in another tab, so it wasn’t deleted'
        : `${open.name} is editing something on this slide, so it wasn’t deleted`)
    }
    const links = countLinksTo(presentation.slides, presentation.slides[index]?.id)
    if (links && !confirm(`${links} ${links === 1 ? 'link or button goes' : 'links or buttons go'} to this slide, and won't do anything once it's deleted. Delete it anyway?`)) return
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index)
    }))
    setCurrentSlideIndex(prev => Math.min(prev, presentation.slides.length - 2))
  }

  // Slides deleted together from the slide list; one at least stays
  const deleteSlides = (indices) => {
    if (!presentation) return
    const doomed = new Set(indices.filter(i => i >= 0 && i < presentation.slides.length))
    if (!doomed.size || doomed.size >= presentation.slides.length) return
    const open = [...doomed].flatMap(i => presentation.slides[i]?.elements || []).map(el => editorOf(peersRef.current, el.id)).find(Boolean)
    if (open) {
      return showNotice(open.self
        ? 'You’re editing something on one of these slides in another tab, so they weren’t deleted'
        : `${open.name} is editing something on one of these slides, so they weren’t deleted`)
    }
    const kept = presentation.slides.filter((_, i) => !doomed.has(i))
    const links = [...doomed].reduce((n, i) => n + countLinksTo(kept, presentation.slides[i]?.id), 0)
    if (links && !confirm(`${links} ${links === 1 ? 'link or button goes' : 'links or buttons go'} to these slides, and won't do anything once they're deleted. Delete them anyway?`)) return
    setPresentation(prev => ({ ...prev, slides: prev.slides.filter((_, i) => !doomed.has(i)) }))
    setSelectedSlideIds([])
    setCurrentSlideIndex(Math.min(Math.min(...doomed), kept.length - 1))
  }

  const duplicateSlide = (index) => {
    if (!presentation) return
    const slide = {
      ...presentation.slides[index],
      id: crypto.randomUUID(),
      elements: renewElementIds(presentation.slides[index].elements, () => crypto.randomUUID()),
    }
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides.splice(index + 1, 0, slide)
      return { ...prev, slides }
    })
    setCurrentSlideIndex(index + 1)
  }

  const moveSlide = (fromIndex, toIndex) => {
    if (!presentation) return
    if (toIndex < 0 || toIndex >= presentation.slides.length) return
    setPresentation(prev => {
      const slides = [...prev.slides]
      const [removed] = slides.splice(fromIndex, 1)
      slides.splice(toIndex, 0, removed)
      return { ...prev, slides }
    })
    setCurrentSlideIndex(toIndex)
  }

  // Multi-slide selection, tracked by slide id so it survives reordering,
  // adding and deleting without going stale.
  const selectSlide = (index) => {
    setCurrentSlideIndex(index)
    setSelectedSlideIds([])
  }

  const toggleSlideSelection = (index) => {
    if (!presentation) return
    const slides = presentation.slides
    const id = slides[index]?.id
    if (!id) return
    const currentId = slides[currentSlideIndex]?.id
    // Drop ids for slides that have since been deleted. A selection that is no
    // longer showing as a group restarts from the active slide, which is what
    // the panel is displaying at that point.
    const live = new Set(slides.map(s => s.id))
    const kept = selectedSlideIds.filter(x => live.has(x))
    const base = kept.length > 1 ? kept : (currentId ? [currentId] : [])
    if (base.includes(id)) {
      const next = base.filter(x => x !== id)
      // One slide left is just a normal single selection
      setSelectedSlideIds(next.length > 1 ? next : [])
      if (id === currentId && next.length) {
        const fallback = slides.findIndex(s => s.id === next[0])
        if (fallback >= 0) setCurrentSlideIndex(fallback)
      }
    } else {
      setSelectedSlideIds([...base, id])
      setCurrentSlideIndex(index)
    }
  }

  const moveSlides = (indices, toIndex) => {
    if (!presentation) return
    const currentId = presentation.slides[currentSlideIndex]?.id
    const slides = reorderSlides(presentation.slides, indices, toIndex)
    if (!slides) return
    setPresentation(prev => ({ ...prev, slides }))
    const nextCurrent = slides.findIndex(s => s.id === currentId)
    if (nextCurrent >= 0) setCurrentSlideIndex(nextCurrent)
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    )
  }

  if (!presentation) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Presentation not found.{' '}
        <button className="btn btn-ghost" onClick={onGoHome}>Go back</button>
      </div>
    )
  }


  // ── What can be added, for the toolbar's Insert ▾ and Science ▾ and the
  // Insert menu ─────────────────────────────────────────────────────────────
  const uploadImage = () => pickFile('image/*', async file => {
    try { const result = await api.uploadFile(file); if (result.url) addImageElement(result.url) }
    catch (err) { showNotice(`The image couldn’t be uploaded: ${err.message}`) }
  })
  const imageFromUrl = () => { const url = window.prompt('Image URL:'); if (url?.trim()) addImageElement(url.trim()) }
  const uploadVideo = () => pickFile('video/mp4,video/webm,video/ogg,video/*', async file => {
    try { const result = await api.uploadFileToPresentation(presentation.id, file); if (result.url) addVideoElement(result.url) }
    catch (err) { showNotice(`The video couldn’t be uploaded: ${err.message}`) }
  })
  const videoFromUrl = () => { const url = window.prompt('Video URL:'); if (url?.trim()) addVideoElement(url.trim()) }
  const uploadAudio = () => pickFile('audio/*', async file => {
    try { const result = await api.uploadFile(file); if (result.url) addAudioElement(result.url) }
    catch (err) { showNotice(`The audio couldn’t be uploaded: ${err.message}`) }
  })
  const uploadModel = () => pickFile('.stl,.glb', async file => {
    if (!isModelFile(file.name)) { showNotice('3D models can be STL or GLB files.'); return }
    try { const result = await api.uploadFileToPresentation(presentation.id, file); if (result.url) addModelElement(result.url, file.name) }
    catch (err) { showNotice(`The model couldn’t be uploaded: ${err.message}`) }
  })
  // A matplotlib figure, kept as drawn or as a graph, its layers coming and going by step (PlotImportModal)
  const importPlot = () => pickFile('.pdf,.svg,application/pdf,image/svg+xml', file => setPlotImport({ file }))
  const importPdfPages = () => pickFile('application/pdf,.pdf', async file => {
    showNotice('Reading the PDF…')
    try { setPdfPages(await loadPdfPages(file)) }
    catch (err) { showNotice(`The PDF couldn’t be read: ${err.message}`) }
  })
  const importPptx = () => pickFile('.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint', async file => {
    showNotice('Converting the PowerPoint file…')
    try { await handleImportPptx(file) }
    catch (err) { showNotice(`The PowerPoint file couldn’t be imported: ${err.message}`) }
  })
  const glyph = (text, style) => <span style={{ fontSize: 13, lineHeight: 1, ...style }}>{text}</span>
  const ruleIcon = (w, h, color = '#fff', extra) => <span style={{ display: 'inline-block', width: w, height: h, background: color, ...extra }} />
  const pluginTypes = pluginsLoaded ? getInsertablePluginTypes() : []
  const insertGroups = [
    { heading: 'Text', docs: 'text-typography', items: [
      { label: 'Text path', icon: glyph('T/', { fontStyle: 'italic' }), title: 'Text along a curve', action: addTextPathElement },
      { label: '3D text', icon: glyph('T', { fontWeight: 800, textShadow: '1px 1px 0 var(--accent), 2px 2px 0 var(--accent)' }), action: addText3dElement },
      { label: 'Kinetic text', icon: <Type size={14} />, title: 'Words that move in, one after another', action: () => setShowKineticModal(true) },
    ] },
    { heading: 'Math and code', docs: 'code-math', items: [
      { label: 'LaTeX and TikZ', icon: glyph('TeX', { fontFamily: 'serif', fontSize: 11, fontWeight: 700 }), keywords: 'math equation', action: addLatexElement },
      { label: 'Interactive equation', icon: glyph('x²', { fontFamily: 'serif', fontStyle: 'italic', color: 'var(--accent)' }), title: 'An equation whose terms are colored and labeled one at a time', keywords: 'math', action: addEquation },
      { label: 'Markdown', icon: glyph('M↓', { fontWeight: 700 }), action: addMarkdownElement },
      { label: 'Code', icon: <Code2 size={14} />, keywords: 'syntax highlighting', action: addCodeElement },
      { label: 'Math grid', icon: glyph('∮'), title: 'Equations lined up in a grid', keywords: 'equations', action: () => setShowMathGridModal(true) },
    ] },
    { heading: 'Media', docs: 'media', items: [
      { label: 'Upload video…', icon: <Video size={14} />, action: uploadVideo },
      { label: 'Video from URL…', icon: <Video size={14} />, keywords: 'youtube vimeo', action: videoFromUrl },
      { label: 'Upload audio…', icon: <Music size={14} />, keywords: 'sound', action: uploadAudio },
      { label: '3D model…', icon: <Box size={14} />, title: 'An STL or GLB file, to turn while presenting', keywords: 'stl glb', action: uploadModel },
      { label: 'PDF pages…', icon: <FileText size={14} />, title: 'Pages of a PDF, as images', action: importPdfPages },
      { label: 'Icon', icon: <Star size={14} />, title: 'Pick one under Shape', action: () => askToolbar('shape') },
    ] },
    { heading: 'Shapes and layout', docs: 'shapes-drawing', items: [
      { label: 'Callout', icon: glyph('1', { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700 }), title: 'A numbered marker', action: addCalloutElement },
      { label: 'Lines and rules', icon: <Minus size={14} />, keywords: 'composition circles tone blocks', items: [
        ...[['rule-h-thin', 'Thin line', ruleIcon(14, 1)], ['rule-h-medium', 'Medium line', ruleIcon(14, 2)], ['rule-h-heavy', 'Heavy line', ruleIcon(14, 4)], ['rule-diagonal', 'Diagonal line', ruleIcon(14, 2, '#fff', { transform: 'rotate(-15deg)' })],
          ['rule-v-thin', 'Thin vertical line', ruleIcon(1, 14)], ['rule-v-medium', 'Medium vertical line', ruleIcon(2, 14)], ['rule-v-heavy', 'Heavy vertical line', ruleIcon(4, 14)],
          ['circle-dot', 'Dot', ruleIcon(6, 6, '#fff', { borderRadius: '50%' })], ['circle-medium', 'Circle', ruleIcon(12, 12, '#6366f1', { borderRadius: '50%' })], ['circle-large', 'Large circle', ruleIcon(14, 14, 'rgba(99,102,241,0.25)', { borderRadius: '50%' })],
          ['tone-dark', 'Dark block', ruleIcon(14, 9, '#0a0a14', { border: '1px solid rgba(255,255,255,0.2)' })], ['tone-medium', 'Mid block', ruleIcon(14, 9, '#2d2d4e')], ['tone-light', 'Light block', ruleIcon(14, 9, 'rgba(255,255,255,0.15)')], ['tone-accent', 'Accent block', ruleIcon(14, 9, 'rgba(99,102,241,0.3)')],
        ].map(([id, label, icon]) => ({ label, icon, action: () => addNonobjectiveElement(id) })),
      ] },
      { label: 'Modular grid', icon: <LayoutGrid size={14} />, title: 'Boxes in rows and columns', items: [
        ['2 × 2 squares', 'rect', 2, 2, 16], ['3 × 2 rectangles', 'rect', 3, 2, 12], ['4 × 3 rectangles', 'rect', 4, 3, 8],
        ['3 × 3 circles', 'circle', 3, 3, 12], ['4 × 2 cards', 'rounded-rect', 4, 2, 10], ['6 × 1 strip', 'rect', 6, 1, 8],
      ].map(([label, shape, cols, rows, gap]) => ({ label, action: () => addModularGrid(shape, cols, rows, gap) })) },
      { label: 'Draw', icon: <Pencil size={14} />, title: 'Draw freehand on the slide (Esc to stop)', keywords: 'pen freehand ink', action: () => { stopEditingElement(); setSelectedElementIds([]); setDrawTool({ color: '#ffffff', strokeWidth: 3, opacity: 1, smooth: true }) } },
    ] },
    { heading: 'Interactive', docs: 'interactive-slides', items: [
      { label: 'Tabs', icon: glyph('⎕'), title: 'Tabs that switch between panels when presenting', items: [2, 3, 4].map(n => ({ label: `${n} tabs`, action: () => addTabs(n) })) },
      { label: 'Hotspot', icon: glyph('ⓘ'), title: 'A marker that shows a card while the pointer is over it', action: addHotspot },
      { label: 'Flip card', icon: glyph('↻'), title: 'A card that turns over when clicked', action: () => addStatePreset(buildFlipCard, 0) },
      { label: 'Quiz', icon: glyph('✓'), title: 'A question with answers that turn green or red when clicked', action: () => addStatePreset(buildQuiz, 1) },
      { label: 'Timeline', icon: <Clock size={14} />, title: 'Dates and events', action: addTimelineElement },
    ] },
    { heading: 'Embed', docs: 'html-embeds', items: [
      { label: 'HTML', icon: <FileCode size={14} />, action: addHtmlElement },
      { label: 'D3', icon: <FileCode size={14} />, keywords: 'd3.js chart', action: addD3Element },
      { label: 'p5.js', icon: <Code2 size={14} />, keywords: 'sketch processing', action: addP5Element },
      { label: 'anime.js', icon: glyph('✨'), keywords: 'animation', action: () => setShowAnimeModal(true) },
      { label: 'three.js', icon: glyph('▲'), keywords: '3d', action: () => setShowThreeModal(true) },
    ] },
    (pluginTypes.length > 0 || (isCloud && !guest)) && { heading: 'Plugins', docs: 'plugins', items: [
      ...pluginTypes.map(pt => ({ label: pt.label, icon: <Puzzle size={14} />, action: () => addPluginElement(pt.type) })),
      isCloud && !guest && { label: 'Browse plugins…', icon: <Search size={14} />, action: () => setShowPluginBrowser(true) },
    ].filter(Boolean) },
  ].filter(Boolean)
  const scienceItems = [
    { label: 'Graph', icon: <ChartSpline size={14} />, title: 'Functions, curves, regions and fields', keywords: 'plot chart function', action: addGraph },
    { label: '3D graph', icon: <ChartSpline size={14} />, title: 'Surfaces, curves and points in 3D, to turn while presenting', keywords: 'surface plot', action: addGraph3d },
    { label: 'Plot from a figure…', icon: <ChartSpline size={14} />, title: 'A matplotlib figure saved as PDF or SVG, kept as drawn or made a graph of its data, its layers coming and going by step', keywords: 'matplotlib import pdf svg data layers figure', action: importPlot },
    { label: 'Diagram', icon: glyph('▦'), title: 'Boxes and arrows', keywords: 'flowchart', action: () => setShowDiagramModal(true) },
    { label: 'TikZ diagram', icon: glyph('⬡'), keywords: 'latex', action: () => setTikzEditor({ elementId: null, state: null, dark: slideIsDark() }) },
    { label: 'Feynman diagram', icon: <Atom size={14} />, title: 'Particle physics diagrams that build up line by line', keywords: 'particle physics', action: addFeynman },
    { label: 'Circuit', icon: <CircuitBoard size={14} />, title: 'Circuit schematics, solved to show currents and meter readings', keywords: 'electronics circuitikz', action: addCircuit },
    { label: 'Logic gates', icon: <Binary size={14} />, title: 'Gates, latches and flip-flops, simulated step by step', keywords: 'digital truth table', action: addLogic },
    { label: 'Free-body diagram', icon: <ArrowDownToDot size={14} />, title: 'A body and the forces on it', keywords: 'forces physics mechanics', action: addFreebody },
    { label: 'Venn diagram', icon: <Blend size={14} />, title: 'Sets shaded from an expression or by clicking regions', keywords: 'sets', action: addVenn },
    { label: 'Timing diagram', icon: <Activity size={14} />, title: 'Clock, signal and bus waveforms', keywords: 'wavedrom waveform', action: addTiming },
    { label: 'Geometry', icon: <DraftingCompass size={14} />, title: 'Ruler-and-compass constructions', keywords: 'construction geogebra', action: addGeometry },
    { label: 'Molecule', icon: <FlaskConical size={14} />, title: 'A 3D structure from PubChem, the Protein Data Bank or a file', keywords: 'chemistry protein', action: addMolecule },
    { label: 'Periodic table', icon: <Grid3x3 size={14} />, title: 'Point at an element to see its details', keywords: 'chemistry elements', action: addPeriodic },
    { label: 'Spherical harmonics', icon: <Globe size={14} />, title: 'Lobes, a colored sphere, a sky map or the ℓ, m table', keywords: 'quantum orbitals', action: addHarmonics },
  ]
  // A group's items as menu items (sub-items as a submenu)
  const asMenuItems = items => items.map(item => ({ label: item.label, title: item.title, keywords: item.keywords, ...(item.items ? { items: asMenuItems(item.items) } : { action: item.action }) }))

  // ── What's selected, for the toolbar and the menus ───────────────────────
  const selectedEls = (currentSlide?.elements || []).filter(el => selectedElementIds.includes(el.id))
  const singleEl = selectedEls.length === 1 ? selectedEls[0] : null
  const toolbarSelection = {
    count: selectedEls.length,
    image: singleEl?.type === 'image' && !singleEl.locked,
    editLabel: singleEl && !singleEl.locked ? editLabelFor(singleEl.type) : null,
    canUngroup: selectedEls.some(el => el.groupId),
  }
  const selectionCommand = name => {
    if (name === 'crop' || name === 'edit') { if (singleEl) askCanvas(name, singleEl.id) }
    else elementCommand(name, singleEl?.id)
  }
  // The text the Format menu formats: the text being edited, or a selected
  // text box as a whole
  const textTarget = editingElementId ? editor : boxEditor
  const selectedTexts = selectedEls.filter(el => el.type === 'text')
  const textCommand = run => () => { if (textTarget) run(textTarget.chain().focus()).run() }
  const markCommand = (key, toggle) => () => {
    if (textTarget) textTarget.chain().focus()[toggle]().run()
    else formatSelectedText(key)
  }
  // Edit › Cut, Copy, Paste…: the text's while it's being edited, else the elements'
  const editCommand = name => {
    if (editingElementId && editor) {
      if (name === 'cut' || name === 'copy') { try { document.execCommand(name) } catch { /* refused */ } return }
      if (name === 'paste') {
        navigator.clipboard?.readText?.()
          .then(text => { if (text) editor.chain().focus().insertContent(textToHtml(text)).run() })
          .catch(() => showNotice(`To paste, press ${keyLabel('Mod+V')}`))
        return
      }
      if (name === 'select-all') { editor.chain().focus().selectAll().run(); return }
      if (name === 'delete') { editor.chain().focus().deleteSelection().run(); return }
    }
    if (name === 'select-all') canvasCommand('select-all')
    else elementCommand(name, singleEl?.id)
  }
  const addGuide = guide => setGuides(prev => {
    const next = [...prev, guide]
    setPresentation(p => p ? { ...p, guides: next } : p)
    return next
  })
  const clearGuides = () => { setGuides([]); setPresentation(p => p ? { ...p, guides: [] } : p) }
  const openHistory = async () => {
    setSnapshots(await api.getSnapshots(presentationId))
    setShowHistoryModal(true)
  }
  const openFiles = async () => {
    setShowFileBrowser(true)
    setFileBrowserLoading(true)
    try { const files = await api.getPresentationUploads(presentationId); setFileBrowserFiles(Array.isArray(files) ? files : []) }
    catch { setFileBrowserFiles([]) }
    setFileBrowserLoading(false)
  }
  const annotationSets = isTemplate ? [] : recentAnnotationSets(presentation)
  const editing = !!editingElementId
  const anySelected = selectedEls.length > 0

  // The Sync button beside Share (the owner's)
  const syncItems = [
    { label: 'GitHub…', icon: <Github size={13} />, action: () => setShowGithubModal(true) },
    ZENODO_ENABLED && {
      label: 'Zenodo…',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16"/><path d="M4 5l16 14"/><path d="M4 5h16"/></svg>,
      action: () => {
        setZenodoStatus(null)
        if (presentationId) api.getZenodoStatus(presentationId).then(setZenodoPubStatus).catch(() => setZenodoPubStatus(null))
        setShowZenodoModal(true)
      },
    },
    { divider: true },
    {
      label: 'Git History…',
      icon: <History size={13} />,
      action: async () => {
        setShowGitHistory(true)
        setGitLoading(true)
        try { setGitCommits(await api.getGitHistory(presentationId)) } catch (e) { setGitCommits([]); console.error(e) }
        setGitLoading(false)
      },
    },
  ].filter(Boolean)

  // The Plugins button: each installed plugin's element to add, and the
  // gallery to find more (cloud, signed in). It isn't there without either.
  const pluginItems = [
    ...pluginTypes.map(pt => ({ label: pt.label, action: () => addPluginElement(pt.type) })),
    pluginTypes.length > 0 && isCloud && !guest && { divider: true },
    isCloud && !guest && { label: 'Browse plugins…', action: () => setShowPluginBrowser(true) },
  ].filter(Boolean)

  // Practice Talk: a present, for the getting-started checklist too
  const startPractice = () => {
    tickStep('present')
    practiceInWindow(presentation, { referencesCount: hasReferencesSlide ? referencedEntries.length : 0 })
  }

  // A step of the getting-started checklist, done for you or shown where
  const checklistStep = id => {
    if (id === 'theme') setShowThemes(true)
    else if (id === 'slide') addSlideAfter()
    else if (id === 'image') uploadImage()
    else if (id === 'notes') setNotesRequest(n => n + 1)
    else if (id === 'present') presentAnnotated()
  }

  // ── The menu bar (components/MenuBar.jsx) ────────────────────────────────
  const menus = [
    { key: 'file', label: 'File', items: [
      { label: 'Import', items: [
        !guest && { label: 'PowerPoint (.pptx)…', action: importPptx },
        { label: 'PDF pages…', action: importPdfPages },
        { label: 'Plot from a PDF or SVG figure…', title: 'A matplotlib figure, kept as drawn or made a graph of its data', action: importPlot },
        { label: 'LaTeX Beamer…', action: () => setShowBeamerModal(true) },
        { label: 'Slides from another presentation…', action: () => setShowImportSlideModal(true) },
      ] },
      { label: 'Export', items: [
        { label: 'PDF', action: () => exportPDF(presentation) },
        { label: 'PowerPoint (.pptx)', action: () => exportToPptx(presentation) },
        { label: 'HTML', action: () => downloadHTML(presentation) },
        { label: 'This slide as HTML', action: () => downloadSlideHTML(presentation, currentSlideIndex) },
        { label: 'Offline HTML', title: 'One file that presents without a connection', action: () => downloadOfflineHTML(presentation) },
        annotationSets.length > 0 && { label: 'With annotations…', action: () => setShowSessions(true) },
      ] },
      '-',
      { label: 'Version history…', action: openHistory },
      { label: 'Files…', title: 'Files uploaded to this presentation', action: openFiles },
    ] },
    { key: 'edit', label: 'Edit', items: [
      { label: 'Undo', shortcut: SHORTCUTS.undo, action: editing && editor ? () => editor.chain().focus().undo().run() : doUndo, disabled: !editing && !canUndo() },
      { label: 'Redo', shortcut: SHORTCUTS.redo, action: editing && editor ? () => editor.chain().focus().redo().run() : doRedo, disabled: !editing && !canRedo() },
      '-',
      { label: 'Cut', shortcut: SHORTCUTS.cut, action: () => editCommand('cut'), disabled: !editing && !anySelected },
      { label: 'Copy', shortcut: SHORTCUTS.copy, action: () => editCommand('copy'), disabled: !editing && !anySelected },
      { label: 'Paste', shortcut: SHORTCUTS.paste, action: () => editCommand('paste') },
      { label: 'Duplicate', shortcut: SHORTCUTS.duplicate, action: () => editCommand('duplicate'), disabled: editing || !anySelected },
      { label: 'Delete', shortcut: SHORTCUTS.delete, action: () => editCommand('delete'), disabled: !editing && !anySelected },
      '-',
      { label: 'Select all', shortcut: SHORTCUTS.selectAll, action: () => editCommand('select-all') },
      '-',
      { label: 'Find and replace', shortcut: SHORTCUTS.find, action: () => setShowFindReplace(true) },
    ] },
    { key: 'view', label: 'View', items: [
      { label: 'Slides', radio: true, checked: leftView === 'slides', action: () => chooseLeftView('slides') },
      { label: 'Outline', radio: true, checked: leftView === 'outline', action: () => chooseLeftView('outline') },
      '-',
      { label: 'Grid', checked: showGrid, action: () => setShowGrid(v => !v) },
      { label: 'Grid size', items: [10, 20, 40, 80].map(size => ({ label: `${size} px`, radio: true, checked: gridSize === size, action: () => { setGridSize(size); setPresentation(prev => prev ? { ...prev, gridSize: size } : prev) } })) },
      { label: 'Rulers', checked: showRulers, action: () => setShowRulers(v => !v) },
      { label: 'Guides', items: [
        { label: 'Smart guides', title: 'Lines that show when something lines up with the slide or another element', checked: smartGuidesEnabled, action: () => setSmartGuidesEnabled(v => !v) },
        '-',
        { label: 'Add horizontal guide', action: () => { setShowRulers(true); addGuide({ axis: 'y', position: Math.round(slideH / 2) }) } },
        { label: 'Add vertical guide', action: () => { setShowRulers(true); addGuide({ axis: 'x', position: Math.round(slideW / 2) }) } },
        { label: 'Remove all guides', action: clearGuides, disabled: !guides.length },
      ] },
      '-',
      { label: 'Animation timeline', checked: showTimeline, action: () => setShowTimeline(v => !v) },
      onThemeChange && '-',
      onThemeChange && { label: 'Editor theme', items: [
        { label: 'Light', radio: true, checked: theme === 'light', action: () => onThemeChange('light') },
        { label: 'Dark', radio: true, checked: theme === 'dark', action: () => onThemeChange('dark') },
      ] },
    ] },
    { key: 'insert', label: 'Insert', items: [
      { label: 'Text box', action: addTextElement },
      { label: 'Image', items: [
        { label: 'Upload image…', action: uploadImage },
        { label: 'Image from URL…', action: imageFromUrl },
      ] },
      { label: 'Shape…', action: () => { stopEditingElement(); setSelectedElementIds([]); askToolbar('shape') } },
      { label: 'Table…', action: () => { stopEditingElement(); setSelectedElementIds([]); askToolbar('table') } },
      '-',
      ...insertGroups.map(group => ({ label: group.heading, items: asMenuItems(group.items) })),
      '-',
      { label: 'Science', items: asMenuItems(scienceItems) },
    ] },
    { key: 'format', label: 'Format', items: [
      { label: 'Text', items: [
        { label: 'Bold', shortcut: SHORTCUTS.bold, action: markCommand('b', 'toggleBold'), disabled: !textTarget && !selectedTexts.length },
        { label: 'Italic', shortcut: SHORTCUTS.italic, action: markCommand('i', 'toggleItalic'), disabled: !textTarget && !selectedTexts.length },
        { label: 'Underline', shortcut: SHORTCUTS.underline, action: markCommand('u', 'toggleUnderline'), disabled: !textTarget && !selectedTexts.length },
        { label: 'Strikethrough', shortcut: SHORTCUTS.strike, action: textCommand(c => c.toggleStrike()), disabled: !textTarget },
        { label: 'Inline code', shortcut: SHORTCUTS.code, action: textCommand(c => c.toggleCode()), disabled: !textTarget },
      ] },
      { label: 'Alignment', items: [
        { label: 'Left', shortcut: SHORTCUTS.alignLeft, action: textCommand(c => c.setTextAlign('left')), disabled: !textTarget },
        { label: 'Center', shortcut: SHORTCUTS.alignCenter, action: textCommand(c => c.setTextAlign('center')), disabled: !textTarget },
        { label: 'Right', shortcut: SHORTCUTS.alignRight, action: textCommand(c => c.setTextAlign('right')), disabled: !textTarget },
      ] },
      { label: 'Lists', items: [
        { label: 'Bulleted list', shortcut: SHORTCUTS.bulletList, action: textCommand(c => c.toggleBulletList()), disabled: !textTarget },
        { label: 'Numbered list', shortcut: SHORTCUTS.orderedList, action: textCommand(c => c.toggleOrderedList()), disabled: !textTarget },
      ] },
      { label: 'Clear formatting', action: textCommand(c => c.clearNodes().unsetAllMarks()), disabled: !textTarget },
      '-',
      { label: 'Arrange', items: [
        ['front', 'Bring to front'], ['forward', 'Bring forward'], ['backward', 'Send backward'], ['back', 'Send to back'],
      ].map(([name, label]) => ({ label, action: () => askCanvas(name, singleEl?.id), disabled: !singleEl })) },
      { label: 'Align and distribute', items: ALIGN_COMMANDS.map(([type, label]) => ({ label, action: () => alignElements(type), disabled: selectedEls.length < 2 })) },
      { label: 'Group', shortcut: SHORTCUTS.group, action: () => elementCommand('group'), disabled: selectedEls.length < 2 },
      { label: 'Ungroup', shortcut: SHORTCUTS.ungroup, action: () => elementCommand('ungroup'), disabled: !toolbarSelection.canUngroup },
      '-',
      anySelected && selectedEls.every(el => el.locked)
        ? { label: 'Unlock', action: () => elementCommand('unlock') }
        : { label: 'Lock', title: 'Keep it from being moved or resized', action: () => elementCommand('lock'), disabled: !anySelected },
    ] },
    { key: 'slide', label: 'Slide', items: [
      { label: 'New slide', shortcut: SHORTCUTS.newSlide, action: () => addSlideAfter() },
      { label: 'New slide from a layout…', action: () => { setPendingAddColumn(null); setShowTemplateModal(true) } },
      { label: 'Duplicate slide', action: () => duplicateSlide(currentSlideIndex), disabled: isViewingReferences },
      { label: 'Delete slide', action: () => deleteSlide(currentSlideIndex), disabled: isViewingReferences || presentation.slides.length <= 1 },
      '-',
      { label: 'Change layout', title: 'Move this slide’s title and text into another layout', disabled: isViewingReferences, items: Object.entries(SLIDE_TEMPLATES).map(([key, layout]) => ({ label: layout.label, radio: true, checked: currentSlide?.layout === key, action: () => changeSlideLayout(currentSlideIndex, key) })) },
      { label: 'Background…', action: () => openBackground(), disabled: isViewingReferences },
      { label: 'Transition…', title: 'How the slide comes in, in the inspector’s Animate tab', action: () => { setShowThemes(false); setInspectorTab('animate') } },
      { label: 'Theme…', title: 'The page, text and heading colors of the presentation', action: () => { setThemeTab('colors'); setShowThemes(true) } },
      { label: 'Text styles…', title: 'The size and font of every slide’s titles, headings and body text', action: () => { setThemeTab('text'); setShowThemes(true) } },
      { label: 'Footer and page numbers…', action: () => setShowDefaultSettings(true) },
      '-',
      { label: 'New vertical section', title: 'A column of slides reached with ↓ when presenting', action: addColumn },
    ] },
    { key: 'tools', label: 'Tools', items: [
      { label: `Citations and bibliography…${(presentation.bibliography || []).length ? ` (${presentation.bibliography.length})` : ''}`, action: () => setShowBibliographyModal(true) },
      { label: 'Datasets…', action: () => setShowDatasetPanel(true) },
      '-',
      !isTemplate && { label: 'Practice talk', title: 'Present with a timer on each slide, against the minutes planned in the outline', action: startPractice },
      !isTemplate && (presentation.practiceRuns || []).length > 0 && { label: 'Practice runs…', action: () => setShowPracticeRuns(true) },
      annotationSets.length > 0 && { label: 'Annotation sessions…', action: () => setShowSessions(true) },
    ] },
    { key: 'help', label: 'Help', items: [
      { label: 'Docs', action: () => { window.location.hash = '#docs' } },
      { label: 'Keyboard shortcuts', shortcut: SHORTCUTS.shortcuts, action: () => setShowShortcuts(true) },
      { label: 'Search the menus', shortcut: SHORTCUTS.searchMenus, action: () => setShowMenuSearch(true) },
      '-',
      { label: 'Getting-started checklist', title: 'Five steps to a first talk, above the slide list', action: () => { chooseLeftView('slides'); reopenChecklist() } },
    ] },
  ]

  return (
    <div className="editor-page" style={{ position: 'relative' }}>
      {/* Editor Header */}
      <div className="editor-header">
        {guest ? (
          <span
            title={`Nothing is saved to an account. This presentation and its uploads are deleted when you close this tab, or after ${guest.idleHours} hours without activity. To keep a copy, use Export → Export Offline HTML.`}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, flexShrink: 0, marginRight: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', cursor: 'help' }}
          >
            Guest · deleted when you close this tab
          </span>
        ) : (
          <button className="back-btn btn-ghost" onClick={onGoHome}>
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        {isTemplate && (
          <span style={{ fontSize: 11, background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: 4, fontWeight: 600, flexShrink: 0, marginRight: 4 }}>TEMPLATE</span>
        )}
        {presentation.expiresAt && (() => {
          const days = Math.ceil((new Date(presentation.expiresAt) - Date.now()) / 86400000)
          if (days > 14) return null
          return (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, flexShrink: 0, marginRight: 4,
              background: days <= 7 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              color: days <= 7 ? '#ef4444' : '#f59e0b',
            }}>
              {days <= 0 ? 'EXPIRED' : `Expires in ${days}d`}
            </span>
          )
        })()}
        <input
          className="title-input"
          value={presentation.title || ''}
          onChange={e => setPresentation(prev => ({ ...prev, title: e.target.value }))}
          placeholder={isTemplate ? 'Untitled Template' : 'Untitled Presentation'}
          aria-label="Title"
        />
        <MenuBar menus={menus} />
        <div className="header-controls">
          {live?.synced && (live.status !== 'connected'
            ? <span className="save-indicator" style={{ color: '#f59e0b' }} title="Your changes are kept in this tab and sent when the connection is back. Keep the tab open until then.">Reconnecting…</span>
            : <span className="save-indicator" style={live.unsent ? undefined : { color: 'var(--success)' }} title="Saved as you go; everyone editing sees your changes">{live.unsent ? 'Saving…' : 'Saved'}</span>)}
          {saveStatus === 'saving' && <span className="save-indicator">Saving...</span>}
          {saveStatus === 'saved' && <span className="save-indicator" style={{ color: 'var(--success)' }}>Saved</span>}
          {!live && !saveStatus && lastSavedAt && (
            <span className="save-indicator" style={{ fontSize: 10, color: 'var(--text-muted)' }} title={lastSavedAt.toLocaleString()}>
              {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {othersHere.length > 0 && (
            <div className="presence-avatars" role="group" aria-label="Also editing" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {othersHere.slice(0, 4).map((p, i) => {
                const index = presentation.slides.findIndex(s => s.id === p.slide)
                const where = `${p.name}${p.ai ? ' (AI)' : ''}${index >= 0 ? `, slide ${index + 1}` : ''}${p.editing ? ', editing' : ''}`
                return (
                  <button key={p.userId} title={where} aria-label={where}
                    onClick={() => { if (index >= 0) setCurrentSlideIndex(index) }}
                    style={{ marginLeft: i ? -6 : 0, width: 26, height: 26, borderRadius: '50%', border: `2px solid ${p.color}`, padding: 0, background: '#3a3a52', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {p.ai ? <Bot size={14} aria-hidden /> : p.avatarUrl ? <img src={p.avatarUrl} alt="" width={22} height={22} style={{ borderRadius: '50%' }} /> : (p.name || '?')[0].toUpperCase()}
                  </button>
                )
              })}
              {othersHere.length > 4 && (
                <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-muted)' }} title={othersHere.slice(4).map(p => p.name).join(', ')}>+{othersHere.length - 4}</span>
              )}
            </div>
          )}


          {liveSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>LIVE</span>
              <input readOnly value={`${window.location.origin}${liveSession.url}`}
                style={{ width: 180, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11, padding: '2px 6px' }}
                onClick={e => { e.target.select(); navigator.clipboard.writeText(e.target.value).catch(() => {}) }} />
              <span style={{ color: 'var(--text-muted)' }}>{liveViewers} viewer{liveViewers !== 1 ? 's' : ''}</span>
              <button onClick={async () => { await api.stopLiveSession(presentationId, liveSession.sessionId).catch(() => {}); setLiveSession(null); setLiveViewers(0) }}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '2px 4px' }}>
                Stop
              </button>
            </div>
          )}

          <button type="button" className="btn btn-secondary" aria-label="Deck settings"
            title="Deck settings: font, theme, transition, size, footer and more, for the whole presentation"
            onClick={() => setShowDefaultSettings(true)}>
            <Settings size={14} />
            <span className="header-btn-label">Settings</span>
          </button>
          <HeaderMenu label="Plugins" icon={<Puzzle size={14} />} title="Add a plugin's element, or find more plugins" items={pluginItems} />
          {!guest && !isEditor && <HeaderMenu label="Sync" icon={<CloudUpload size={14} />} title="GitHub and git history" items={syncItems} />}
          <HeaderMenu label="Share" icon={<Share2 size={14} />} title="Share link and editors" items={shareItems} />

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex' }}>
              <button
                className="btn btn-primary"
                onClick={() => presentAnnotated()}
                title="Present"
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Play size={14} />
                Present
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowPresentDropdown(v => !v)}
                title="Present options"
                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.2)', padding: '6px 5px' }}
              >
                <ChevronDown size={12} />
              </button>
            </div>
            {showPresentDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowPresentDropdown(false)} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 1000, minWidth: 170, overflow: 'hidden' }}>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={() => { setShowPresentDropdown(false); presentAnnotated() }}
                  >
                    <Play size={14} />
                    Present
                  </button>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    onClick={() => { setShowPresentDropdown(false); tickStep('present'); presenterInWindow(presentation) }}
                  >
                    <Monitor size={14} />
                    Presenter Mode
                  </button>
                  {!isTemplate && (
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      onClick={() => { setShowPresentDropdown(false); startPractice() }}
                      title="Present with a timer on each slide, against the minutes planned in the outline"
                    >
                      <Timer size={14} />
                      Practice Talk
                    </button>
                  )}
                  {!isTemplate && (presentation.practiceRuns || []).length > 0 && (
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      onClick={() => { setShowPresentDropdown(false); setShowPracticeRuns(true) }}
                      title="The time on each slide each time you practiced"
                    >
                      <ListChecks size={14} />
                      Practice runs…
                    </button>
                  )}
                  {!isTemplate && recentAnnotationSets(presentation).length > 0 && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                      <div style={{ padding: '6px 12px 2px', fontSize: 11, color: 'var(--text-muted)' }}>Continue annotating</div>
                      {recentAnnotationSets(presentation).map(set => (
                        <button key={set.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          onClick={() => { setShowPresentDropdown(false); presentAnnotated(set) }}
                          title="Present with this session's ink, and keep adding to it"
                        >
                          <Pencil size={14} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{set.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inkedSlideCount(set)} {inkedSlideCount(set) === 1 ? 'page' : 'pages'}</span>
                        </button>
                      ))}
                      <button
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        onClick={() => { setShowPresentDropdown(false); setShowSessions(true) }}
                        title="View, export, rename or delete annotation sessions"
                      >
                        <List size={14} />
                        All sessions…
                      </button>
                    </>
                  )}
                  {isCloud && !guest && !isEditor && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                      <button
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: liveSession ? 'var(--danger)' : '#ef4444', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        onClick={async () => {
                          setShowPresentDropdown(false)
                          if (liveSession) {
                            await api.stopLiveSession(presentationId, liveSession.sessionId).catch(() => {})
                            setLiveSession(null)
                            setLiveViewers(0)
                            return
                          }
                          try {
                            const { sessionId, url } = await api.startLiveSession(presentationId)
                            setLiveSession({ sessionId, url })
                            setLiveViewers(0)
                            livePresentInWindow(presentation, sessionId, (count) => setLiveViewers(count))
                          } catch (e) {
                            alert('Failed to start live session: ' + e.message)
                          }
                        }}
                      >
                        <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: liveSession ? '#ef4444' : '#ef4444', display: 'block', animation: liveSession ? 'none' : 'none' }} />
                        </span>
                        {liveSession ? 'Stop Live Session' : 'Live Present'}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Deck settings */}
      {showDefaultSettings && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowDefaultSettings(false) }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Deck settings</h2>
              <button onClick={() => setShowDefaultSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>&times;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
              {/* The editor's own look, kept in this browser: not the presentation's */}
              {onThemeChange && (
                <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Editor theme</div>
                  <select className="prop-input" value={theme} aria-label="Editor theme"
                    onChange={e => onThemeChange(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px' }}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>How the editor looks to you; the slides don't change</div>
                </div>
              )}

              {/* Font */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Font</div>
                <select className="prop-input" value={presentation.globalFont || ''}
                  onChange={e => setPresentation(prev => ({ ...prev, globalFont: e.target.value || null }))}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  <option value="">Default ({deckFontName(deckTextFont('', presentation.theme))})</option>
                  <DeckFontOptions />
                </select>
              </div>

              {/* Theme */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Theme</div>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowDefaultSettings(false); setShowThemes(true) }}
                  style={{ width: '100%', justifyContent: 'space-between', padding: '6px 8px' }} aria-label={`Theme: ${themeOf(presentation.theme).label}. Change`}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid var(--border)', background: themeOf(presentation.theme).background }} />
                    {themeOf(presentation.theme).label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Change…</span>
                </button>
              </div>

              {/* Transition */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Transition</div>
                <select className="prop-input" value={presentation.transition || 'slide'}
                  onChange={e => setPresentation(prev => ({ ...prev, transition: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  {TRANSITIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>

              {/* Resolution */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Resolution</div>
                <select className="prop-input"
                  value={(() => {
                    const w = presentation.slideWidth || 960, h = presentation.slideHeight || 540
                    if (w === 960 && h === 540) return '960x540'
                    if (w === 1280 && h === 720) return '1280x720'
                    if (w === 960 && h === 600) return '960x600'
                    if (w === 960 && h === 720) return '960x720'
                    if (w === 540 && h === 960) return '540x960'
                    return 'custom'
                  })()}
                  onChange={e => {
                    const presets = { '960x540': [960,540], '1280x720': [1280,720], '960x600': [960,600], '960x720': [960,720], '540x960': [540,960] }
                    if (presets[e.target.value]) {
                      const [w, h] = presets[e.target.value]
                      setPresentation(prev => ({ ...prev, slideWidth: w, slideHeight: h }))
                    }
                  }}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  <option value="960x540">16:9 (960 x 540)</option>
                  <option value="1280x720">16:9 HD (1280 x 720)</option>
                  <option value="960x600">16:10 (960 x 600)</option>
                  <option value="960x720">4:3 (960 x 720)</option>
                  <option value="540x960">9:16 (540 x 960)</option>
                  <option value="custom">Custom</option>
                </select>
                {!([ [960,540],[1280,720],[960,600],[960,720],[540,960] ].some(([w,h]) => (presentation.slideWidth||960)===w && (presentation.slideHeight||540)===h)) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <input type="number" className="prop-input" style={{ flex: 1, padding: '4px 6px' }}
                      value={presentation.slideWidth || 960}
                      onChange={e => setPresentation(prev => ({ ...prev, slideWidth: Number(e.target.value) || 960 }))}
                      min={200} max={3840} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>&times;</span>
                    <input type="number" className="prop-input" style={{ flex: 1, padding: '4px 6px' }}
                      value={presentation.slideHeight || 540}
                      onChange={e => setPresentation(prev => ({ ...prev, slideHeight: Number(e.target.value) || 540 }))}
                      min={200} max={3840} />
                  </div>
                )}
              </div>

              {/* Grid */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Grid</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={presentation.showPresentGrid || false}
                    onChange={e => setPresentation(prev => ({ ...prev, showPresentGrid: e.target.checked }))}
                    style={{ accentColor: 'var(--accent)' }} />
                  Show grid in present mode
                </label>
              </div>

              {/* Laser Pointer */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Laser Pointer</div>
                <select className="prop-input" value={presentation.laserPointer || 'off'}
                  onChange={e => setPresentation(prev => ({ ...prev, laserPointer: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  <option value="off">Off</option>
                  <option value="dot">Laser Dot</option>
                  <option value="spotlight">Spotlight</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Press L during presentation to toggle</div>
              </div>

              {/* Overview Panel */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Slide Overview (present mode)</div>
                <select className="prop-input" value={presentation.overviewLayout || 'linear'}
                  onChange={e => setPresentation(prev => ({ ...prev, overviewLayout: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px' }}>
                  <option value="linear">Linear</option>
                  <option value="sections">Group by Section</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={presentation.sectionNav || false}
                    onChange={e => setPresentation(prev => ({ ...prev, sectionNav: e.target.checked }))}
                    style={{ accentColor: 'var(--accent)' }} />
                  2D section navigation
                </label>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Arrow left/right between sections, up/down within</div>
              </div>

              {/* Footer */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10, fontWeight: 600 }}>Footer &amp; Page Numbers</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={presentation.showFooter || false}
                      onChange={e => setPresentation(prev => ({ ...prev, showFooter: e.target.checked }))}
                      style={{ accentColor: 'var(--accent)' }} />
                    Show footer
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={presentation.showPageNumbers || false}
                      onChange={e => setPresentation(prev => ({ ...prev, showPageNumbers: e.target.checked }))}
                      style={{ accentColor: 'var(--accent)' }} />
                    Show page numbers
                  </label>
                  {presentation.showPageNumbers && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Page number format</div>
                      <select className="prop-input" value={presentation.pageNumberFormat || 'c/t'}
                        onChange={e => setPresentation(prev => ({ ...prev, pageNumberFormat: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px' }}>
                        <option value="c">1</option>
                        <option value="c/t">1 / 10</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Clock / Timer</div>
                    <select className="prop-input" value={presentation.footerTimeMode || 'none'}
                      onChange={e => setPresentation(prev => ({ ...prev, footerTimeMode: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px' }}>
                      <option value="none">No Clock</option>
                      <option value="clock12">Clock 12h</option>
                      <option value="clock24">Clock 24h</option>
                      <option value="timer-up">Timer &uarr;</option>
                      <option value="timer-down">Timer &darr;</option>
                    </select>
                  </div>
                  {presentation.footerTimeMode === 'timer-down' && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Countdown (minutes)</div>
                      <input type="number" className="prop-input"
                        value={presentation.timerDuration ?? 20}
                        onChange={e => setPresentation(prev => ({ ...prev, timerDuration: Math.max(1, Number(e.target.value) || 1) }))}
                        min={1} style={{ width: '100%', padding: '6px 8px' }} />
                    </div>
                  )}
                </div>

                {/* Footer Style */}
                {(presentation.showFooter || presentation.showPageNumbers) && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Footer Style</div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                      {[['basic', 'Basic'], ['sequence', 'Sequence']].map(([mode, label]) => (
                        <button key={mode}
                          onClick={() => setPresentation(prev => ({ ...prev, footerMode: mode }))}
                          style={{ flex: 1, padding: '5px 0', fontSize: 12, borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)', background: (presentation.footerMode || 'basic') === mode ? 'var(--accent)' : 'var(--bg-hover)', color: (presentation.footerMode || 'basic') === mode ? 'white' : 'var(--text-secondary)' }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {presentation.footerMode === 'sequence' && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Section Titles</div>
                        {(presentation.sequenceSections || []).map((sec, i) => {
                          const secLabel = typeof sec === 'string' ? sec : (sec?.label || '')
                          const secColor = typeof sec === 'object' && sec?.color ? sec.color : ''
                          const updateSec = patch => {
                            const sections = [...(presentation.sequenceSections || [])]
                            sections[i] = { label: secLabel, color: secColor, ...patch }
                            setPresentation(prev => ({ ...prev, sequenceSections: sections }))
                          }
                          return (
                            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
                              <input className="prop-input" type="text" value={secLabel}
                                onChange={e => updateSec({ label: e.target.value })}
                                placeholder={`Section ${i + 1}`}
                                style={{ flex: 1, fontSize: 12, padding: '4px 6px' }} />
                              <input type="color" title="Active color override"
                                value={secColor || (presentation.footerColor || '#a8b4c8')}
                                onChange={e => updateSec({ color: e.target.value })}
                                style={{ width: 26, height: 26, padding: 1, background: 'var(--bg-card)', border: secColor ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }} />
                              <button onClick={() => { const sections = [...(presentation.sequenceSections || [])]; sections.splice(i, 1); setPresentation(prev => ({ ...prev, sequenceSections: sections })) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px', lineHeight: 1 }}>×</button>
                            </div>
                          )
                        })}
                        <button onClick={() => setPresentation(prev => ({ ...prev, sequenceSections: [...(prev.sequenceSections || []), { label: '', color: '' }] }))}
                          style={{ width: '100%', padding: '4px 0', fontSize: 12, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)', marginTop: 2 }}>
                          + Add Section
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 36px', gap: 8, alignItems: 'end' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Font</div>
                        <select className="prop-input" value={presentation.footerFontFamily || '-apple-system,sans-serif'}
                          onChange={e => setPresentation(prev => ({ ...prev, footerFontFamily: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px' }}>
                          <optgroup label="Sans-serif">
                            <option value="-apple-system,sans-serif">System</option>
                            <option value="Inter,sans-serif">Inter</option>
                            <option value="Roboto,sans-serif">Roboto</option>
                            <option value="'Open Sans',sans-serif">Open Sans</option>
                            <option value="'Source Sans Pro',sans-serif">Source Sans Pro</option>
                          </optgroup>
                          <optgroup label="Serif">
                            <option value="'Playfair Display',serif">Playfair Display</option>
                            <option value="Merriweather,serif">Merriweather</option>
                          </optgroup>
                          <optgroup label="Monospace">
                            <option value="'Fira Code',monospace">Fira Code</option>
                            <option value="'JetBrains Mono',monospace">JetBrains Mono</option>
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Size</div>
                        <input className="prop-input" type="number" min="8" max="32" step="1"
                          value={presentation.footerFontSize || 14}
                          onChange={e => setPresentation(prev => ({ ...prev, footerFontSize: Math.max(8, Math.min(32, Number(e.target.value) || 14)) }))}
                          style={{ width: '100%', padding: '6px 8px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Color</div>
                        <input type="color" value={presentation.footerColor || '#a8b4c8'}
                          onChange={e => setPresentation(prev => ({ ...prev, footerColor: e.target.value }))}
                          style={{ width: 32, height: 32, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }} />
                      </div>
                    </div>
                    {presentation.footerMode === 'sequence' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Inactive color</div>
                        <input type="color" value={presentation.footerInactiveColor || '#404060'}
                          onChange={e => setPresentation(prev => ({ ...prev, footerInactiveColor: e.target.value }))}
                          style={{ width: 28, height: 28, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }} />
                      </div>
                    )}
                  </div>
                )}
              {/* Caption Style */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10, fontWeight: 600 }}>Citation / Caption Style</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8, alignItems: 'end' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Font</div>
                    <select className="prop-input" value={presentation.citationFontFamily || '-apple-system,sans-serif'}
                      onChange={e => setPresentation(prev => ({ ...prev, citationFontFamily: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px' }}>
                      <optgroup label="Sans-serif">
                        <option value="-apple-system,sans-serif">System</option>
                        <option value="Inter,sans-serif">Inter</option>
                        <option value="Roboto,sans-serif">Roboto</option>
                        <option value="'Open Sans',sans-serif">Open Sans</option>
                        <option value="'Source Sans Pro',sans-serif">Source Sans Pro</option>
                      </optgroup>
                      <optgroup label="Serif">
                        <option value="'Playfair Display',serif">Playfair Display</option>
                        <option value="Merriweather,serif">Merriweather</option>
                        <option value="'Latin Modern Roman',serif">Latin Modern Roman</option>
                      </optgroup>
                      <optgroup label="Monospace">
                        <option value="'Fira Code',monospace">Fira Code</option>
                        <option value="'JetBrains Mono',monospace">JetBrains Mono</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Size</div>
                    <input className="prop-input" type="number" min="6" max="24" step="1"
                      value={presentation.citationFontSize || 10}
                      onChange={e => setPresentation(prev => ({ ...prev, citationFontSize: Math.max(6, Math.min(24, Number(e.target.value) || 10)) }))}
                      style={{ width: '100%', padding: '6px 8px' }} />
                  </div>
                </div>
              </div>

              {/* Bibliography */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>Bibliography</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {(presentation.bibliography || []).length} references
                      {(presentation.bibliography || []).length > 0 && ' — auto-generated references slide'}
                    </div>
                  </div>
                  <button onClick={() => { setShowDefaultSettings(false); setShowBibliographyModal(true) }}
                    className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
                    Manage Bibliography
                  </button>
                </div>
              </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Modal */}
      {showGithubModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGithubModal(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Save to GitHub</h3>
              <button className="btn btn-ghost" onClick={() => setShowGithubModal(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Repository Owner</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubConfig.owner}
                  onChange={e => setGithubConfig(prev => ({ ...prev, owner: e.target.value }))}
                  placeholder="username or org"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Repository Name</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubConfig.repo}
                  onChange={e => setGithubConfig(prev => ({ ...prev, repo: e.target.value }))}
                  placeholder="my-presentations"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>
                  Personal Access Token {githubConfig.hasToken && <span style={{ color: '#22c55e' }}>(saved)</span>}
                </label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubToken}
                  onChange={e => setGithubToken(e.target.value)}
                  placeholder={githubConfig.hasToken ? '••••••••  (leave blank to keep)' : 'ghp_...'}
                />
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                  Generate at github.com &rarr; Settings &rarr; Developer settings &rarr; Personal access tokens &rarr; Fine-grained tokens. Required permissions: <strong style={{ color: '#888' }}>Contents</strong> (Read and write), <strong style={{ color: '#888' }}>Metadata</strong> (Read-only).
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Pages URL <span style={{ color: '#666' }}>(optional)</span></label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubConfig.pagesUrl || ''}
                  onChange={e => setGithubConfig(prev => ({ ...prev, pagesUrl: e.target.value }))}
                  placeholder="https://jessicabirky.com/presentations"
                />
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleGithubSaveConfig}
                style={{ alignSelf: 'flex-start' }}
              >
                <Settings size={14} />
                Save Settings
              </button>

              <hr style={{ border: 'none', borderTop: '1px solid #3a3a4e', margin: '4px 0' }} />

              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Commit Message (optional)</label>
                <input
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={githubCommitMsg}
                  onChange={e => setGithubCommitMsg(e.target.value)}
                  placeholder={`${presentation?.title || 'Untitled'} ${new Date().toLocaleString()}`}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGithubPush}
                disabled={githubPushing || !githubConfig.hasToken || !githubConfig.owner || !githubConfig.repo}
                style={{ width: '100%', justifyContent: 'center', opacity: (githubPushing || !githubConfig.hasToken || !githubConfig.owner || !githubConfig.repo) ? 0.5 : 1 }}
              >
                <Github size={14} />
                {githubPushing ? 'Pushing...' : 'Push to GitHub'}
              </button>

              {githubStatus && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  background: githubStatus.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: githubStatus.type === 'success' ? '#22c55e' : '#ef4444',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {githubStatus.type === 'success' ? <Check size={14} /> : <X size={14} />}
                  <span>{githubStatus.message}</span>
                  {githubStatus.url && (
                    <a href={githubStatus.url} target="_blank" rel="noopener noreferrer"
                      style={{ marginLeft: 'auto', color: 'inherit', textDecoration: 'underline' }}>View</a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zenodo Modal */}
      {showZenodoModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowZenodoModal(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 500, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Publish to Zenodo</h3>
              <button className="btn btn-ghost" onClick={() => setShowZenodoModal(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12,
              background: zenodoConfig.hasToken ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${zenodoConfig.hasToken ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: zenodoConfig.hasToken ? '#86efac' : '#fca5a5',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {zenodoConfig.hasToken ? <Check size={14} /> : <X size={14} />}
              {zenodoConfig.hasToken
                ? <>Connected to {zenodoConfig.sandbox ? 'Sandbox' : 'Zenodo'}</>
                : <>No API token saved — add one below to publish</>
              }
            </div>

            {zenodoPubStatus?.published && (
              <div style={{ padding: '10px 14px', borderRadius: 6, fontSize: 13, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', marginBottom: 16, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Published{zenodoPubStatus.versionCount > 1 ? ` (${zenodoPubStatus.versionCount} versions)` : ''}
                </div>
                <div>Latest DOI: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 3, fontSize: 12 }}>{zenodoPubStatus.doi}</code></div>
                <a href={zenodoPubStatus.url} target="_blank" rel="noopener noreferrer" style={{ color: '#86efac', fontSize: 12 }}>View on Zenodo</a>
                {zenodoPubStatus.versions?.length > 1 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#6ee7b7' }}>Version history</summary>
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {zenodoPubStatus.versions.map((v, i) => (
                        <div key={i} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#6ee7b7', fontWeight: i === 0 ? 600 : 400 }}>v{zenodoPubStatus.versions.length - i}</span>
                          <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>{v.doi}</code>
                          <span style={{ color: '#4ade80', opacity: 0.6 }}>{new Date(v.published_at).toLocaleDateString()}</span>
                          {i === 0 && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>latest</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>
                  API Token {zenodoConfig.hasToken && <span style={{ color: '#22c55e' }}>(saved)</span>}
                </label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }}
                  value={zenodoToken}
                  onChange={e => setZenodoToken(e.target.value)}
                  placeholder={zenodoConfig.hasToken ? '••••••••  (leave blank to keep)' : 'Paste your Zenodo token'}
                />
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                  Generate at zenodo.org &rarr; Settings &rarr; Applications &rarr; Personal access tokens (scope: <code style={{ fontSize: 10 }}>deposit:write</code>)
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#a0a0b0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={zenodoConfig.sandbox}
                    onChange={e => setZenodoConfig(prev => ({ ...prev, sandbox: e.target.checked }))}
                    style={{ accentColor: '#6366f1' }}
                  />
                  Use Sandbox (sandbox.zenodo.org)
                </label>
              </div>

              <button className="btn btn-secondary" onClick={handleZenodoSaveConfig} style={{ alignSelf: 'flex-start' }}>
                <Settings size={14} />
                Save Settings
              </button>

              <hr style={{ border: 'none', borderTop: '1px solid #3a3a4e', margin: '4px 0' }} />

              <div style={{ fontSize: 12, color: '#a0a0b0', fontWeight: 600, marginBottom: -4 }}>Metadata</div>

              {zenodoMeta.creators.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    {i === 0 && <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Name *</label>}
                    <input
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                      value={c.name}
                      onChange={e => { const arr = [...zenodoMeta.creators]; arr[i] = { ...arr[i], name: e.target.value }; setZenodoMeta(m => ({ ...m, creators: arr })) }}
                      placeholder="Last, First"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    {i === 0 && <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Affiliation</label>}
                    <input
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                      value={c.affiliation}
                      onChange={e => { const arr = [...zenodoMeta.creators]; arr[i] = { ...arr[i], affiliation: e.target.value }; setZenodoMeta(m => ({ ...m, creators: arr })) }}
                      placeholder="University"
                    />
                  </div>
                  <div style={{ width: 120 }}>
                    {i === 0 && <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>ORCID</label>}
                    <input
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                      value={c.orcid}
                      onChange={e => { const arr = [...zenodoMeta.creators]; arr[i] = { ...arr[i], orcid: e.target.value }; setZenodoMeta(m => ({ ...m, creators: arr })) }}
                      placeholder="0000-0000-..."
                    />
                  </div>
                  {zenodoMeta.creators.length > 1 && (
                    <button onClick={() => setZenodoMeta(m => ({ ...m, creators: m.creators.filter((_, j) => j !== i) }))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '7px 4px', marginTop: i === 0 ? 18 : 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setZenodoMeta(m => ({ ...m, creators: [...m.creators, { name: '', affiliation: '', orcid: '' }] }))}
                style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed #3a3a4e', color: '#a0a0b0', borderRadius: 5, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
              >
                + Add creator
              </button>

              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Description</label>
                <textarea
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box', minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
                  value={zenodoMeta.description}
                  onChange={e => setZenodoMeta(m => ({ ...m, description: e.target.value }))}
                  placeholder="Brief description of the presentation..."
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Keywords (comma separated)</label>
                  <input
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                    value={zenodoMeta.keywords}
                    onChange={e => setZenodoMeta(m => ({ ...m, keywords: e.target.value }))}
                    placeholder="astronomy, stellar evolution, ..."
                  />
                </div>
                <div style={{ width: 160 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>License</label>
                  <select
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                    value={zenodoMeta.license}
                    onChange={e => setZenodoMeta(m => ({ ...m, license: e.target.value }))}
                  >
                    <option value="cc-by-4.0">CC BY 4.0</option>
                    <option value="cc-by-sa-4.0">CC BY-SA 4.0</option>
                    <option value="cc-by-nc-4.0">CC BY-NC 4.0</option>
                    <option value="cc0-1.0">CC0 (Public Domain)</option>
                    <option value="MIT">MIT</option>
                    <option value="Apache-2.0">Apache 2.0</option>
                  </select>
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleZenodoPublish}
                disabled={zenodoPublishing || !zenodoConfig.hasToken || !zenodoMeta.creators.some(c => c.name.trim())}
                style={{ width: '100%', justifyContent: 'center', opacity: (zenodoPublishing || !zenodoConfig.hasToken) ? 0.5 : 1 }}
              >
                {zenodoPublishing ? 'Publishing...' : zenodoPubStatus?.published ? 'Publish New Version' : 'Publish to Zenodo'}
              </button>

              {zenodoPublishing && (
                <div style={{ fontSize: 12, color: '#a0a0b0', textAlign: 'center' }}>
                  Uploading files and minting DOI... this may take a moment.
                </div>
              )}

              {zenodoStatus && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, fontSize: 13,
                  background: zenodoStatus.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: zenodoStatus.type === 'success' ? '#22c55e' : '#ef4444',
                  lineHeight: 1.6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {zenodoStatus.type === 'success' ? <Check size={14} /> : <X size={14} />}
                    <span>{zenodoStatus.message}</span>
                  </div>
                  {zenodoStatus.doi && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      Copy this DOI for citations: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>{zenodoStatus.doi}</code>
                    </div>
                  )}
                  {zenodoStatus.url && (
                    <a href={zenodoStatus.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: 4, color: 'inherit', textDecoration: 'underline', fontSize: 12 }}>View on Zenodo</a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowHistoryModal(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw', maxHeight: '70vh', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Version History</h3>
              <button className="btn btn-ghost" onClick={() => setShowHistoryModal(false)} style={{ padding: 4 }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                value={snapshotName}
                onChange={e => setSnapshotName(e.target.value)}
                placeholder="Snapshot name (optional)"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    api.saveSnapshot(presentationId, snapshotName || undefined).then(async () => {
                      setSnapshotName('')
                      setSnapshots(await api.getSnapshots(presentationId))
                    }, err => alert(err.message))
                  }
                }}
              />
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await api.saveSnapshot(presentationId, snapshotName || undefined)
                  } catch (err) {
                    alert(err.message) // as when it has as many versions as it may keep
                    return
                  }
                  setSnapshotName('')
                  setSnapshots(await api.getSnapshots(presentationId))
                }}
              >
                Save
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {snapshots.length === 0 ? (
                <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 20 }}>No snapshots yet</p>
              ) : (
                snapshots.map(snap => (
                  <div key={snap.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid #2a2a3e' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{snap.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {new Date(snap.createdAt).toLocaleString()} &middot; {snap.slideCount} slide{snap.slideCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={async () => {
                        const data = await api.getSnapshotData(presentationId, snap.id)
                        setDiffOldData(data)
                        setDiffOldLabel(snap.name || new Date(snap.createdAt).toLocaleString())
                        setShowDiffViewer(true)
                      }}
                    >
                      Compare
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={async () => {
                        if (!confirm('Restore this snapshot? Current changes will be overwritten.')) return
                        const restored = await api.restoreSnapshot(presentationId, snap.id)
                        setPresentation({ ...restored, slides: (restored.slides || []).map(s => s) })
                        setShowHistoryModal(false)
                      }}
                    >
                      Restore
                    </button>
                    {/* Only the owner can delete a version */}
                    {!isEditor && (
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--danger)' }}
                        title="Delete snapshot"
                        onClick={async () => {
                          await api.deleteSnapshot(presentationId, snap.id)
                          setSnapshots(await api.getSnapshots(presentationId))
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showGitHistory && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGitHistory(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 520, maxWidth: '90vw', maxHeight: '70vh', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>
                <Github size={16} style={{ marginRight: 8, verticalAlign: -2 }} />
                Git History
              </h3>
              <button className="btn btn-ghost" onClick={() => setShowGitHistory(false)} style={{ padding: 4 }}><X size={16} /></button>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {gitLoading ? (
                <p style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading commits...</p>
              ) : gitCommits.length === 0 ? (
                <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 20 }}>No commits found. Push to GitHub first.</p>
              ) : (
                gitCommits.map((commit, i) => (
                  <div key={commit.sha} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 10px', borderBottom: '1px solid #2a2a3e' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : '#555', marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {commit.message.split('\n')[0]}
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {new Date(commit.date).toLocaleString()} &middot; {commit.author} &middot; <code style={{ fontSize: 10, color: '#666' }}>{commit.sha.slice(0, 7)}</code>
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
                      onClick={async () => {
                        const data = await api.getGitVersion(presentationId, commit.sha)
                        setDiffOldData(data)
                        setDiffOldLabel(`${commit.message.split('\n')[0]} (${commit.sha.slice(0, 7)})`)
                        setShowDiffViewer(true)
                      }}
                    >
                      Compare
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
                      disabled={gitRestoring === commit.sha}
                      onClick={async () => {
                        if (!confirm(`Restore from commit ${commit.sha.slice(0, 7)}? Current changes will be overwritten.`)) return
                        setGitRestoring(commit.sha)
                        try {
                          // Versions on GitHub have no present-mode ink or practice runs; the presentation keeps its own
                          const { annotationSets, practiceRuns, ...data } = await api.getGitVersion(presentationId, commit.sha)
                          await api.updatePresentation(presentationId, data)
                          setPresentation(cur => ({ ...data, slides: (data.slides || []).map(s => s), ...(cur?.annotationSets && { annotationSets: cur.annotationSets }), ...(cur?.practiceRuns && { practiceRuns: cur.practiceRuns }) }))
                          setShowGitHistory(false)
                        } catch (e) { alert('Restore failed: ' + e.message) }
                        setGitRestoring(null)
                      }}
                    >
                      {gitRestoring === commit.sha ? '...' : 'Restore'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showDiffViewer && diffOldData && (
        <DiffViewer
          oldPresentation={diffOldData}
          newPresentation={presentation}
          oldLabel={diffOldLabel}
          newLabel="Current"
          onClose={() => { setShowDiffViewer(false); setDiffOldData(null) }}
        />
      )}

      {/* Font Manager Modal */}
      {showFontManager && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowFontManager(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw', maxHeight: '80vh', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Manage Fonts</h3>
              <button className="btn btn-ghost" onClick={() => setShowFontManager(false)} style={{ padding: 4 }}><X size={16} /></button>
            </div>

            {/* Upload font */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#2a2a3e', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#a0a0b0', fontWeight: 600, marginBottom: 8 }}>Upload a font file</div>
              <input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                disabled={fontUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setFontUploading(true)
                  try {
                    const result = await api.uploadFont(file)
                    setCustomFonts(prev => [...prev, result])
                    const style = document.createElement('style')
                    style.textContent = `@font-face { font-family: '${result.familyName}'; src: url('${result.url}'); }`
                    document.head.appendChild(style)
                  } catch (err) { alert('Upload failed: ' + err.message) }
                  setFontUploading(false)
                  e.target.value = ''
                }}
                style={{ fontSize: 12, color: '#c0c0d0' }}
              />
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>TTF, OTF, WOFF, or WOFF2</div>
            </div>

            {/* Add Google Font */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#2a2a3e', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#a0a0b0', fontWeight: 600, marginBottom: 8 }}>Add from Google Fonts</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 5, border: '1px solid #3a3a4e', background: '#1e1e2e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                  value={fontGoogleName}
                  onChange={e => setFontGoogleName(e.target.value)}
                  placeholder="Font name (e.g. Lato)"
                  onKeyDown={async e => {
                    if (e.key !== 'Enter' || !fontGoogleName.trim()) return
                    try {
                      const result = await api.addGoogleFont(fontGoogleName.trim())
                      setCustomFonts(prev => [...prev, result])
                      const link = document.createElement('link')
                      link.rel = 'stylesheet'
                      link.href = result.url
                      document.head.appendChild(link)
                      setFontGoogleName('')
                    } catch (err) { alert('Failed: ' + err.message) }
                  }}
                />
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={async () => {
                    if (!fontGoogleName.trim()) return
                    try {
                      const result = await api.addGoogleFont(fontGoogleName.trim())
                      setCustomFonts(prev => [...prev, result])
                      const link = document.createElement('link')
                      link.rel = 'stylesheet'
                      link.href = result.url
                      document.head.appendChild(link)
                      setFontGoogleName('')
                    } catch (err) { alert('Failed: ' + err.message) }
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                Browse at <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8' }}>fonts.google.com</a>, then type the exact font name here.
              </div>
            </div>

            {/* Font list */}
            <div style={{ fontSize: 12, color: '#a0a0b0', fontWeight: 600, marginBottom: 8 }}>My Fonts ({customFonts.length})</div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {customFonts.length === 0 ? (
                <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 20 }}>No custom fonts added yet.</div>
              ) : (
                customFonts.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid #2a2a3e' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#e0e0e0', fontFamily: `'${f.familyName}', sans-serif` }}>{f.familyName}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{f.source === 'google' ? 'Google Fonts' : 'Uploaded file'}</div>
                    </div>
                    <span style={{ fontSize: 16, color: '#c0c0d0', fontFamily: `'${f.familyName}', sans-serif` }}>Aa</span>
                    <button
                      className="btn-icon"
                      style={{ color: 'var(--danger)' }}
                      title="Remove font"
                      onClick={async () => {
                        await api.deleteFont(f.id)
                        setCustomFonts(prev => prev.filter(x => x.id !== f.id))
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Browser Modal */}
      {showFileBrowser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowFileBrowser(false); setFileBrowserCopied(null) } }}>
          <div style={{ background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border)', borderRadius: 12, width: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Uploaded Files</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {['all', 'image', 'video', 'audio'].map(f => (
                  <button key={f} onClick={() => setFileBrowserFilter(f)}
                    style={{ padding: '3px 10px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer',
                      background: fileBrowserFilter === f ? 'var(--accent)' : 'var(--bg-hover)', color: fileBrowserFilter === f ? '#fff' : 'var(--text-secondary)' }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <button onClick={() => { setShowFileBrowser(false); setFileBrowserCopied(null) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>&times;</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {fileBrowserLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
              ) : fileBrowserFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No files uploaded yet</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {fileBrowserFiles
                    .filter(f => fileBrowserFilter === 'all' || (f.contentType && f.contentType.startsWith(fileBrowserFilter + '/')))
                    .map(file => (
                    <div key={file.id} style={{ background: 'var(--bg-hover)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                      onClick={() => { const url = `${window.location.origin}${file.url}`; navigator.clipboard.writeText(url); setFileBrowserCopied(file.id); setTimeout(() => setFileBrowserCopied(null), 1500) }}>
                      <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                        {file.contentType?.startsWith('image/') ? (
                          <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : file.contentType?.startsWith('video/') ? (
                          <video src={file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                        ) : (
                          <span style={{ fontSize: 28, opacity: 0.3 }}>{file.contentType?.startsWith('audio/') ? '🎵' : '📄'}</span>
                        )}
                      </div>
                      <div style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                          {file.size ? `${(file.size / 1024).toFixed(0)} KB` : ''}
                        </div>
                      </div>
                      {fileBrowserCopied === file.id && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 12 }}>
                          URL Copied!
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
              Click a file to copy its URL to clipboard
            </div>
          </div>
        </div>
      )}

      {showDatasetPanel && (
        <DatasetPanel presentationId={presentationId} onClose={() => {
          setShowDatasetPanel(false)
          // Its datasets may have new rows, steps or links: graphs and
          // elements fetch again
          refreshGraphData().then(() => {
            if (!presentation) return
            loadGraphData(deckGraphs(presentation))
            loadEmbedData(presentation)
          })
          datasetManager.reload()
        }} />
      )}

      {/* Editor Body */}
      <div className="editor-body">
        {leftView === 'outline' ? (
          <OutlinePanel
            deck={presentation}
            setDeck={setPresentation}
            stopCapturing={stopCapturing}
            onUndo={doUndo}
            onRedo={doRedo}
            currentIndex={currentSlideIndex}
            onSelectSlide={selectSlide}
            onLeaveCanvas={() => {
              if (editingElementIdRef.current) stopEditingElement()
              setSelectedElementIds(ids => (ids.length ? [] : ids))
            }}
            onNotice={showNotice}
            presence={presenceBySlide}
            citationLabels={citationIndex.labelByKey}
            referencesCount={hasReferencesSlide ? referencedEntries.length : 0}
            viewSwitch={<PanelViewSwitch view="outline" onChange={chooseLeftView} />}
            onShowRuns={() => setShowPracticeRuns(true)}
          />
        ) : (
        <SlidePanel
          viewSwitch={<PanelViewSwitch view="slides" onChange={chooseLeftView} />}
          slides={presentation.slides}
          globalFont={deckTextFont(presentation.globalFont, presentation.theme)}
          textStyles={presentation.textStyles || null}
          citationLabels={citationIndex.labelByKey}
          presence={presenceBySlide}
          currentIndex={currentSlideIndex}
          onSelect={selectSlide}
          selectedIds={selectedSlideIds}
          onToggleSelect={toggleSlideSelection}
          onMoveMultiple={moveSlides}
          onAdd={(colNum) => { setPendingAddColumn(colNum ?? null); setShowTemplateModal(true) }}
          onAddColumn={addColumn}
          onDelete={deleteSlide}
          onDeleteMultiple={deleteSlides}
          onNewSlideAfter={addSlideAfter}
          onBackground={openBackground}
          onChangeLayout={index => setLayoutChangeIndex(index)}
          theme={presentation.theme || 'black'}
          themeColors={presentation.themeColors || null}
          notice={!isTemplate && showChecklist(checklist, { guest: !!guest }) ? <GettingStarted onStep={checklistStep} /> : null}
          onDuplicate={duplicateSlide}
          onMove={moveSlide}
          onMoveInColumn={moveSlideInColumn}
          onMoveToColumn={moveSlideToColumn}
          slideW={slideW}
          slideH={slideH}
          referencesSlideIndex={hasReferencesSlide ? referencesSlideIndex : -1}
          referencesCount={referencedEntries.length}
        />
        )}

        <div className="editor-main">
          <Toolbar
            editor={editingElementId ? editor : boxEditor}
            wholeBox={!editingElementId && !!boxEditor}
            editingElementId={editingElementId}
            request={toolbarRequest}
            onUndo={doUndo}
            onRedo={doRedo}
            canUndo={canUndo()}
            canRedo={canRedo()}
            onNewSlide={() => addSlideAfter()}
            onNewSlideFromLayout={() => { setPendingAddColumn(null); setShowTemplateModal(true) }}
            onAddText={addTextElement}
            onAddImage={imageFromUrl}
            onUploadImage={uploadImage}
            onAddShape={addShapeElement}
            onAddIcon={addIconElement}
            onAddCallout={() => addCalloutElement()}
            onAddTable={addTableElement}
            insertGroups={insertGroups}
            scienceItems={scienceItems}
            selection={toolbarSelection}
            onSelectionCommand={selectionCommand}
            onAlignElements={alignElements}
            slide={isViewingReferences ? null : currentSlide}
            slides={presentation.slides}
            onUpdateSlide={updateCurrentSlide}
            drawTool={drawTool}
            onSetDrawTool={setDrawTool}
            customFonts={customFonts}
            onManageFonts={() => setShowFontManager(true)}
            theme={presentation.theme || 'black'}
            themeColors={presentation.themeColors || null}
            onTheme={() => setShowThemes(v => !v)}
            themesOpen={showThemes}
          />
          <div className="canvas-area" style={{ display: 'flex', flexDirection: 'column' }}>
            {!isViewingReferences && !recording && offeredUpdates.map(u => (
              <div key={u.pluginId} role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>
                  {u.unavailable
                    ? `This deck’s ${u.name} ${u.count === 1 ? 'element is' : 'elements are'} at version ${u.from.join(' and ')}, which isn’t available any more.`
                    : `${u.name} ${u.to} is out; this deck’s ${u.count === 1 ? 'element is' : `${u.count} elements are`} at ${u.from.join(' and ')}.`}
                </span>
                <button onClick={() => updatePlugin(u)}
                  style={{ padding: '3px 10px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', background: 'var(--accent)', color: '#fff' }}>
                  {u.unavailable ? `Use ${u.to}` : `Update to ${u.to}`}
                </button>
                <button onClick={() => setDismissedUpdates(prev => new Set(prev).add(`${u.pluginId}@${u.to}`))}
                  style={{ padding: '3px 10px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', background: 'none', color: 'var(--text-secondary)' }}>
                  Not now
                </button>
              </div>
            ))}
            {!isViewingReferences && recording && (() => {
              const el = currentSlide?.elements?.find(e => e.id === recording.elementId)
              const name = el?.states?.find(st => st.id === recording.stateId)?.name || 'State'
              return (
                <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d946ef', flexShrink: 0 }} />
                  <span>Recording “{name}” of {elementLabels(currentSlide.elements).get(recording.elementId)}: moving, resizing, turning or recoloring it changes this state.</span>
                  <button onClick={() => setRecording(null)} title="Stop recording (Esc)"
                    style={{ padding: '3px 10px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', background: 'var(--accent)', color: '#fff' }}>
                    Done
                  </button>
                </div>
              )
            })()}
            {!isViewingReferences && !recording && preview.canPreview && (() => {
              const labels = elementLabels(currentSlide.elements)
              const modes = [['start', 'As it opens', 'The slide as it opens, before any clicks or hovers'],
                ...preview.clickers.map(c => [c.id, labels.get(c.id), `The slide after clicking “${labels.get(c.id)}”`]),
                ...preview.hovers.map(h => [hoverPreview(h.id), `Hover: ${labels.get(h.id)}`, `The slide while the pointer is over “${labels.get(h.id)}”`]),
                ['all', 'Everything', 'Everything on the slide, with what starts hidden faded']]
              return (
                <div role="toolbar" aria-label="Show on the canvas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Show on canvas:</span>
                  {modes.map(([mode, label, title]) => (
                    <button key={mode} title={title} aria-pressed={preview.mode === mode} onClick={() => setPreviewMode(mode)}
                      style={{ padding: '3px 10px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        background: preview.mode === mode ? 'var(--accent)' : 'var(--bg-card)', color: preview.mode === mode ? '#fff' : 'var(--text-secondary)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )
            })()}
            {isViewingReferences ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                <div style={{ width: slideW * 0.75, height: slideH * 0.75, background: '#111122', borderRadius: 8, border: '1px solid var(--border)', overflow: 'auto', padding: '24px 32px', position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                  <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 10, color: 'var(--text-muted)', background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Auto-generated</div>
                  <h2 style={{ fontSize: 22, margin: '0 0 16px', color: 'rgba(255,255,255,0.95)', fontWeight: 700 }}>References</h2>
                  <div style={{ columns: referencedEntries.length > 8 ? 2 : 1, columnGap: 24 }}>
                    {referencedEntries.map((entry, i) => {
                      const authorStr = formatAuthorLine(entry.author)
                      return (
                        <div key={entry.key} style={{ marginBottom: 8, lineHeight: 1.5, fontSize: 12, color: 'rgba(255,255,255,0.85)', breakInside: 'avoid' }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: 6 }}>[{citationIndex.numberByKey[entry.key]}]</span>
                          {authorStr}{entry.year ? ` (${entry.year})` : ''}. {entry.title}.
                          {entry.journal || entry.booktitle ? <em> {entry.journal || entry.booktitle}</em> : null}
                          {entry.volume ? `, ${entry.volume}` : ''}{entry.pages ? `, ${pageRange(entry.pages)}` : ''}
                          {entry.journal || entry.booktitle || entry.volume || entry.pages ? '.' : ''}
                          {entry.doi && <a href={`https://doi.org/${entry.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(99,102,241,0.8)', fontSize: '0.85em', marginLeft: 4 }}>DOI</a>}
                          {!entry.doi && webLink(entry.url) && <a href={webLink(entry.url).href} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(99,102,241,0.8)', fontSize: '0.85em', marginLeft: 4 }}>{webLink(entry.url).site}</a>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : <SlideCanvas
              editor={editor}
              slide={canvasSlide}
              remoteUse={remoteUse}
              fadedIds={canvasFadedIds}
              unseenIds={preview.unseenIds}
              selectedElementIds={selectedElementIds}
              editingElementId={editingElementId}
              showGrid={showGrid}
              gridSize={gridSize}
              showFooter={presentation.showFooter || false}
              showPageNumbers={presentation.showPageNumbers || false}
              footerTimeMode={presentation.footerTimeMode || 'none'}
              timerDuration={presentation.timerDuration ?? 20}
              pageNumberFormat={presentation.pageNumberFormat || 'c/t'}
              pageNumber={(() => {
                if (!presentation.showPageNumbers) return null
                if (currentSlide?.showPageNumber === false) return null
                let num = 0
                const groupSeen = new Set()
                for (let i = 0; i <= currentSlideIndex; i++) {
                  const s = presentation.slides[i]
                  if (s?.showPageNumber === false) continue
                  if (s?.slideGroup && groupSeen.has(s.slideGroup)) continue
                  num++
                  if (s?.slideGroup) groupSeen.add(s.slideGroup)
                }
                return num
              })()}
              totalSlides={(() => {
                const seen = new Set()
                return presentation.slides.filter(s => {
                  if (s.showPageNumber === false) return false
                  if (s.slideGroup) { if (seen.has(s.slideGroup)) return false; seen.add(s.slideGroup) }
                  return true
                }).length
              })()}
              sectionName={currentSlide?.section || ''}
              footerFontSize={presentation.footerFontSize || 14}
              footerFontFamily={presentation.footerFontFamily || '-apple-system,sans-serif'}
              footerColor={presentation.footerColor || 'rgba(255,255,255,0.65)'}
              footerInactiveColor={presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'}
              citationFontSize={presentation.citationFontSize || 10}
              citationLabels={citationIndex.labelByKey}
              citationFontFamily={presentation.citationFontFamily || '-apple-system,sans-serif'}
              footerMode={presentation.footerMode || 'basic'}
              sequenceSections={presentation.sequenceSections || []}
              activeSection={currentSlide?.activeSection ?? null}
              smartGuidesEnabled={smartGuidesEnabled}
              showRulers={showRulers}
              persistentGuides={guides}
              onAddGuide={(guide) => {
                setGuides(prev => {
                  const next = [...prev, guide]
                  setPresentation(p => p ? { ...p, guides: next } : p)
                  return next
                })
              }}
              onRemoveGuide={(idx) => {
                setGuides(prev => {
                  const next = prev.filter((_, i) => i !== idx)
                  setPresentation(p => p ? { ...p, guides: next } : p)
                  return next
                })
              }}
              onUpdateGuide={(idx, pos) => {
                setGuides(prev => {
                  const next = prev.map((g, i) => i === idx ? { ...g, position: pos } : g)
                  setPresentation(p => p ? { ...p, guides: next } : p)
                  return next
                })
              }}
              onToggleSelectElement={toggleElementSelection}
              onStartEdit={startEditingElement}
              onElementCommand={elementCommand}
              onCanvasCommand={canvasCommand}
              request={canvasRequest}
              theme={presentation.theme || 'black'}
              themeColors={presentation.themeColors || null}
              onStopEdit={stopEditingElement}
              onUpdateElement={updateElement}
              onUpdateElements={updateElements}
              onDeleteElement={deleteElement}
              onDeleteSelectedElements={deleteSelectedElements}
              onOpenHtmlEditor={openHtmlEditor}
              onOpenP5Editor={openP5Editor}
              onOpenCodeEditor={openCodeEditor}
              onOpenLatexEditor={openLatexEditor}
              onOpenTikzEditor={openTikzEditor}
              onOpenGraphEditor={openGraphEditor}
              onOpenEquationEditor={openEquationEditor}
              onOpenFeynmanEditor={openFeynmanEditor}
              onOpenCircuitEditor={openCircuitEditor}
              onOpenLogicEditor={openLogicEditor}
              onOpenFreebodyEditor={openFreebodyEditor}
              onOpenVennEditor={openVennEditor}
              onOpenTimingEditor={openTimingEditor}
              onOpenGeometryEditor={openGeometryEditor}
              onAddImage={async (file, dropX, dropY) => {
                try {
                  const result = await api.uploadFile(file)
                  if (result.url) addImageElement(result.url, dropX, dropY)
                } catch (err) { alert('Upload failed: ' + err.message) }
              }}
              onAddFigure={addDroppedFigure}
              slideW={slideW}
              slideH={slideH}
              drawTool={drawTool}
              onAddDrawingStroke={addDrawingStroke}
              globalFont={deckTextFont(presentation.globalFont, presentation.theme)}
              textStyles={presentation.textStyles || null}
              onUpdateAxisLines={(axisLines) => updateCurrentSlide({ axisLines })}
            />}
          </div>
          {!isViewingReferences && currentSlide && (
            <NotesStrip notes={currentSlide.notes || ''} focusRequest={notesRequest}
              onChange={notes => { if (notes.trim()) tickStep('notes'); updateCurrentSlide({ notes }) }} slideNumber={currentSlideIndex + 1} />
          )}
        </div>

        {showThemes ? (
          <ThemePanel value={presentation.theme || 'black'} font={presentation.globalFont || ''} onChange={applyTheme} onClose={() => setShowThemes(false)}
            tab={themeTab} onTab={setThemeTab}
            textStyles={presentation.textStyles || null} onTextStyles={applyTextStyles}
            onFont={font => setPresentation(prev => ({ ...prev, globalFont: font || null }))}
            themeColors={presentation.themeColors || null} onThemeColors={applyThemeColors}
            themeCss={presentation.themeCss || ''} onThemeCss={applyThemeCss}
            deck={presentation} onApplyThemeDoc={applySavedTheme} onThemeSource={setThemeSource} />
        ) : <PropertiesPanel
          slide={currentSlide}
          selectedElement={selectedElement}
          pluginInfo={(() => {
            if (!selectedElement?.pluginId || !selectedElement.pluginVersion) return null
            const listed = pluginCatalog.find(p => p.pluginId === selectedElement.pluginId)
            const update = pluginUpdatesAll.find(u => u.pluginId === selectedElement.pluginId && u.from.includes(selectedElement.pluginVersion))
            return { name: listed?.name || registry.getPlugin(selectedElement.pluginId)?.manifest?.name || 'Plugin', slug: listed?.slug || null, version: selectedElement.pluginVersion, update: update || null }
          })()}
          onUpdatePlugin={updatePlugin}
          recordingState={recording?.elementId === selectedElementId ? recording.stateId : null}
          onRecordState={stateId => setRecording(stateId && selectedElementId ? { elementId: selectedElementId, stateId } : null)}
          onUpdateSlide={updateCurrentSlide}
          onUpdateElement={(updates) => selectedElementId && updateElement(selectedElementId, updates)}
          onUpdateWithGroup={updates => selectedElementId && updateWithGroup(selectedElementId, updates)}
          onSelectElement={id => setSelectedElementIds([id])}
          onDeleteElement={() => selectedElementId && deleteElement(selectedElementId)}
          onBringForward={() => selectedElementId && bringElementForward(selectedElementId)}
          onSendBackward={() => selectedElementId && sendElementBackward(selectedElementId)}
          onEditHtml={mode => selectedElementId && openHtmlEditor(selectedElementId, mode)}
          onEditP5={() => selectedElementId && openP5Editor(selectedElementId)}
          onEditCode={() => selectedElementId && openCodeEditor(selectedElementId)}
          onEditLatex={() => selectedElementId && openLatexEditor(selectedElementId)}
          onEditTikz={() => selectedElementId && openTikzEditor(selectedElementId)}
          onEditGraph={() => selectedElementId && openGraphEditor(selectedElementId)}
          onEditEquation={() => selectedElementId && openEquationEditor(selectedElementId)}
          onEditFeynman={() => selectedElementId && openFeynmanEditor(selectedElementId)}
          onEditCircuit={() => selectedElementId && openCircuitEditor(selectedElementId)}
          onEditLogic={() => selectedElementId && openLogicEditor(selectedElementId)}
          onEditFreebody={() => selectedElementId && openFreebodyEditor(selectedElementId)}
          onEditVenn={() => selectedElementId && openVennEditor(selectedElementId)}
          onEditTiming={() => selectedElementId && openTimingEditor(selectedElementId)}
          onEditGeometry={() => selectedElementId && openGeometryEditor(selectedElementId)}
          onEditMolecule={() => selectedElementId && openMoleculePicker(selectedElementId)}
          onCiteElement={citeElement}
          presentation={presentation}
          onUpdatePresentation={(updates) => setPresentation(prev => ({ ...prev, ...updates }))}
          selectedElementIds={selectedElementIds}
          onDeleteSelectedElements={deleteSelectedElements}
          isTemplate={isTemplate}
          activeMathNode={activeMathNode}
          onUpdateMathNode={updateMathNode}
          onCloseMathNode={() => { setActiveMathNode(null); mathNodeUpdateRef.current = null }}
          onPreviewSlide={() => previewSlideInWindow(presentation, currentSlideIndex)}
          currentSlideIndex={currentSlideIndex}
          tab={inspectorTab}
          onTabChange={setInspectorTab}
          theme={presentation.theme || 'black'}
          themeColors={presentation.themeColors || null}
        />}

      {/* HTML / D3 embed: its code, and its content block as a form */}
      {htmlEditorState && (
        <HtmlEmbedModal
          content={htmlEditorState.content}
          width={htmlEditorState.width}
          height={htmlEditorState.height}
          initialMode={htmlEditorState.mode}
          background={slidePalette(currentSlide, presentation.theme, presentation.themeColors).background}
          onApply={commitHtmlEdit}
          onCancel={() => setHtmlEditorState(null)}
        />
      )}

      {/* p5.js Sketch Editor Modal */}
      {p5EditorState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'Escape') setP5EditorState(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '90vw', maxWidth: 1200, height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>p5.js Sketch</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Write <code style={{ background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>setup()</code> and <code style={{ background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>draw()</code> — canvas auto-sizes to element
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setP5EditorState(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={commitP5Edit}>Apply</button>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <textarea
                value={p5EditorState.content}
                onChange={e => setP5EditorState(s => ({ ...s, content: e.target.value }))}
                style={{ flex: 1, background: '#0d0d1a', color: '#e2e8f0', fontFamily: "'Fira Code', 'JetBrains Mono', monospace", fontSize: 13, padding: '16px 20px', border: 'none', outline: 'none', resize: 'none', lineHeight: 1.6, tabSize: 2, borderRight: '1px solid var(--border)' }}
                spellCheck={false}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Tab') {
                    e.preventDefault()
                    const { selectionStart: s, selectionEnd: end, value } = e.target
                    const next = value.substring(0, s) + '  ' + value.substring(end)
                    e.target.value = next
                    setP5EditorState(st => ({ ...st, content: next }))
                    requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2 })
                  }
                }}
              />
              <div style={{ flex: 1, background: '#0a0a14', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>Preview</div>
                <iframe
                  key={p5EditorState.content}
                  srcDoc={localizeLibraries(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#111;overflow:hidden;}canvas{display:block;}</style><script src="${libUrl('p5', 'lib/p5.min.js')}"><\/script>${EMBED_DATASETS_SCRIPT}</head><body><script>${p5EditorState.content}<\/script></body></html>`)}
                  style={{ flex: 1, border: 'none', display: 'block' }}
                  sandbox="allow-scripts"
                  title="p5.js preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Editor Modal */}
      {codeEditorState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'Escape') setCodeEditorState(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '78vw', maxWidth: 960, height: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Code Block</span>
              <select
                value={codeEditorState.language}
                onChange={e => setCodeEditorState(s => ({ ...s, language: e.target.value }))}
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: '#e0e0e0', padding: '4px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
              >
                {[
                  { id: 'plaintext', label: 'Plain Text' },
                  { id: 'javascript', label: 'JavaScript' }, { id: 'typescript', label: 'TypeScript' },
                  { id: 'python', label: 'Python' }, { id: 'java', label: 'Java' },
                  { id: 'c', label: 'C' }, { id: 'cpp', label: 'C++' }, { id: 'csharp', label: 'C#' },
                  { id: 'go', label: 'Go' }, { id: 'rust', label: 'Rust' }, { id: 'php', label: 'PHP' },
                  { id: 'ruby', label: 'Ruby' }, { id: 'swift', label: 'Swift' }, { id: 'kotlin', label: 'Kotlin' },
                  { id: 'r', label: 'R' }, { id: 'scala', label: 'Scala' },
                  { id: 'html', label: 'HTML' }, { id: 'css', label: 'CSS' }, { id: 'json', label: 'JSON' },
                  { id: 'yaml', label: 'YAML' }, { id: 'bash', label: 'Bash/Shell' }, { id: 'sql', label: 'SQL' },
                  { id: 'markdown', label: 'Markdown' }, { id: 'latex', label: 'LaTeX' },
                ].map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <select
                value={presentation.codeTheme || 'monokai'}
                onChange={e => setPresentation(prev => ({ ...prev, codeTheme: e.target.value }))}
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: '#e0e0e0', padding: '4px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                title="Code highlight theme"
              >
                <optgroup label="Dark">
                  <option value="monokai">Monokai</option>
                  <option value="github-dark">GitHub Dark</option>
                  <option value="atom-one-dark">Atom One Dark</option>
                  <option value="tokyo-night-dark">Tokyo Night</option>
                  <option value="vs2015">VS Code Dark</option>
                  <option value="night-owl">Night Owl</option>
                  <option value="an-old-hope">An Old Hope</option>
                </optgroup>
                <optgroup label="Light">
                  <option value="atom-one-light">Atom One Light</option>
                  <option value="github">GitHub Light</option>
                  <option value="vs">Visual Studio</option>
                </optgroup>
              </select>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setCodeEditorState(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={commitCodeEdit}>Apply</button>
              </div>
            </div>
            <textarea
              value={codeEditorState.content}
              onChange={e => setCodeEditorState(s => ({ ...s, content: e.target.value }))}
              style={{ flex: 1, background: '#0d0d1a', color: '#e2e8f0', fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 13, padding: '16px 20px', border: 'none', outline: 'none', resize: 'none', borderRadius: '0 0 12px 12px', lineHeight: 1.6, tabSize: 2 }}
              spellCheck={false}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const { selectionStart: s, selectionEnd: end, value } = e.target
                  const next = value.substring(0, s) + '  ' + value.substring(end)
                  e.target.value = next
                  setCodeEditorState(st => ({ ...st, content: next }))
                  requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2 })
                }
              }}
            />
          </div>
        </div>
      )}
      {/* LaTeX / TikZ Editor Modal */}
      {latexEditorState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'Escape') setLatexEditorState(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '78vw', maxWidth: 960, height: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>LaTeX / TikZ</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supports KaTeX math, LaTeX tables (LaTeX.js), and TikZ diagrams (TikZJax)</span>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setLatexEditorState(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={commitLatexEdit}>Apply</button>
              </div>
            </div>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
                <textarea
                  id="latex-editor-textarea"
                  value={latexEditorState.content}
                  onChange={e => setLatexEditorState(s => ({ ...s, content: e.target.value }))}
                  style={{ flex: 1, background: '#0d0d1a', color: '#e2e8f0', fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 13, padding: '16px 20px', border: 'none', outline: 'none', resize: 'none', lineHeight: 1.6, tabSize: 2 }}
                  spellCheck={false}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const { selectionStart: s, selectionEnd: end, value } = e.target
                      const next = value.substring(0, s) + '  ' + value.substring(end)
                      e.target.value = next
                      setLatexEditorState(st => ({ ...st, content: next }))
                      requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2 })
                    }
                  }}
                />
                <EquationPalette onInsert={(latex) => {
                  const ta = document.getElementById('latex-editor-textarea')
                  if (!ta) return
                  const { selectionStart: s, selectionEnd: end, value } = ta
                  const next = value.substring(0, s) + latex + value.substring(end)
                  setLatexEditorState(st => ({ ...st, content: next }))
                  requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + latex.length })
                }} />
              </div>
              <div style={{ flex: 1, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16 }}>
                <iframe
                  key={latexEditorState.content}
                  srcDoc={generateLatexIframeHtml(latexEditorState.content || '')}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
                  sandbox="allow-scripts"
                  title="LaTeX Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Find & Replace */}
      {showFindReplace && (
        <FindReplaceBar
          presentation={presentation}
          onUpdatePresentation={(updates) => setPresentation(prev => ({ ...prev, ...updates }))}
          currentSlideIndex={currentSlideIndex}
          onNavigateToSlide={setCurrentSlideIndex}
          onClose={() => setShowFindReplace(false)}
        />
      )}

      {/* Animation Timeline */}
      {showTimeline && (
        <AnimationTimeline
          slide={currentSlide}
          onUpdateElement={(id, updates) => updateElement(id, updates)}
          onClose={() => setShowTimeline(false)}
          onPreview={() => presentInWindow(presentation)}
        />
      )}

      {/* Transition Preview */}
      {showTransitionPreview && (
        <TransitionPreview
          presentation={presentation}
          fromIndex={currentSlideIndex}
          onClose={() => setShowTransitionPreview(false)}
          slideW={slideW}
          slideH={slideH}
        />
      )}

      {showKineticModal && (
        <KineticTextModal
          onInsert={insertKineticText}
          onClose={() => setShowKineticModal(false)}
          slideW={slideW}
          slideH={slideH}
        />
      )}

      {showMathGridModal && (
        <MathGridModal
          onInsert={(html) => {
            const newEl = { id: crypto.randomUUID(), type: 'html', x: 40, y: 40, width: slideW - 80, height: slideH - 80, zIndex: 2, content: html }
            setPresentation(prev => {
              if (!prev) return prev
              return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndex ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
            })
            setSelectedElementIds([newEl.id])
            setShowMathGridModal(false)
          }}
          onClose={() => setShowMathGridModal(false)}
        />
      )}

      {showAnimeModal && (
        <AnimeModal
          onInsert={(html) => {
            const newEl = { id: crypto.randomUUID(), type: 'html', x: 0, y: 0, width: slideW, height: slideH, zIndex: 2, content: html }
            setPresentation(prev => {
              if (!prev) return prev
              return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndex ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
            })
            setSelectedElementIds([newEl.id])
            setShowAnimeModal(false)
          }}
          onClose={() => setShowAnimeModal(false)}
          slideW={slideW}
          slideH={slideH}
        />
      )}

      {showThreeModal && (
        <ThreeModal
          onInsert={(html) => {
            const newEl = { id: crypto.randomUUID(), type: 'html', x: 0, y: 0, width: slideW, height: slideH, zIndex: 2, content: html }
            setPresentation(prev => {
              if (!prev) return prev
              return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndex ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
            })
            setSelectedElementIds([newEl.id])
            setShowThreeModal(false)
          }}
          onClose={() => setShowThreeModal(false)}
          slideW={slideW}
          slideH={slideH}
        />
      )}

      {/* Bibliography Modal */}
      {showBibliographyModal && (
        <BibliographyModal
          bibliography={presentation.bibliography || []}
          citationStyle={presentation.citationStyle || 'numbered'}
          citationOrder={presentation.citationOrder || 'presentation'}
          citationIndex={citationIndex}
          markerCounts={citationMarkerCounts}
          // A style, order or library change moves the index under the markers
          // already in the slides, so their stored labels move with it
          onUpdate={updates => setPresentation(prev => applyCitationNumbering({ ...prev, ...updates }))}
          onRenumber={opts => setPresentation(prev => applyCitationNumbering(prev, opts))}
          onInsertCitation={entry => {
            if (!editor || !editingElementId) return
            editor.chain().focus().insertContent({ type: 'citation', attrs: { cite: entry.key, label: nextCitationLabel(presentation, entry) } }).run()
          }}
          onClose={() => setShowBibliographyModal(false)}
        />
      )}

      {/* Diagram Modal */}
      {showDiagramModal && (
        <DiagramModal
          slideW={slideW}
          slideH={slideH}
          onInsert={(svg) => {
            const newEl = { id: crypto.randomUUID(), type: 'html', x: 80, y: 80, width: 600, height: 380, zIndex: 2, content: svg }
            setPresentation(prev => {
              if (!prev) return prev
              return { ...prev, slides: prev.slides.map((s, i) => i === currentSlideIndex ? { ...s, elements: [...(s.elements || []), newEl] } : s) }
            })
            setSelectedElementIds([newEl.id])
            setShowDiagramModal(false)
          }}
          onClose={() => setShowDiagramModal(false)}
        />
      )}

      {graphEditor && (
        <GraphEditorModal
          initial={graphEditor.graph}
          size={graphEditor.size}
          slideBg={graphEditor.slideBg}
          isNew={!graphEditor.elementId}
          onSave={saveGraph}
          onClose={() => setGraphEditor(null)}
        />
      )}

      {equationEditor && (
        <EquationEditorModal
          initial={equationEditor.equation}
          size={equationEditor.size}
          slideBg={equationEditor.slideBg}
          dark={equationEditor.dark}
          isNew={!equationEditor.elementId}
          onSave={saveEquation}
          onClose={() => setEquationEditor(null)}
        />
      )}

      {feynmanEditor && (
        <FeynmanEditorModal
          initial={feynmanEditor.diagram}
          slideBg={feynmanEditor.slideBg}
          isNew={!feynmanEditor.elementId}
          onSave={saveFeynman}
          onClose={() => setFeynmanEditor(null)}
        />
      )}

      {circuitEditor && (
        <CircuitEditorModal
          initial={circuitEditor.circuit}
          slideBg={circuitEditor.slideBg}
          isNew={!circuitEditor.elementId}
          onSave={saveCircuit}
          onClose={() => setCircuitEditor(null)}
        />
      )}

      {freebodyEditor && (
        <FreebodyEditorModal
          initial={freebodyEditor.diagram}
          slideBg={freebodyEditor.slideBg}
          isNew={!freebodyEditor.elementId}
          onSave={saveFreebody}
          onClose={() => setFreebodyEditor(null)}
        />
      )}

      {timingEditor && (
        <TimingEditorModal
          initial={timingEditor.diagram}
          slideBg={timingEditor.slideBg}
          isNew={!timingEditor.elementId}
          onSave={saveTiming}
          onClose={() => setTimingEditor(null)}
        />
      )}

      {geometryEditor && (
        <GeometryEditorModal
          initial={geometryEditor.diagram}
          size={geometryEditor.size}
          slideBg={geometryEditor.slideBg}
          isNew={!geometryEditor.elementId}
          onSave={saveGeometry}
          onClose={() => setGeometryEditor(null)}
        />
      )}

      {vennEditor && (
        <VennEditorModal
          initial={vennEditor.diagram}
          slideBg={vennEditor.slideBg}
          isNew={!vennEditor.elementId}
          onSave={saveVenn}
          onClose={() => setVennEditor(null)}
        />
      )}

      {logicEditor && (
        <LogicEditorModal
          initial={logicEditor.logic}
          slideBg={logicEditor.slideBg}
          isNew={!logicEditor.elementId}
          onSave={saveLogic}
          onClose={() => setLogicEditor(null)}
        />
      )}

      {moleculePicker && (
        <MoleculeModal
          isNew={!moleculePicker.elementId}
          onPick={pickMolecule}
          onClose={() => setMoleculePicker(null)}
        />
      )}

      {tikzEditor && (
        <TikzEditorModal
          initialState={tikzEditor.state}
          dark={tikzEditor.dark}
          onSave={saveTikzDiagram}
          onClose={() => setTikzEditor(null)}
        />
      )}

      {/* Share Modal */}
      {saveProblem && (
        <div role="alert" style={{ position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 9000, maxWidth: 'min(640px, calc(100vw - 32px))', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 8, background: '#3b2a12', border: '1px solid #b45309', color: '#fde68a', fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {saveProblem.kind === 'conflict' ? (
            <>
              <span style={{ flex: '1 1 260px' }}>Someone else saved this presentation after you opened it, so your latest changes aren't saved.</span>
              <button className="btn btn-secondary" onClick={loadSavedVersion}>Load their version</button>
              <button className="btn btn-secondary" onClick={saveOverVersion} title="Your copy replaces what they saved">Keep mine</button>
            </>
          ) : (
            <>
              <span style={{ flex: '1 1 260px' }}>This presentation was deleted, or you were removed as an editor. Your changes aren't saved.</span>
              <button className="btn btn-secondary" onClick={onGoHome}>Back to presentations</button>
            </>
          )}
        </div>
      )}

      {notice && (
        <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000, maxWidth: 'min(520px, calc(100vw - 32px))', padding: '8px 14px', borderRadius: 8, background: 'rgba(20,20,35,0.95)', border: '1px solid var(--border)', color: '#e0e0e0', fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {notice}
        </div>
      )}

      {showPluginBrowser && (
        <PluginBrowser
          onClose={() => setShowPluginBrowser(false)}
          onInstalled={() => startPlugins().then(() => setPluginsChanged(n => n + 1))}
          onUninstalled={p => { unloadPlugin(p.pluginId); setPluginsChanged(n => n + 1) }}
        />
      )}

      {showAiLinks && <AiLinkModal presentationId={presentationId} onClose={() => setShowAiLinks(false)} />}
      {showEditorsModal && access && (
        <EditorsModal
          presentationId={presentationId}
          access={access}
          onChange={setAccess}
          onClose={() => setShowEditorsModal(false)}
          onLeft={() => { setShowEditorsModal(false); onGoHome() }}
        />
      )}

      {showShareModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowShareModal(false) }}>
          <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Share Presentation</h3>
              <button className="btn btn-ghost" onClick={() => setShowShareModal(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {shareStatus.shared ? (
                <>
                  <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.1)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 6 }}>Sharing enabled</div>
                    <input
                      readOnly
                      value={`${window.location.origin}/share/${shareStatus.token}`}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
                      onClick={e => {
                        e.target.select()
                        navigator.clipboard.writeText(e.target.value).catch(() => {})
                      }}
                    />
                    <div style={{ fontSize: 11, color: '#a0a0b0', marginTop: 4 }}>Click to copy link</div>
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={async () => {
                      await api.disableShare(presentationId)
                      setShareStatus({ shared: false, token: null })
                    }}
                  >
                    Disable Sharing
                  </button>
                  <div style={{ fontSize: 11, color: '#a0a0b0', marginTop: 6 }}>The link stops working for good; sharing again makes a new one.</div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: '#a0a0b0' }}>
                    Generate a public link to view this presentation without the editor.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={async () => {
                      const result = await api.enableShare(presentationId)
                      setShareStatus(result)
                    }}
                  >
                    <Share2 size={14} />
                    Enable Sharing
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showShortcuts && <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />}
      {showMenuSearch && <MenuSearch menus={menus} onClose={() => setShowMenuSearch(false)} />}
      {plotImport && (
        <PlotImportModal file={plotImport.file} source={plotImport.source} figure={plotImport.figure} presentationId={presentationId} dark={slideIsDark()}
          onInsert={insertImportedPlot} onInsertElements={insertKeptFigure} onClose={() => setPlotImport(null)} />
      )}
      {pdfPages && (
        <PdfPagesModal pages={pdfPages} onClose={() => setPdfPages(null)}
          onInsert={async files => {
            for (const file of files) {
              try { const result = await api.uploadFile(file); if (result.url) addImageElement(result.url) }
              catch (err) { showNotice(`A page couldn’t be uploaded: ${err.message}`); return }
            }
          }} />
      )}

      {(showTemplateModal || layoutChangeIndex !== null) && (
        <LayoutPicker
          layouts={SLIDE_TEMPLATES}
          theme={presentation.theme || 'black'}
          themeColors={presentation.themeColors || null}
          slideW={slideW}
          slideH={slideH}
          title={layoutChangeIndex !== null ? 'Change layout' : 'New slide'}
          current={layoutChangeIndex !== null ? presentation.slides[layoutChangeIndex]?.layout ?? null : null}
          onPick={key => {
            if (layoutChangeIndex !== null) changeSlideLayout(layoutChangeIndex, key)
            else addSlide(key, pendingAddColumn)
            setPendingAddColumn(null); setShowTemplateModal(false); setLayoutChangeIndex(null)
          }}
          onClose={() => { setShowTemplateModal(false); setPendingAddColumn(null); setLayoutChangeIndex(null) }}
        />
      )}
      {showPracticeRuns && (
        <PracticeRunsModal
          runs={presentation.practiceRuns || []}
          onPractice={() => { setShowPracticeRuns(false); startPractice() }}
          onUsePlan={run => { stopCapturing(); setPresentation(prev => minutesFromRun(prev, run)); stopCapturing(); showNotice('Planned minutes set from this run; see them in the outline') }}
          onDelete={id => setPresentation(prev => removePracticeRun(prev, id))}
          onClose={() => setShowPracticeRuns(false)}
        />
      )}

      {showSessions && (
        <AnnotationSessionsModal
          sets={recentAnnotationSets(presentation, Infinity)}
          onView={set => presentInWindow(inkedPresentation(presentation, set))}
          onContinue={set => { setShowSessions(false); presentAnnotated(set) }}
          onExportPdf={set => exportPDF(inkedPresentation(presentation, set))}
          onExportHtml={set => downloadOfflineHTML(inkedPresentation(presentation, set))}
          onRename={(id, name) => setPresentation(p => renameAnnotationSet(p, id, name))}
          onDelete={id => setPresentation(p => deleteAnnotationSet(p, id))}
          onClose={() => setShowSessions(false)}
        />
      )}

      {showImportSlideModal && (
        <ImportSlideModal
          currentPresentationId={presentationId}
          onImport={importSlidesFromPresentation}
          onBeamer={() => { setShowImportSlideModal(false); setShowBeamerModal(true) }}
          onClose={() => setShowImportSlideModal(false)}
        />
      )}
      {showBeamerModal && (
        <BeamerImportModal
          mode="insert"
          slideW={presentation.slideWidth || 960}
          slideH={presentation.slideHeight || 540}
          bibliography={presentation.bibliography || []}
          globalFont={deckTextFont(presentation.globalFont, presentation.theme)}
          dark={slidePalette(currentSlide, presentation.theme, presentation.themeColors).dark}
          onInsert={insertBeamerSlides}
          onClose={() => setShowBeamerModal(false)}
        />
      )}
      {/* Park the TipTap editor DOM off-screen when not editing so ProseMirror's
          contenteditable node doesn't float at (0,0) inside the slide canvas. */}
      {!editingElementId && (
        <div style={{ position: 'fixed', left: -9999, top: -9999, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0 }}>
          <EditorContent editor={editor} />
        </div>
      )}
      </div>
    </div>
  )
}
