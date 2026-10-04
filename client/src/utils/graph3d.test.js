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
