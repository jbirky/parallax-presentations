import { describe, it, expect } from 'vitest'
import { graph3d } from './graph3d'

const G = graph3d()
const box = { xMin: -10, xMax: 10, yMin: -10, yMax: 10, zMin: -10, zMax: 10 }
const verts = m => Array.from({ length: m.pos.length / 3 }, (_, k) => [m.pos[3 * k], m.pos[3 * k + 1], m.pos[3 * k + 2]])
const used = m => [...new Set(m.idx)].map(k => [m.pos[3 * k], m.pos[3 * k + 1], m.pos[3 * k + 2]])

describe('surfaces z = f(x, y)', () => {
  it('sample a grid over the box, with normals', () => {
    const m = G.explicit(E => E.x * E.y / 10, {}, box, 'z', 20)
    expect(m.pos.length / 3).toBe(21 * 21)
    expect(m.idx.length).toBe(20 * 20 * 6)
    for (const [x, y, z] of verts(m)) expect(z).toBeCloseTo(x * y / 10, 5)
    // The normal at the middle of a plane z = 2x + 3y is along (−2, −3, 1)
    const p = G.explicit(E => 2 * E.x + 3 * E.y, {}, box, 'z', 10)
    const k = 5 * 11 + 5, n = [p.nor[3 * k], p.nor[3 * k + 1], p.nor[3 * k + 2]], len = Math.hypot(...n)
    expect(n[0] / len).toBeCloseTo(-2 / Math.sqrt(14), 6)
    expect(n[1] / len).toBeCloseTo(-3 / Math.sqrt(14), 6)
    expect(n[2] / len).toBeCloseTo(1 / Math.sqrt(14), 6)
  })

  it('read r and θ, and end smoothly where they’re undefined', () => {
    const m = G.explicit(E => (E.r < 6 ? 8 - E.r * E.r / 4 : NaN), {}, box, 'z', 72)
    const edge = verts(m).slice(73 * 73)
    expect(edge.length).toBeGreaterThan(100)
    for (const [x, y, z] of edge) {
      expect(Math.abs(Math.hypot(x, y) - 6)).toBeLessThan(1e-3)
      expect(z).toBeCloseTo(-1, 2)
    }
    // Every triangle drawn is on the surface
    for (const [x, y, z] of used(m)) expect(Math.hypot(x, y)).toBeLessThan(6 + 1e-3)
    const t = G.explicit(E => E.theta, {}, box, 'z', 8)
    expect(verts(t)[8][2]).toBeCloseTo(Math.atan2(-10, 10), 6)
  })

  it('run along the other axes too', () => {
    const m = G.explicit(E => E.y + E.z, {}, box, 'x', 4)
    for (const [x, y, z] of verts(m)) expect(x).toBeCloseTo(y + z, 5)
    const n = G.explicit(E => E.x - E.z, {}, box, 'y', 4)
    for (const [x, y, z] of verts(n)) expect(y).toBeCloseTo(x - z, 5)
  })
})

describe('parametric surfaces and curves', () => {
  it('draw a torus over u and v', () => {
    const m = G.parametric(E => (6 + 2 * Math.cos(E.v)) * Math.cos(E.u), E => (6 + 2 * Math.cos(E.v)) * Math.sin(E.u), E => 2 * Math.sin(E.v), {}, 0, 2 * Math.PI, 0, 2 * Math.PI, 32, 16)
    expect(m.pos.length / 3).toBe(33 * 17)
    for (const [x, y, z] of verts(m)) expect((Math.hypot(x, y) - 6) ** 2 + z * z).toBeCloseTo(4, 4)
    expect(m.mesh[2 * 33 * 17 - 2]).toBeCloseTo(2 * Math.PI, 5)
  })

  it('break a curve where it’s undefined', () => {
    const runs = G.curve(E => E.t, E => (E.t > 0.5 && E.t < 0.6 ? NaN : 0), E => 0, {}, 0, 1, 100)
    expect(runs).toHaveLength(2)
    expect(runs[0][runs[0].length - 1][0]).toBeLessThan(0.51)
  })
})

describe('implicit surfaces', () => {
  it('find a sphere by marching tetrahedra, with outward normals', () => {
    const m = G.implicit(E => E.x * E.x + E.y * E.y + E.z * E.z - 36, {}, box, 40)
    expect(m.idx.length / 3).toBeGreaterThan(5000)
    for (let k = 0; k < m.pos.length; k += 3) {
      const p = [m.pos[k], m.pos[k + 1], m.pos[k + 2]], n = [m.nor[k], m.nor[k + 1], m.nor[k + 2]]
      expect(Math.abs(Math.hypot(...p) - 6)).toBeLessThan(0.03)
      expect((p[0] * n[0] + p[1] * n[1] + p[2] * n[2]) / (Math.hypot(...p) * Math.hypot(...n))).toBeGreaterThan(0.99)
    }
  })

  it('read r for a cylinder, and skip false surfaces through infinity', () => {
    const c = G.implicit(E => E.r - 4, {}, box, 30)
    for (let k = 0; k < c.pos.length; k += 3) expect(Math.abs(Math.hypot(c.pos[k], c.pos[k + 1]) - 4)).toBeLessThan(0.1)
    expect(G.implicit(E => 1 / (E.x - 0.123), {}, box, 30).idx.length).toBe(0)
  })
})

describe('the camera', () => {
  it('puts the box in view, z up, and the near corner in front', () => {
    const cam = G.camera(box, 35, 25, 800, 450)
    const corners = []
    for (const x of [-10, 10]) for (const y of [-10, 10]) for (const z of [-10, 10]) corners.push(cam.project([x, y, z]))
    for (const [px, py] of corners) {
      expect(px).toBeGreaterThan(0); expect(px).toBeLessThan(800)
      expect(py).toBeGreaterThan(0); expect(py).toBeLessThan(450)
    }
    expect(cam.project([0, 0, 10])[1]).toBeLessThan(cam.project([0, 0, -10])[1])
    // Seen from turn 35°, the corner (10, 10, 0) is nearer than (−10, −10, 0)
    expect(cam.project([10, 10, 0])[2]).toBeLessThan(cam.project([-10, -10, 0])[2])
  })

  it('picks round tick steps', () => {
    expect(G.niceStep(20, 5)).toBe(5)
    expect(G.niceStep(1, 10)).toBe(0.1)
    expect(G.niceStep(300, 5)).toBe(50)
  })
})

describe('a fourth value, as color', () => {
  it('colors with viridis, or diverging about 0 when the values have both signs', () => {
    expect(G.colorScale([1, 2, 3, 5], {})).toEqual({ kind: 'viridis', min: 1, max: 5 })
    expect(G.colorScale([-2, 0, 5], {})).toEqual({ kind: 'diverging', min: -5, max: 5 })
    // Barely negative is still one-sided
    expect(G.colorScale([-0.1, 0, 5], {}).kind).toBe('viridis')
    // Chosen, or a range set
    expect(G.colorScale([1, 2, 3], { cmap: 'diverging' })).toEqual({ kind: 'diverging', min: -3, max: 3 })
    expect(G.colorScale([-2, 0, 5], { cmap: 'viridis' })).toEqual({ kind: 'viridis', min: -2, max: 5 })
    expect(G.colorScale([1, 2, 3], { min: 0, max: 10 })).toEqual({ kind: 'viridis', min: 0, max: 10 })
    expect(G.colorScale([1, 2, 3], { min: null, max: 2.5 })).toEqual({ kind: 'viridis', min: 1, max: 2.5 })
    // Undefined values are left out; with none, or one value, a range still
    expect(G.colorScale([NaN, 4, Infinity, 6], {})).toEqual({ kind: 'viridis', min: 4, max: 6 })
    expect(G.colorScale([], {})).toEqual({ kind: 'viridis', min: 0, max: 1 })
    const one = G.colorScale([2, 2], {})
    expect(one.min).toBeLessThan(2)
    expect(one.max).toBeGreaterThan(2)
  })

  it('leaves out a pole’s spike, so it doesn’t take the whole map', () => {
    const vals = Array.from({ length: 1000 }, (_, i) => i / 1000)
    vals[500] = 1e6
    const s = G.colorScale(vals, {})
    expect(s.max).toBeLessThan(1.01)
    // A smooth spread keeps its ends
    expect(G.colorScale(Array.from({ length: 1000 }, (_, i) => i), {})).toMatchObject({ min: 0, max: 1000 })
    // Rounded outward: a grid's samples miss sin's peak of 3 a little
    expect(G.colorScale([-2.99, 0.4, 2.98], {})).toEqual({ kind: 'diverging', min: -3, max: 3 })
    expect(G.colorScale([0.000199, 0.5, 1], {})).toEqual({ kind: 'viridis', min: 0, max: 1 })
  })

  it('maps colors as the shaders do', () => {
    const near = (a, b, digits = 2) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits))
    // viridis's ends, as nearly as its polynomial gets them
    near(G.colormap(0, 'viridis'), [0.267, 0.005, 0.329], 1)
    near(G.colormap(1, 'viridis'), [0.993, 0.906, 0.144], 1)
    near(G.colormap(0, 'diverging'), [0.1412, 0.4392, 0.8])
    near(G.colormap(0.5, 'diverging'), [0.86, 0.86, 0.86])
    near(G.colormap(1, 'diverging'), [0.8118, 0.3529, 0.1216])
    near(G.colormap(2, 'viridis'), G.colormap(1, 'viridis'))
  })

  it('slices the box, where the value is defined, with the value at each point', () => {
    const F = E => (E.x * E.x + E.y * E.y + E.z * E.z < 64 ? E.x + 2 * E.y + 3 * E.z : NaN)
    const m = G.slice(F, {}, box, 'y', 2, 40)
    const pts = used(m)
    for (const [x, y, z] of pts) {
      expect(y).toBe(2)
      expect(x * x + 4 + z * z).toBeLessThan(64 + 0.01)
    }
    // Its edge, a circle of radius √60 in the plane y = 2
    expect(pts.some(([x, , z]) => Math.abs(Math.hypot(x, z) - Math.sqrt(60)) < 1e-3)).toBe(true)
    for (const k of new Set(m.idx)) expect(m.w[k]).toBeCloseTo(m.pos[3 * k] + 4 + 3 * m.pos[3 * k + 2], 3)
    // A slice of z, through r
    const s = G.slice(E => E.r, {}, box, 'z', -3, 10)
    for (const k of new Set(s.idx)) expect(s.w[k]).toBeCloseTo(Math.hypot(s.pos[3 * k], s.pos[3 * k + 1]), 4)
  })

  it('keeps a surface through grid points exactly on it', () => {
    // On an integer grid, x + y + z = 0 is exactly 0 at many corners: the
    // whole hexagon where it crosses the cube, area 3√3/2 · (10√2)²
    const m = G.implicit(E => E.x + E.y + E.z, {}, box, 20)
    let area = 0
    for (let t = 0; t < m.idx.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map(q => [0, 1, 2].map(r => m.pos[3 * m.idx[t + q] + r]))
      const u = a.map((v, i) => b[i] - v), v = a.map((w, i) => c[i] - w)
      area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2
    }
    expect(area).toBeCloseTo(3 * Math.sqrt(3) / 2 * 200, 0)
  })

  it('finds level surfaces from one sampled grid', () => {
    const F = E => E.x * E.x + E.y * E.y + E.z * E.z
    const grid = G.sample(F, {}, box, 30)
    expect(grid.length).toBe(31 ** 3)
    for (const level of [9, 49]) {
      const m = G.implicit(F, {}, box, 30, level, grid)
      expect(m.idx.length).toBeGreaterThan(300)
      for (const [x, y, z] of verts(m)) expect(Math.abs(Math.hypot(x, y, z) - Math.sqrt(level))).toBeLessThan(0.15)
    }
  })

  it('puts a cloud of dots where the value is defined', () => {
    const c = G.cloud(E => (E.z > 0 ? E.x : NaN), {}, box, 4)
    expect(c.w.length).toBe(4 * 4 * 2)
    expect(c.pos.length).toBe(c.w.length * 3)
    for (let k = 0; k < c.w.length; k++) {
      expect(c.pos[3 * k + 2]).toBeGreaterThan(0)
      expect(c.w[k]).toBe(c.pos[3 * k])
    }
    expect([...new Set(c.pos.filter((_, i) => i % 3 === 0))].sort((a, b) => a - b)).toEqual([-7.5, -2.5, 2.5, 7.5])
  })

  it('colors a parametric surface by u and v, and a curve by t', () => {
    const m = G.parametric(E => Math.cos(E.u), E => Math.sin(E.u), E => E.v, {}, 0, Math.PI, 0, 1, 8, 4)
    const w = G.values(m, E => E.u * 10 + E.v, {}, true)
    expect(w[0]).toBe(0)
    expect(w[8]).toBeCloseTo(Math.PI * 10, 5)
    expect(w[9 * 4 + 8]).toBeCloseTo(Math.PI * 10 + 1, 5)
    expect(G.usedValues(m).length).toBe(9 * 5)
    // Undefined values are drawn at the scale's middle
    w[3] = NaN
    G.fillMissing(m, { min: 0, max: 4 })
    expect(m.w[3]).toBe(2)
    const runs = G.curve(E => E.t, E => 0, E => 0, {}, 0, 1, 4)
    expect(runs[0].map(p => p[3])).toEqual([0, 0.25, 0.5, 0.75, 1])
    const lines = G.renderer({ createElement: () => ({}) }).lines(runs, p => p[3] * 2)
    expect([...lines.w]).toEqual([0, 0, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1.5, 1.5, 1.5, 1.5, 2, 2])
  })
})
