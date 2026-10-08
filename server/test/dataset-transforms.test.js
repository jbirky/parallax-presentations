// Transforms: the expressions computed columns and filters use, and each
// step on a small table of planets. Needs nothing.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { compile } = require('../services/dataset-expr')
const { normalizeTransforms, runTransforms, transformTable } = require('../services/dataset-transforms')
const { rowsToTable, tableToRows } = require('../services/dataset-table')

const planets = rowsToTable([
  { pl_name: '51 Peg b', method: 'Radial Velocity', period: 4.23, mass: 146, year: 1995 },
  { pl_name: 'HD 209458 b', method: 'Transit', period: 3.52, mass: 232, year: 1999 },
  { pl_name: 'TRAPPIST-1 e', method: 'Transit', period: 6.1, mass: 0.69, year: 2017 },
  { pl_name: 'HR 8799 b', method: 'Imaging', period: 170000, mass: 2000, year: 2008 },
  { pl_name: 'Kepler-452 b', method: 'Transit', period: 384.8, mass: null, year: 2015 },
])
const run = steps => tableToRows(runTransforms(planets, normalizeTransforms(steps)))
const values = (steps, col) => run(steps).map(r => r[col])

describe('an expression', () => {
  const at = (expr, row = 0) => compile(expr, planets.columns)(row)

  it('does arithmetic, with Graph’s functions and constants', () => {
    assert.equal(at('mass / 317.83'), 146 / 317.83)
    assert.equal(at('2 ^ 3 ^ 2'), 512)
    assert.equal(at('-2 ^ 2'), -4)
    assert.equal(at('log(1000) + ln(e)'), 4)
    assert.equal(at('sqrt(16) * 3 % 5'), 2)
    assert.equal(at('max(period, 10, 2)'), 10)
    assert.equal(at('round(2π)'), 6)
    assert.equal(at('mass²'), 146 * 146)
  })

  it('compares, combines and chooses', () => {
    assert.equal(at('year < 2000 and mass > 100'), true)
    assert.equal(at('year ≥ 2000 or not (mass > 100)'), false)
    assert.equal(at('if(method == "Transit", 1, 0)', 1), 1)
    assert.equal(at('method + ": " + pl_name'), 'Radial Velocity: 51 Peg b')
  })

  it('carries a missing value through, rather than making one up', () => {
    assert.equal(at('mass * 2', 4), null)
    assert.equal(at('mass > 1', 4), false)
    assert.equal(at('isnull(mass)', 4), true)
    assert.equal(at('coalesce(mass, 0)', 4), 0)
    assert.equal(at('1 / 0'), null)
    assert.equal(at('log(-1)'), null)
  })

  it('names columns in backticks when they aren’t plain words', () => {
    const t = rowsToTable([{ 'mass (kg)': 2, e: 5 }])
    assert.equal(compile('`mass (kg)` * 3', t.columns)(0), 6)
    assert.equal(compile('e', t.columns)(0), 5, 'a column called e wins over the constant')
  })

  it('says what’s wrong, and reaches nothing but the row', () => {
    assert.throws(() => compile('masss * 2', planets.columns), /no column "masss"/)
    assert.throws(() => compile('foo(1)', planets.columns), /no function foo/)
    assert.throws(() => compile('mod(1)', planets.columns), /mod\(\) takes 2 values/)
    assert.throws(() => compile('(1 + 2', planets.columns), /Expected "\)"/)
    assert.throws(() => compile('1 +', planets.columns), /ends too soon/)
    assert.throws(() => compile('constructor', planets.columns), /no column "constructor"/)
    assert.throws(() => compile('__proto__', planets.columns), /no column "__proto__"/)
    assert.throws(() => compile('process.exit(1)', planets.columns), /Unexpected "\."/)
    assert.throws(() => compile('x'.repeat(1001), planets.columns), /under 1000/)
  })
})

describe('transform steps', () => {
  it('filter rows by an expression or by conditions', () => {
    assert.deepEqual(values([{ op: 'filter', expr: 'method == "Transit" and mass > 1' }], 'pl_name'), ['HD 209458 b'])
    assert.deepEqual(values([{ op: 'filter', where: { year: { gte: 2008 }, pl_name: { like: '%b' } } }], 'pl_name'), ['HR 8799 b', 'Kepler-452 b'])
  })

  it('compute a column, select, rename and sort', () => {
    const rows = run([
      { op: 'compute', name: 'mass_mj', expr: 'mass / 317.83' },
      { op: 'select', columns: ['pl_name', 'mass_mj'] },
      { op: 'rename', from: 'pl_name', to: 'planet' },
      { op: 'sort', column: 'mass_mj', direction: 'desc' },
    ])
    assert.deepEqual(Object.keys(rows[0]), ['planet', 'mass_mj'])
    assert.deepEqual(rows.map(r => r.planet), ['HR 8799 b', 'HD 209458 b', '51 Peg b', 'TRAPPIST-1 e', 'Kepler-452 b'])
  })

  it('group, counting and working out from a column', () => {
    const rows = run([{ op: 'group', by: ['method'], aggregates: [{ fn: 'count' }, { fn: 'mean', column: 'mass' }, { fn: 'max', column: 'year', name: 'latest' }] }])
    assert.deepEqual(rows, [
      { method: 'Radial Velocity', count: 1, mean_mass: 146, latest: 1995 },
      { method: 'Transit', count: 3, mean_mass: (232 + 0.69) / 2, latest: 2017 },
      { method: 'Imaging', count: 1, mean_mass: 2000, latest: 2008 },
    ])
  })

  it('bin into a histogram, evenly or in log steps, with the empty bins', () => {
    const lin = run([{ op: 'bin', column: 'year', bins: 4 }])
    assert.equal(lin.length, 4)
    assert.equal(lin[0].year_from, 1995)
    assert.equal(lin[3].year_to, 2017)
    assert.deepEqual(lin.map(r => r.count), [2, 0, 1, 2])
    const log = run([{ op: 'bin', column: 'period', bins: 5, scale: 'log' }])
    assert.equal(log.reduce((n, r) => n + r.count, 0), 5)
    assert.ok(Math.abs(log[1].period_from / log[0].period_from - log[2].period_from / log[1].period_from) < 1e-9, 'equal ratios')
  })

  it('bin two columns, keeping only bins something fell in', () => {
    const rows = run([{ op: 'bin2d', x: 'period', y: 'mass', xBins: 3, yBins: 3, xScale: 'log', yScale: 'log' }])
    assert.equal(rows.reduce((n, r) => n + r.count, 0), 4, 'the planet with no mass falls in no bin')
    assert.deepEqual(Object.keys(rows[0]), ['period_from', 'period_to', 'mass_from', 'mass_to', 'count'])
  })

  it('join another dataset by a key, keeping or dropping rows without a match', () => {
    const hosts = rowsToTable([{ planet: 'TRAPPIST-1 e', star: 'TRAPPIST-1', year: 2016 }, { planet: '51 Peg b', star: '51 Peg', year: 1 }])
    const joined = new Map([['hosts', hosts]])
    const left = runTransforms(planets, normalizeTransforms([{ op: 'join', dataset: 'hosts', leftOn: 'pl_name', rightOn: 'planet' }]), joined)
    assert.deepEqual(left.columns.star, ['51 Peg', null, 'TRAPPIST-1', null, null])
    assert.deepEqual(left.columns.year_hosts, [1, null, 2016, null, null], 'a clashing name gets the dataset’s')
    const inner = runTransforms(planets, normalizeTransforms([{ op: 'join', dataset: 'hosts', leftOn: 'pl_name', rightOn: 'planet', how: 'inner', columns: ['star'] }]), joined)
    assert.deepEqual(tableToRows(inner).map(r => [r.pl_name, r.star]), [['51 Peg b', '51 Peg'], ['TRAPPIST-1 e', 'TRAPPIST-1']])
    assert.throws(() => runTransforms(planets, normalizeTransforms([{ op: 'join', dataset: 'gone', on: 'pl_name' }])), /Step 1 \(join\): There’s no dataset "gone"/)
  })

  it('limit the rows', () => {
    assert.equal(run([{ op: 'limit', count: 2 }]).length, 2)
  })

  it('say which step went wrong, and why', () => {
    assert.throws(() => runTransforms(planets, normalizeTransforms([{ op: 'select', columns: ['pl_name'] }, { op: 'compute', name: 'x', expr: 'mass * 2' }])),
      /Step 2 \(compute\): There’s no column "mass"/)
    assert.throws(() => normalizeTransforms([{ op: 'explode' }]), /Step 1: Each step is filter/)
    assert.throws(() => normalizeTransforms([{ op: 'bin', column: 'x', bins: 5000 }]), /bins must be a whole number from 1 to 1000/)
    assert.throws(() => normalizeTransforms([{ op: 'group', by: ['x'], aggregates: [{ fn: 'mean' }] }]), /A mean needs a column/)
    assert.throws(() => normalizeTransforms(Array(21).fill({ op: 'limit', count: 1 })), /Keep to 20 steps/)
    assert.throws(() => normalizeTransforms('x'), /list of steps/)
  })

  it('reuse a transformed table while its source, steps and joined data stay the same', async () => {
    const steps = normalizeTransforms([{ op: 'filter', expr: 'mass > 100' }])
    const a = await transformTable(planets, 'key-1', steps, async () => null)
    assert.equal(await transformTable(planets, 'key-1', steps, async () => null), a)
    assert.notEqual(await transformTable(planets, 'key-2', steps, async () => null), a)
    assert.equal(await transformTable(planets, 'key-1', [], async () => null), planets)
  })
})
