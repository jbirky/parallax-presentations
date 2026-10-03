// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The properties panel's section for a molecule element: where it came from,
// how it's drawn, and the view it starts from. The view is the one it was
// last turned to on the canvas, which the element's page sends here. A
// compound from PubChem can be cited from here too (CitePubChem).

import { useEffect, useState } from 'react'
import { MOLECULE_DEFAULTS, MOLECULE_STYLES, MOLECULE_COLORS } from '../utils/moleculeViewer'
import { sourceLabel, sourceUrl, fetchPubChemCitation, pubchemCaption } from '../utils/moleculeSources'

const label = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }
const sameView = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((n, i) => Math.abs(n - b[i]) < 1e-6)

// The view a molecule on this page's canvas was turned to, from its frame
function useTurnedView(elementId) {
  const [view, setView] = useState(null)
  useEffect(() => {
    setView(null)
    const onMessage = e => {
      const d = e.data
      if (!d || d.source !== 'parallax-embed' || d.type !== 'molecule-view' || d.key !== elementId) return
      // Only from a frame in this page: another window could send views of its own
      if (![...document.querySelectorAll('iframe')].some(f => f.contentWindow === e.source)) return
      if (Array.isArray(d.view) && d.view.length === 8 && d.view.every(n => typeof n === 'number' && Number.isFinite(n))) setView(d.view)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [elementId])
  return view
}

export default function MoleculeProperties({ element, onUpdateElement, onChangeMolecule }) {
  const turned = useTurnedView(element.id)
  const transparent = !element.background || element.background === 'transparent'
  const from = sourceLabel(element.source)
  const link = sourceUrl(element.source)
  const canKeep = turned && !sameView(turned, element.view)

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={label}>Molecule</div>
      <div title={element.name || ''} style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {element.name || (element.src ? element.src.split('/').pop() : 'None')}
      </div>
      {from && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
          {link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{from}</a> : from}
        </div>
      )}
      <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '5px 8px', margin: '6px 0 8px' }}
        onClick={onChangeMolecule}>
        Change Molecule…
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div>
          <div style={label} title="Auto: cartoon for proteins and nucleic acids, ball and stick for the rest">Style</div>
          <select className="prop-input" value={element.style || MOLECULE_DEFAULTS.style} onChange={e => onUpdateElement({ style: e.target.value })} style={{ padding: '4px 6px', width: '100%' }}>
            {MOLECULE_STYLES.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
          </select>
        </div>
        <div>
          <div style={label} title="Auto: rainbow along a cartoon's chain, by element for atoms">Color</div>
          <select className="prop-input" value={element.color || MOLECULE_DEFAULTS.color} onChange={e => onUpdateElement({ color: e.target.value })} style={{ padding: '4px 6px', width: '100%' }}>
            {MOLECULE_COLORS.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8, alignItems: 'end' }}>
        <div>
          <div style={label}>Background</div>
          <input type="color" value={transparent ? '#ffffff' : element.background}
            disabled={transparent}
            onChange={e => onUpdateElement({ background: e.target.value })}
            style={{ width: '100%', height: 28, border: '1px solid var(--border)', borderRadius: 4, padding: 2, background: 'none', cursor: 'pointer', opacity: transparent ? 0.4 : 1 }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', height: 28 }}>
          <input type="checkbox" checked={transparent}
            onChange={e => onUpdateElement({ background: e.target.checked ? 'transparent' : '#ffffff' })}
            style={{ accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Transparent</span>
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          ['hydrogens', 'Show hydrogens', element.hydrogens !== false],
          ['surface', 'Show surface', !!element.surface],
          ['spin', 'Rotate on its own', !!element.spin],
        ].map(([key, text, checked]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={checked}
              onChange={e => onUpdateElement({ [key]: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{text}</span>
          </label>
        ))}
      </div>

      <div style={{ ...label, marginTop: 10 }}>Starting View</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '5px 8px', opacity: canKeep ? 1 : 0.5 }}
          disabled={!canKeep}
          title={canKeep ? 'Start from the view it’s turned to now' : 'Turn it on the canvas first'}
          onClick={() => onUpdateElement({ view: turned })}>
          Keep This View
        </button>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '5px 8px', opacity: element.view ? 1 : 0.5 }}
          disabled={!element.view}
          title="Start framed to fit, as first loaded"
          onClick={() => onUpdateElement({ view: null })}>
          Reset View
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>
        Drag to turn it, scroll to zoom, Ctrl-drag to move it: on the canvas once it's selected, and when presenting.
      </div>
    </div>
  )
}

// Fetches PubChem's citation for a compound's record into the library, and
// credits the compound under the molecule, as PubChem asks of a reused 3D
// structure: "PubChem CID 2519", linked to the record
export function CitePubChem({ cid, onCite }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const cite = async () => {
    setBusy(true)
    setError('')
    try {
      onCite(await fetchPubChemCitation(cid), pubchemCaption(cid))
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <button className="btn btn-secondary" disabled={busy} onClick={cite}
        title={`Add PubChem’s citation for CID ${cid} to the references, and credit it under the molecule`}
        style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '5px 8px' }}>
        {busy ? 'Fetching Citation…' : 'Cite PubChem'}
      </button>
      {error && (
        <div role="alert" style={{ fontSize: 11, color: 'var(--danger, #e5484d)', marginTop: 4, lineHeight: 1.4 }}>{error}</div>
      )}
    </div>
  )
}
