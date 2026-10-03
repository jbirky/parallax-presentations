import { describe, it, expect } from 'vitest'
import { freebodyModel, solveFreebody, netDirection, alpha, contact, boundary, uvec, len } from './freebodySolve'
import { FREEBODY_TEMPLATES } from './freebodyDiagram'

const build = key => freebodyModel(FREEBODY_TEMPLATES.find(t => t.key === key).build())
const mags = (m, s = solveFreebody(m)) => Object.fromEntries(m.forces.map(f => [f.label, s.mag[f.id] == null ? null : Math.round(s.mag[f.id] * 100) / 100]))
const close = (a, b, d = 0.01) => expect(Math.abs(a - b)).toBeLessThan(d)

describe('the model', () => {
  it('keeps what it can draw and defaults the rest', () => {
    const m = freebodyModel({
      body: { shape: 'cube', w: 99, mass: 5 },
      surface: { kind: 'incline', angle: 80 },
      model: 'blob', motion: 'teleport', forceScale: -3,
      forces: [
        { id: 'a', kind: 'weight', magMode: 'mu' },
        { id: 'a', kind: 'normal' },
        { id: 'b c', kind: 'normal' },
        { id: 'z', kind: 'gravitino' },
        { id: 'f', kind: 'friction', magMode: 'mu', mu: 0.4, dir: { from: 'sideways', deg: 1e6 }, color: 'red', step: -2 },
      ],
      captions: { 0: 'start', 3: '  ', 2: 7, x: 'no' },
      color: 'blue', stepStart: 0,
    })
    expect(m.body).toMatchObject({ shape: 'box', w: 6, mass: '5' })
    expect(m.surface.angle).toBe(60)
    expect(m).toMatchObject({ model: 'particle', motion: 'rest', forceScale: 0.01, color: '#ffffff', stepStart: 1 })
    expect(m.forces.map(f => f.id)).toEqual(['a', 'f'])
    expect(m.forces[0].magMode).toBe('given')
    expect(m.forces[1]).toMatchObject({ magMode: 'mu', mu: '0.4', dir: { from: 'level', deg: 360 }, color: null, step: 0 })
    expect(m.captions).toEqual({ 0: 'start' })
  })

  it('keeps no field the canvas reads as its own (scale would zoom the element)', () => {
    const m = freebodyModel({ scale: 50, forceScale: 50 })
    expect(m).not.toHaveProperty('scale')
    expect(m.forceScale).toBe(50)
  })

  it('puts the body against its surface', () => {
    const m = freebodyModel({ surface: { kind: 'incline', angle: 30 }, body: { shape: 'box', w: 2, h: 1 } })
    expect(alpha(m)).toBe(30)
    // The contact point is half the height away, opposite the normal
    const c = contact(m)
    close(c[0], 0.25); close(c[1], -0.433)
    // A ray straight along the slope leaves the box at its half width
    close(len(boundary(m, uvec(30))), 1)
    expect(alpha(freebodyModel({ surface: { kind: 'wall' } }))).toBe(-90)
    expect(alpha(freebodyModel({ surface: { kind: 'ceiling' } }))).toBe(180)
  })
})

describe('the solver', () => {
  it('holds a block still on an incline', () => {
    const m = build('incline'), s = solveFreebody(m)
    expect(mags(m, s)).toEqual({ mg: 49, F_N: 42.44, f_s: 24.5 })
    expect(len(s.net)).toBeLessThan(1e-9)
    expect(s.notes).toEqual([])
  })

  it('works out how fast a block slides down with kinetic friction', () => {
    const m = build('slide'), s = solveFreebody(m)
    expect(mags(m, s)).toEqual({ mg: 39.2, F_N: 32.11, f_k: 8.03 })
    // a = g (sin θ − μ cos θ), down the slope
    close(len(s.acc), 9.8 * (Math.sin(35 * Math.PI / 180) - 0.25 * Math.cos(35 * Math.PI / 180)))
    expect(s.acc[1]).toBeLessThan(0)
    expect(netDirection(m, s.net)).toBe('down the slope')
  })

  it('pulls a sled at an angle', () => {
    const m = build('sled'), s = solveFreebody(m)
    expect(mags(m, s)).toMatchObject({ F_N: 156, f_k: 23.4 })
    close(s.acc[0], (80 * Math.cos(Math.PI / 6) - 23.4) / 20)
    expect(netDirection(m, s.net)).toBe('to the right')
  })

  it('shares a sign’s weight between two ropes', () => {
    const m = build('sign'), s = solveFreebody(m)
    expect(mags(m, s)).toMatchObject({ T_1: 50.73, T_2: 71.74 })
  })

  it('lets a ball fall freely with drag', () => {
    const m = build('fall'), s = solveFreebody(m)
    close(s.acc[1], -3.8)
    expect(netDirection(m, s.net)).toBe('down')
  })

  it('tilts with its incline', () => {
    const m = build('incline')
    m.surface.angle = 50
    expect(mags(m)).toMatchObject({ F_N: 31.5, f_s: 37.54 })
  })

  it('says when there are too many unknowns, or two along one line', () => {
    const m = build('incline')
    m.forces[0].magMode = 'solve'
    const s = solveFreebody(m)
    expect(s.status).toBe('unsolved')
    expect(s.notes[0].text).toMatch(/^3 unknowns/)
    const p = freebodyModel({ surface: { kind: 'none' }, forces: [
      { id: 'a', kind: 'tension', magMode: 'solve', dir: { deg: 90 } }, { id: 'b', kind: 'tension', magMode: 'solve', dir: { deg: -90 } },
      { id: 'c', kind: 'applied', mag: '5', dir: { deg: 0 } },
    ] })
    expect(solveFreebody(p).notes[0]).toEqual({ text: '{0} and {1} act along one line, so they can’t both be worked out.', labels: ['T', 'T'] })
  })

  it('draws a force that comes out negative the other way, and says why', () => {
    // A block pushed up a slope harder than gravity pulls it down: static friction acts down the slope
    const m = build('incline')
    m.forces.push({ ...m.forces[0], id: 'p', kind: 'applied', label: 'P', magMode: 'given', mag: '60', dir: { from: 'surface', deg: 0 }, comps: false, angle: 'none' })
    const s = solveFreebody(freebodyModel(m))
    expect(s.mag.f3).toBeLessThan(0)
    expect(s.notes.map(n => n.text)).toContain('{0} comes out negative, so friction points the other way. It’s drawn that way.')
  })

  it('reports a missing mass and a missing value without breaking', () => {
    const m = build('slide')
    m.body.mass = ''
    const s = solveFreebody(m)
    expect(s.notes.map(n => n.text)).toEqual(expect.arrayContaining(['{0} is mg, but the body has no mass yet.', 'Give the body a mass to work out how fast it slides.']))
    const g = freebodyModel({ forces: [{ id: 'a', kind: 'applied', mag: '' }] })
    expect(solveFreebody(g)).toMatchObject({ mag: { a: null }, how: { a: 'none' } })
  })

  it('leaves what one unknown can’t balance as the net force', () => {
    const m = freebodyModel({ body: { mass: '5' }, forces: [
      { id: 'w', kind: 'weight', magMode: 'mass', dir: { deg: -90 } }, { id: 'n', kind: 'normal', magMode: 'solve', dir: { from: 'surface', deg: 90 } },
      { id: 'p', kind: 'applied', mag: '20', dir: { deg: 0 } },
    ] })
    const s = solveFreebody(m)
    close(s.mag.n, 49)
    close(s.net[0], 20); expect(s.net[1]).toBe(0)
    expect(s.notes[0].text).toMatch(/can’t balance/)
  })
})
