import { describe, it, expect } from 'vitest'

// Stub browser APIs that generateHTML uses (only window.location.origin for absoluteSrc)
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { moleculeViewerHtml, moleculeFormat, moleculeSnapshotContent, MOLECULE_DEFAULTS } from './moleculeViewer'
import { generateRevealHTML } from './generateHTML'
import { localizeLibraries } from './libraries'

const molecule = { id: 'mol1', type: 'molecule', x: 0, y: 0, width: 420, height: 360, zIndex: 2, src: '/uploads/p1/caffeine.sdf', format: 'sdf', name: 'Caffeine', ...MOLECULE_DEFAULTS }
const deck = elements => ({ title: 'Talk', slideWidth: 960, slideHeight: 540, slides: [{ id: 's1', elements }] })

// The options the page was written with
function options(html) {
  return JSON.parse(html.match(/var O = (.*);/)[1])
}

// Its script, as a function body: throws when the page wouldn't parse
function compileScript(html) {
  const script = html.match(/<script>([\s\S]*?)<\/script><\/body>/)[1]
  return new Function(script)
}

function presentedSrcdoc(html) {
  return html.match(/<iframe srcdoc="([^"]*)"[^>]*title="Caffeine"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
}

describe('molecule viewer', () => {
  it('reads structure files by their extension', () => {
    expect(moleculeFormat('1UBQ.pdb')).toBe('pdb')
    expect(moleculeFormat('4V6X.CIF')).toBe('cif')
    expect(moleculeFormat('aspirin.mol')).toBe('sdf')
    expect(moleculeFormat('ligand.mol2')).toBe('mol2')
    expect(moleculeFormat('water.xyz')).toBe('xyz')
    expect(moleculeFormat('model.stl')).toBe(null)
    expect(moleculeFormat('pdb')).toBe(null)
    expect(moleculeFormat('')).toBe(null)
  })

  it('writes a page whose script parses', () => {
    expect(() => compileScript(moleculeViewerHtml(molecule))).not.toThrow()
    expect(() => compileScript(moleculeViewerHtml({ ...molecule, surface: true, spin: true, view: [1, 2, 3, 4, 0, 0, 0, 1] }, { snapshotKey: 'k', viewKey: 'mol1' }))).not.toThrow()
  })

  it('writes the element’s settings into the page, with defaults', () => {
    expect(options(moleculeViewerHtml({ id: 'm', src: '/uploads/p1/1UBQ.pdb' }))).toEqual({
      src: '/uploads/p1/1UBQ.pdb', format: 'pdb', style: 'auto', color: 'auto', hydrogens: true, surface: false,
      background: 'transparent', spin: false, view: null, snapshotKey: null, viewKey: null, print: false,
    })
    const o = options(moleculeViewerHtml({ ...molecule, style: 'sphere', color: 'chain', hydrogens: false, surface: true, background: '#000000', spin: true, view: [0, 0, 0, -50, 0, 0.7, 0, 0.7] },
      { src: 'http://localhost:3000/uploads/p1/caffeine.sdf', snapshotKey: 'mol1:abc', viewKey: 'mol1' }))
    expect(o).toMatchObject({ src: 'http://localhost:3000/uploads/p1/caffeine.sdf', format: 'sdf', style: 'sphere', color: 'chain', hydrogens: false, surface: true, background: '#000000', spin: true, view: [0, 0, 0, -50, 0, 0.7, 0, 0.7], snapshotKey: 'mol1:abc', viewKey: 'mol1' })
  })

  it('ignores settings it doesn’t know', () => {
    const o = options(moleculeViewerHtml({ ...molecule, style: 'ribbon', color: 'plaid', format: 'exe', view: [1, 2, 'x'] }))
    expect(o).toMatchObject({ style: 'auto', color: 'auto', format: 'sdf', view: null })
    expect(options(moleculeViewerHtml({ ...molecule, view: [0, 0, 0, NaN, 0, 0, 0, 1] })).view).toBe(null)
  })

  it('holds still in print', () => {
    expect(options(moleculeViewerHtml({ ...molecule, spin: true }, { print: true })).spin).toBe(false)
  })

  it('keeps a file name from ending its script', () => {
    const html = moleculeViewerHtml({ ...molecule, src: '/uploads/p1/</script><script>alert(1)</script>.sdf' })
    expect(html).not.toContain('</script><script>alert(1)')
    expect(options(html).src).toBe('/uploads/p1/</script><script>alert(1)</script>.sdf')
  })

  it('loads only library files there are bundled copies of', () => {
    const html = localizeLibraries(moleculeViewerHtml(molecule), 'http://localhost:3000')
    expect(html).not.toContain('cdn.jsdelivr.net')
    expect(html).toMatch(/\/vendor\/3dmol@[\d.]+\/build\/3Dmol-min\.js/)
  })

  it('draws a new thumbnail after a setting or the view changes', () => {
    expect(moleculeSnapshotContent(molecule)).not.toBe(moleculeSnapshotContent({ ...molecule, style: 'stick' }))
    expect(moleculeSnapshotContent(molecule)).not.toBe(moleculeSnapshotContent({ ...molecule, view: [0, 0, 0, 1, 0, 0, 0, 1] }))
    expect(moleculeSnapshotContent(molecule)).toBe(moleculeSnapshotContent({ ...molecule, x: 50 }))
  })

  it('is presented in an iframe that loads the upload from this site', () => {
    const html = generateRevealHTML(deck([molecule]))
    const o = options(presentedSrcdoc(html))
    expect(o.src).toBe('http://localhost:3000/uploads/p1/caffeine.sdf')
    // No thumbnails or views sent from presented decks
    expect(o.snapshotKey).toBe(null)
    expect(o.viewKey).toBe(null)
    // Told the deck's scale, to draw sharp when it's enlarged
    expect(html).toMatch(/<iframe srcdoc="[^"]*" data-deck-scale [^>]*title="Caffeine"/)
    expect(html).toContain("type: 'scale', scale: s")
  })

  it('names its frame safely', () => {
    const html = generateRevealHTML(deck([{ ...molecule, name: '"><script>alert(1)</script>' }]))
    expect(html).not.toContain('"><script>alert(1)')
    expect(html).toContain('title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
  })

  it('takes no click action, since it takes its own clicks', () => {
    const html = generateRevealHTML(deck([{ ...molecule, clickAction: { type: 'next' } }]))
    expect(html).not.toContain('data-action="next"')
  })
})
