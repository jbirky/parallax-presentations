// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Choosing the structure for a molecule element: a compound from PubChem, an
// entry from the Protein Data Bank, or a file of one's own. The editor
// uploads what's chosen (onPick) and puts it on the slide.

import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { fetchPubChem, fetchPdb, readStructureFile, isPdbId, PUBCHEM_EXAMPLES, PDB_EXAMPLES } from '../utils/moleculeSources'
import { MOLECULE_FORMATS } from '../utils/moleculeViewer'

const TABS = [
  ['pubchem', 'PubChem'],
  ['pdb', 'Protein Data Bank'],
  ['file', 'File'],
]

const chipStyle = { fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer' }

export default function MoleculeModal({ isNew, onPick, onClose }) {
  const [tab, setTab] = useState('pubchem')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const run = async load => {
    setError('')
    setBusy('Fetching…')
    try {
      const structure = await load()
      setBusy(isNew ? 'Adding…' : 'Replacing…')
      await onPick(structure)
    } catch (err) {
      setError(err?.message || String(err))
      setBusy('')
    }
  }

  const search = (q = query) => {
    if (busy) return
    // A PDB ID typed under PubChem is nearly always meant for the PDB
    if (tab === 'pdb' || (tab === 'pubchem' && isPdbId(q) && !/^\d+$/.test(q.trim()))) {
      setTab('pdb')
      run(() => fetchPdb(q))
    } else {
      run(() => fetchPubChem(q))
    }
  }

  const example = q => { setQuery(q); search(q) }

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw' }}
        onKeyDown={e => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>{isNew ? 'Add a molecule' : 'Change the molecule'}</h2>
          <button className="btn btn-ghost" onClick={onClose} disabled={!!busy} style={{ padding: 4 }} aria-label="Close"><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
          A 3D structure you and your audience can turn while you present. It's saved with the presentation, so presenting doesn't need the internet.
        </p>

        <div className="bg-type-tabs" role="tablist" style={{ marginBottom: 12 }}>
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} className={`bg-type-tab ${tab === key ? 'active' : ''}`}
              disabled={!!busy} onClick={() => { setTab(key); setError('') }}>{label}</button>
          ))}
        </div>

        {tab !== 'file' ? (
          <>
            <form onSubmit={e => { e.preventDefault(); search() }} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input className="prop-input" autoFocus value={query} disabled={!!busy}
                onChange={e => setQuery(e.target.value)}
                placeholder={tab === 'pdb' ? 'PDB ID, like 1UBQ' : 'Name or CID, like caffeine or 2519'}
                aria-label={tab === 'pdb' ? 'PDB ID' : 'Compound name or PubChem CID'}
                style={{ flex: 1, fontSize: 13, padding: '6px 8px' }} />
              <button type="submit" className="btn btn-primary" disabled={!!busy || !query.trim()} style={{ fontSize: 12 }}>
                {busy || (isNew ? 'Add' : 'Replace')}
              </button>
            </form>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Try</span>
              {tab === 'pdb'
                ? PDB_EXAMPLES.map(([id, name]) => (
                  <button key={id} style={chipStyle} disabled={!!busy} title={name} onClick={() => example(id)}>{id} · {name}</button>
                ))
                : PUBCHEM_EXAMPLES.map(name => (
                  <button key={name} style={chipStyle} disabled={!!busy} onClick={() => example(name)}>{name}</button>
                ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.45 }}>
              {tab === 'pdb'
                ? 'Proteins, nucleic acids and their complexes from rcsb.org, drawn as cartoons with their ligands.'
                : 'Small molecules from pubchem.ncbi.nlm.nih.gov, in the 3D shape PubChem computed for them.'}
            </p>
          </>
        ) : (
          <>
            <input ref={fileRef} type="file" accept={Object.keys(MOLECULE_FORMATS).join(',')} style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(() => readStructureFile(f)) }} />
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => fileRef.current?.click()}
              style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '8px' }}>
              {busy || '↑ Choose a structure file'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.45 }}>
              PDB, mmCIF, SDF, MOL, MOL2, XYZ, PQR or GRO, up to 50 MB.
            </p>
          </>
        )}

        {error && (
          <p role="alert" style={{ fontSize: 12, color: 'var(--danger, #e5484d)', margin: '12px 0 0', lineHeight: 1.45 }}>{error}</p>
        )}
      </div>
    </div>
  )
}
