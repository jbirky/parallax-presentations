import { describe, it, expect } from 'vitest'
import { graphFields } from './graphFields'

const G = graphFields()
const env = {}
const box = { xMin: -10, xMax: 10, yMin: -7, yMax: 7 }
const sys = (fx, fy) => (e, x, y, o) => { o[0] = fx(x, y); o[1] = fy(x, y) }

describe('paths', () => {
  it('follow the harmonic oscillator to 1e-6, and close after one turn', () => {
    const tr = G.trajectory(sys((x, y) => y, (x, y) => -x), env, 1, 0, 1, box)
    expect(tr.closed).toBe(true)
    expect(tr.pts[tr.pts.length - 2][2]).toBeCloseTo(2 * Math.PI, 0)
    let worst = 0
    for (const [x, y, t] of tr.pts.slice(0, -1)) worst = Math.max(worst, Math.abs(x - Math.cos(t)), Math.abs(y + Math.sin(t)))
    expect(worst).toBeLessThan(1e-6)
  })

  it('keep what the system conserves', () => {
    // The pendulum's energy
    const pend = G.trajectory(sys((x, y) => y, (x, y) => -Math.sin(x)), env, 0.5, 1.2, 1, box, { tMax: 60 })
    const H = ([x, y]) => y * y / 2 - Math.cos(x)
    expect(Math.max(...pend.pts.map(p => Math.abs(H(p) - H(pend.pts[0]))))).toBeLessThan(1e-6)
    // Lotka–Volterra's V = δx − γ ln x + βy − α ln y, on an orbit that closes
    const [a, b, g, d] = [1, 0.5, 0.75, 0.25]
    const lv = G.trajectory(sys((x, y) => x * (a - b * y), (x, y) => y * (d * x - g)), env, 4, 1, 1, { xMin: 0, xMax: 12, yMin: 0, yMax: 8 })
    const V = ([x, y]) => d * x - g * Math.log(x) + b * y - a * Math.log(y)
    expect(lv.closed).toBe(true)
    expect(Math.max(...lv.pts.map(p => Math.abs(V(p) - V(lv.pts[0]))))).toBeLessThan(1e-6)
  })

  it('find Van der Pol’s limit cycle, amplitude 2.0086 at μ = 1', () => {
    const tr = G.trajectory(sys((x, y) => y, (x, y) => (1 - x * x) * y - x), env, 0.1, 0, 1, box, { tMax: 120, maxSteps: 200000 })
    const amp = Math.max(...tr.pts.filter(p => p[2] > 90).map(p => p[0]))
    expect(Math.abs(amp - 2.00862)).toBeLessThan(2e-3)
  })

  it('stop at rest, off the view, or at a blow-up', () => {
    const rest = G.trajectory(sys((x, y) => -x, (x, y) => -y), env, 3, 2, 1, box, { tMax: 1e4 })
    expect(rest.end).toBe('stopped')
    expect(rest.pts[rest.pts.length - 1][2]).toBeLessThan(60)
    const last = rest.pts[rest.pts.length - 1]
    expect(Math.hypot(last[0], last[1])).toBeLessThan(1e-5)
    const out = G.trajectory(sys(() => 1, () => 0), env, 0, 0, 1, box)
    expect(out.pts[out.pts.length - 1][0]).toBeGreaterThan(10)
    expect(out.pts[out.pts.length - 1][0]).toBeLessThan(20.2)   // half a view past its edge
  })

  it('solve slope fields across the view', () => {
    const sol = G.solution((e, x, y) => y * (1 - y), env, 0, 0.1, { xMin: -5, xMax: 8, yMin: -1, yMax: 2 })
    expect(sol[0][0]).toBe(-5)
    expect(sol[sol.length - 1][0]).toBeCloseTo(8, 9)
    expect(Math.max(...sol.map(([x, y]) => Math.abs(y - 1 / (1 + 9 * Math.exp(-x)))))).toBeLessThan(1e-7)
    // y′ = y² from y(0) = 1 blows up at x = 1: it stops before
    const blow = G.solution((e, x, y) => y * y, env, 0, 1, { xMin: -3, xMax: 3, yMin: -5, yMax: 5 })
    expect(Math.max(...blow.map(p => p[0]))).toBeLessThan(1)
  })
})

describe('equilibria', () => {
  it('classify every kind of linear system', () => {
    const cases = [
      [[[1, 0], [0, -1]], 'saddle'], [[[-2, 0], [0, -1]], 'stable node'], [[[2, 1], [0, 3]], 'unstable node'],
      [[[-0.1, 1], [-1, -0.1]], 'stable spiral'], [[[0.2, -1], [1, 0.2]], 'unstable spiral'], [[[0, 1], [-1, 0]], 'center'],
      [[[-1, 0], [0, -1]], 'stable degenerate node'], [[[1, 1], [0, 1]], 'unstable degenerate node'], [[[1, 2], [2, 4]], 'degenerate'],
    ]
    for (const [J, kind] of cases) expect(G.classify(J).kind).toBe(kind)
    const s = G.classify([[1, 0], [0, -1]])
    expect(Math.abs(s.vecs[0][1])).toBeCloseTo(1, 12)   // stable along y
    expect(Math.abs(s.vecs[1][0])).toBeCloseTo(1, 12)   // unstable along x
    const c = G.classify([[-0.125 * 2, -1], [1, 0]])
    expect(c.eig[0][1]).not.toBe(0)
  })

  it('find the pendulum’s, at kπ, undamped and damped', () => {
    const view = { xMin: -7, xMax: 7, yMin: -4, yMax: 4 }
    for (const [c, kinds] of [[0, 'center,saddle,center,saddle,center'], [0.2, 'stable spiral,saddle,stable spiral,saddle,stable spiral']]) {
      const eq = G.equilibria(sys((x, y) => y, (x, y) => -Math.sin(x) - c * y), env, view)
      expect(eq.map(p => Math.round(p.x / Math.PI) + 0)).toEqual([-2, -1, 0, 1, 2])
      expect(Math.max(...eq.map((p, i) => Math.abs(p.x - (i - 2) * Math.PI)), ...eq.map(p => Math.abs(p.y)))).toBeLessThan(1e-9)
      expect(eq.map(p => p.kind).join()).toBe(kinds)
    }
  })

  it('trace separatrices that keep the saddle’s energy', () => {
    const view = { xMin: -7, xMax: 7, yMin: -4, yMax: 4 }
    const F = sys((x, y) => y, (x, y) => -Math.sin(x))
    const saddle = G.equilibria(F, env, view).find(p => p.kind === 'saddle' && p.x > 0)
    const seps = G.separatrices(F, env, saddle, view)
    expect(seps).toHaveLength(4)
    for (const s of seps) for (const [x, y] of s.pts) expect(Math.abs(y * y / 2 - Math.cos(x) - 1)).toBeLessThan(1e-4)
    expect(G.separatrices(F, env, { kind: 'center' }, view)).toEqual([])
  })

  it('find Lotka–Volterra’s saddle and center', () => {
    const eq = G.equilibria(sys((x, y) => x * (1 - 0.5 * y), (x, y) => y * (0.25 * x - 0.75)), env, { xMin: -1, xMax: 12, yMin: -1, yMax: 8 })
    expect(eq.map(p => p.kind)).toEqual(['saddle', 'center'])
    expect(eq[1].x).toBeCloseTo(3, 9)
    expect(eq[1].y).toBeCloseTo(2, 9)
  })
})

describe('streamlines', () => {
  const W = 700, H = 400, dsep = 24
  it('are evenly spaced, and close round a center', () => {
    const lines = G.streamlines((px, py, o) => { o[0] = -(py - H / 2); o[1] = px - W / 2 }, W, H, dsep)
    const fit = lines.filter(l => l.pts.every(p => p[0] > 2 && p[0] < W - 2 && p[1] > 2 && p[1] < H - 2))
    expect(fit.length).toBeGreaterThanOrEqual(7)
    expect(fit.every(l => l.loop)).toBe(true)
    const all = []
    lines.forEach((l, i) => l.pts.forEach(p => all.push([p[0], p[1], i])))
    let close = 0
    for (let a = 0; a < all.length; a += 7) for (let b = 0; b < all.length; b += 3) {
      if (all[a][2] !== all[b][2] && Math.hypot(all[a][0] - all[b][0], all[a][1] - all[b][1]) < dsep * 0.5 - 1.5) close++
    }
    expect(close).toBe(0)
    let near = 0, total = 0
    for (let y = 10; y < H; y += 20) for (let x = 10; x < W; x += 20) { total++; if (all.some(p => Math.hypot(p[0] - x, p[1] - y) < dsep)) near++ }
    expect(near / total).toBeGreaterThan(0.95)
  })

  it('finish where the field is zero or undefined', () => {
    expect(G.streamlines((px, py, o) => { o[0] = 0; o[1] = 0 }, W, H, dsep)).toEqual([])
    expect(G.streamlines((px, py, o) => { o[0] = NaN; o[1] = 1 }, W, H, dsep)).toEqual([])
  })
})
