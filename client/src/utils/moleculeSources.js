// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Structures for the molecule element, fetched in the editor from PubChem
// (small molecules, by name or CID) and the RCSB Protein Data Bank (by PDB
// ID). Both answer any origin. What they return is uploaded with the deck,
// so a presented molecule never needs them.

import { moleculeFormat } from './moleculeViewer'

const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound'
const RCSB = 'https://files.rcsb.org/download'

// Larger files take too long to draw on a slide (the ribosome, 4V6X, is 29 MB)
export const MAX_STRUCTURE_BYTES = 50 * 1024 * 1024

export const PUBCHEM_EXAMPLES = ['Caffeine', 'Aspirin', 'Glucose', 'Benzene', 'Cholesterol', 'Penicillin G']
export const PDB_EXAMPLES = [
  ['1UBQ', 'Ubiquitin'],
  ['4HHB', 'Hemoglobin'],
  ['1BNA', 'B-DNA'],
  ['1GFL', 'Green fluorescent protein'],
  ['6VXX', 'SARS-CoV-2 spike'],
]

// A PDB ID: four characters, a digit then letters or digits (1UBQ, 6vxx)
export function isPdbId(text) {
  return /^[0-9][a-z0-9]{3}$/i.test(String(text || '').trim())
}

class SourceError extends Error {}

async function get(fetchImpl, url, what) {
  let res
  try {
    res = await fetchImpl(url)
  } catch {
    throw new SourceError(`Couldn’t reach ${what}. Check your connection and try again.`)
  }
  return res
}

async function text(res) {
  const body = await res.text()
  if (body.length > MAX_STRUCTURE_BYTES) {
    throw new SourceError(`This structure is ${Math.round(body.length / 1048576)} MB, too large to draw on a slide (the limit is ${MAX_STRUCTURE_BYTES / 1048576} MB).`)
  }
  return body
}

// A compound from PubChem by name or CID, as an SDF of its 3D conformer:
// { text, format, fileName, name, formula, source: { db: 'pubchem', id } }
export async function fetchPubChem(query, fetchImpl = fetch) {
  const q = String(query || '').trim()
  if (!q) throw new SourceError('Type a compound’s name or PubChem CID.')
  const by = /^\d+$/.test(q) ? `cid/${q}` : `name/${encodeURIComponent(q)}`
  const res = await get(fetchImpl, `${PUBCHEM}/${by}/property/Title,MolecularFormula/JSON`, 'PubChem')
  if (res.status === 404) throw new SourceError(`PubChem has no compound called “${q}”.`)
  if (!res.ok) throw new SourceError(`PubChem couldn’t look that up (${res.status}). Try again in a moment.`)
  const props = (await res.json())?.PropertyTable?.Properties?.[0]
  if (!props?.CID) throw new SourceError(`PubChem has no compound called “${q}”.`)
  const cid = String(props.CID)
  const name = props.Title || q
  const sdf = await get(fetchImpl, `${PUBCHEM}/cid/${cid}/SDF?record_type=3d`, 'PubChem')
  if (sdf.status === 404) {
    throw new SourceError(`PubChem has no 3D structure for ${name} (CID ${cid}); salts, mixtures and large molecules often have none. You can upload a structure file instead.`)
  }
  if (!sdf.ok) throw new SourceError(`PubChem couldn’t send the structure (${sdf.status}). Try again in a moment.`)
  return {
    text: await text(sdf), format: 'sdf', fileName: `${fileStem(name) || `cid-${cid}`}.sdf`,
    name, formula: props.MolecularFormula || '', source: { db: 'pubchem', id: cid },
  }
}

// An entry from the RCSB PDB by ID: PDB format, or mmCIF for the large
// entries that have no PDB file. Its title is read from the file
export async function fetchPdb(query, fetchImpl = fetch) {
  const id = String(query || '').trim().toUpperCase()
  if (!isPdbId(id)) throw new SourceError('A PDB ID is four characters, starting with a digit, like 1UBQ.')
  for (const format of ['pdb', 'cif']) {
    const res = await get(fetchImpl, `${RCSB}/${id}.${format}`, 'the Protein Data Bank')
    if (res.status === 404) continue
    if (!res.ok) throw new SourceError(`The Protein Data Bank couldn’t send ${id} (${res.status}). Try again in a moment.`)
    const body = await text(res)
    return {
      text: body, format, fileName: `${id}.${format}`,
      name: structureTitle(body, format) || id, source: { db: 'pdb', id },
    }
  }
  throw new SourceError(`The Protein Data Bank has no entry ${id}.`)
}

// A file the user chose: { text, format, fileName, name }
export async function readStructureFile(file) {
  const format = moleculeFormat(file?.name)
  if (!format) throw new SourceError('Structure files can be PDB, mmCIF, SDF, MOL, MOL2, XYZ, PQR or GRO.')
  if (file.size > MAX_STRUCTURE_BYTES) {
    throw new SourceError(`This file is ${Math.round(file.size / 1048576)} MB, too large to draw on a slide (the limit is ${MAX_STRUCTURE_BYTES / 1048576} MB).`)
  }
  const body = await file.text()
  return { text: body, format, fileName: file.name, name: structureTitle(body, format) || file.name.replace(/\.[^.]+$/, '') }
}

// A readable title from the file itself: a PDB's TITLE lines, an mmCIF's
// _struct.title, or the first line of an SDF or MOL2 record. Titles in
// PDB files are upper case, so those come back in sentence case.
export function structureTitle(body, format) {
  const lines = String(body || '').split(/\r?\n/, 4000)
  let title = ''
  if (format === 'pdb' || format === 'pqr') {
    title = lines.filter(l => l.startsWith('TITLE ')).map(l => l.slice(10).trim()).join(' ')
    if (title === title.toUpperCase()) title = title.charAt(0) + title.slice(1).toLowerCase()
  } else if (format === 'cif') {
    const at = lines.findIndex(l => l.startsWith('_struct.title'))
    if (at >= 0) {
      const rest = lines[at].slice('_struct.title'.length).trim()
      title = rest || (lines[at + 1] || '').trim()
      if (title.startsWith(';')) title = title.slice(1).trim() || (lines[at + 2] || '').trim()
      title = title.replace(/^['"]|['"]$/g, '')
    }
  } else if (format === 'sdf') {
    title = (lines[0] || '').trim()
  } else if (format === 'mol2') {
    const at = lines.findIndex(l => l.trim() === '@<TRIPOS>MOLECULE')
    if (at >= 0) title = (lines[at + 1] || '').trim()
  }
  title = title.replace(/\s+/g, ' ').trim()
  // A bare number is PubChem's CID, not a name
  return /^\d*$/.test(title) ? '' : title.slice(0, 120)
}

function fileStem(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

// Where a molecule came from, for the properties panel
export function sourceLabel(source) {
  if (source?.db === 'pubchem') return `PubChem CID ${source.id}`
  if (source?.db === 'pdb') return `PDB ${source.id}`
  return ''
}

export function sourceUrl(source) {
  if (source?.db === 'pubchem') return `https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(source.id)}`
  if (source?.db === 'pdb') return `https://www.rcsb.org/structure/${encodeURIComponent(source.id)}`
  return ''
}
