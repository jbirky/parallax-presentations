import { describe, it, expect } from 'vitest'
import { fetchPubChem, fetchPdb, readStructureFile, structureTitle, isPdbId, sourceLabel, sourceUrl } from './moleculeSources'

// A fetch that answers from a table of URL → [status, body]
function fakeFetch(table) {
  const asked = []
  const fn = async url => {
    asked.push(url)
    const hit = table[url]
    if (hit instanceof Error) throw hit
    const [status, body] = hit || [404, 'Not found']
    return {
      status, ok: status >= 200 && status < 300,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    }
  }
  fn.asked = asked
  return fn
}

const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound'
const CAFFEINE_SDF = '2519\n  -OEChem-10022621443D\n\n 24 25  0     0  0  0  0  0  0999 V2000\nM  END\n$$$$\n'
const UBQ = 'HEADER    CHROMOSOMAL PROTEIN                     02-JAN-87   1UBQ\nTITLE     STRUCTURE OF UBIQUITIN REFINED AT 1.8 ANGSTROMS RESOLUTION\nATOM      1  N   MET A   1      27.340  24.430   2.614  1.00  9.67           N\n'

describe('molecule sources', () => {
  it('tells PDB IDs apart', () => {
    expect(isPdbId('1UBQ')).toBe(true)
    expect(isPdbId(' 6vxx ')).toBe(true)
    expect(isPdbId('UBQ1')).toBe(false)
    expect(isPdbId('caffeine')).toBe(false)
    expect(isPdbId('12345')).toBe(false)
  })

  it('fetches a compound’s 3D structure from PubChem by name', async () => {
    const fetch = fakeFetch({
      [`${PUG}/name/caffeine/property/Title,MolecularFormula/JSON`]: [200, { PropertyTable: { Properties: [{ CID: 2519, Title: 'Caffeine', MolecularFormula: 'C8H10N4O2' }] } }],
      [`${PUG}/cid/2519/SDF?record_type=3d`]: [200, CAFFEINE_SDF],
    })
    expect(await fetchPubChem(' caffeine ', fetch)).toEqual({
      text: CAFFEINE_SDF, format: 'sdf', fileName: 'caffeine.sdf', name: 'Caffeine', formula: 'C8H10N4O2',
      source: { db: 'pubchem', id: '2519' },
    })
  })

  it('looks a CID up as a CID, and escapes names', async () => {
    const byCid = fakeFetch({})
    await expect(fetchPubChem('2519', byCid)).rejects.toThrow()
    expect(byCid.asked[0]).toBe(`${PUG}/cid/2519/property/Title,MolecularFormula/JSON`)
    const byName = fakeFetch({})
    await expect(fetchPubChem('penicillin G/../x', byName)).rejects.toThrow()
    expect(byName.asked[0]).toBe(`${PUG}/name/penicillin%20G%2F..%2Fx/property/Title,MolecularFormula/JSON`)
  })

  it('says when PubChem has no such compound, or no 3D structure for it', async () => {
    await expect(fetchPubChem('notacompound', fakeFetch({}))).rejects.toThrow('PubChem has no compound called “notacompound”.')
    const salt = fakeFetch({
      [`${PUG}/name/sodium%20chloride/property/Title,MolecularFormula/JSON`]: [200, { PropertyTable: { Properties: [{ CID: 5234, Title: 'Sodium Chloride' }] } }],
    })
    await expect(fetchPubChem('sodium chloride', salt)).rejects.toThrow(/no 3D structure for Sodium Chloride \(CID 5234\)/)
    await expect(fetchPubChem('', fakeFetch({}))).rejects.toThrow('Type a compound’s name or PubChem CID.')
  })

  it('says when PubChem can’t be reached', async () => {
    const offline = fakeFetch({ [`${PUG}/name/caffeine/property/Title,MolecularFormula/JSON`]: new TypeError('Failed to fetch') })
    await expect(fetchPubChem('caffeine', offline)).rejects.toThrow('Couldn’t reach PubChem. Check your connection and try again.')
  })

  it('fetches a PDB entry, titled from its file', async () => {
    const fetch = fakeFetch({ 'https://files.rcsb.org/download/1UBQ.pdb': [200, UBQ] })
    expect(await fetchPdb('1ubq', fetch)).toEqual({
      text: UBQ, format: 'pdb', fileName: '1UBQ.pdb',
      name: 'Structure of ubiquitin refined at 1.8 angstroms resolution', source: { db: 'pdb', id: '1UBQ' },
    })
  })

  it('falls back to mmCIF for entries too large for PDB format', async () => {
    const cif = 'data_4V6X\n#\n_struct.title \'Structure of the human 80S ribosome\'\n'
    const fetch = fakeFetch({ 'https://files.rcsb.org/download/4V6X.cif': [200, cif] })
    const entry = await fetchPdb('4V6X', fetch)
    expect(fetch.asked).toEqual(['https://files.rcsb.org/download/4V6X.pdb', 'https://files.rcsb.org/download/4V6X.cif'])
    expect(entry).toMatchObject({ format: 'cif', fileName: '4V6X.cif', name: 'Structure of the human 80S ribosome' })
  })

  it('says when there’s no such PDB entry, and what an ID looks like', async () => {
    await expect(fetchPdb('9ZZZ', fakeFetch({}))).rejects.toThrow('The Protein Data Bank has no entry 9ZZZ.')
    await expect(fetchPdb('ubiquitin', fakeFetch({}))).rejects.toThrow(/four characters/)
  })

  it('reads a chosen file, and turns away ones it can’t draw', async () => {
    const file = (name, body) => ({ name, size: body.length, text: async () => body })
    expect(await readStructureFile(file('1UBQ.pdb', UBQ))).toMatchObject({ format: 'pdb', fileName: '1UBQ.pdb', name: 'Structure of ubiquitin refined at 1.8 angstroms resolution' })
    expect(await readStructureFile(file('my-ligand.sdf', CAFFEINE_SDF))).toMatchObject({ format: 'sdf', name: 'my-ligand' })
    await expect(readStructureFile(file('part.stl', 'solid'))).rejects.toThrow(/PDB, mmCIF, SDF/)
    await expect(readStructureFile({ name: 'huge.pdb', size: 60 * 1024 * 1024, text: async () => '' })).rejects.toThrow(/too large/)
  })

  it('reads titles from each format', () => {
    expect(structureTitle('TITLE     CRYSTAL STRUCTURE OF\nTITLE    2 HEMOGLOBIN\n', 'pdb')).toBe('Crystal structure of hemoglobin')
    expect(structureTitle('_struct.title\n;Cryo-EM structure\n;\n', 'cif')).toBe('Cryo-EM structure')
    expect(structureTitle('_struct.title "Spike"\n', 'cif')).toBe('Spike')
    expect(structureTitle('Aspirin\n  RDKit 3D\n', 'sdf')).toBe('Aspirin')
    expect(structureTitle('2519\n  -OEChem-\n', 'sdf')).toBe('')
    expect(structureTitle('@<TRIPOS>MOLECULE\nbenzene\n', 'mol2')).toBe('benzene')
    expect(structureTitle('3\nwater\n', 'xyz')).toBe('')
  })

  it('labels and links where a molecule came from', () => {
    expect(sourceLabel({ db: 'pubchem', id: '2519' })).toBe('PubChem CID 2519')
    expect(sourceUrl({ db: 'pdb', id: '1UBQ' })).toBe('https://www.rcsb.org/structure/1UBQ')
    expect(sourceLabel(null)).toBe('')
    expect(sourceUrl(undefined)).toBe('')
  })
})
