import { describe, it, expect } from 'vitest'
import { SH, harmonicsPython, harmonicsTex, conventionsText } from './sphericalHarmonics'
import { HV } from './harmonicsView'

// SciPy 1.16.3's sph_harm_y at random points (ℓ ≤ 40): [ℓ, m, θ, φ, Re Y, Im Y, real Y_{ℓm}]
const SCIPY = [
  [11, 3, 1.72582529362961, 2.08450006493863, 0.0492590950932027, -0.00146269144212544, -0.0696628803510333],
  [37, 11, 3.09206592923562, 2.57525077517725, 2.14729375374589e-08, 1.14827673295294e-09, -3.03673194894647e-08],
  [39, -15, 2.0372345791749, 2.96378302485944, -0.107058397240843, 0.0549824737432113, -0.077756960060472],
  [14, 7, 0.304548989758429, 1.88873477729864, -0.0257615003671553, -0.0197787261880513, 0.0364322632063105],
  [36, -29, 3.1362425014794, 5.25790630081431, 3.04486342205063e-63, 2.70630014677172e-62, -3.82728637141687e-62],
  [24, -22, 0.908126494021363, 5.30106224049906, -0.0397237494193717, 0.01607109715292, -0.0227279635558752],
  [33, 31, 0.585272224427353, 4.43384730891976, -1.65398948688957e-07, 1.63888174707065e-07, 2.33909436438174e-07],
  [25, 23, 0.557301436411687, 3.69739846707251, 7.00859023376218e-06, 1.54639312677246e-06, -9.91164336170209e-06],
  [11, 8, 1.55876406864968, 1.32370446546511, 0.0147546952246813, 0.0343283309757005, 0.0208662900954258],
  [5, -4, 0.0964182676617347, 4.22494723687875, -4.64220797669258e-05, 0.000116574057258797, -0.000164860612796249],
  [11, -2, 2.1833679436354, 5.95831156174742, -0.170614218173161, -0.129633713259406, 0.183329755432236],
  [18, -12, 0.200048993504147, 0.650087722280112, 9.21323002125443e-08, -1.73905244271619e-06, 2.45939155016729e-06],
  [21, -19, 2.9381266359695, 3.60143188210346, 8.73990319924051e-13, 7.18156839978343e-13, -1.01562714300838e-12],
  [1, -1, 2.20002377593733, 0.743454936698535, 0.205621472934177, -0.189057642945051, 0.267367882723181],
  [5, 3, 2.31903267801536, 4.44032396172898, -0.314100355261549, -0.295325981940936, 0.44420498235709],
  [13, -4, 2.60101878287502, 1.37610822554549, -0.115705273745654, -0.114177505840331, 0.161471377277329],
  [23, -13, 0.830241953209165, 4.08998965432417, 0.17585595707484, 0.0425151492648085, -0.0601255006966087],
  [14, -9, 1.00740235083571, 1.75585559532594, 0.0445992047752178, -0.0042378849719671, 0.005993274403133],
  [21, 5, 2.81201571693343, 0.931595039181762, 0.0351209231989332, 0.644804510131611, -0.0496684859109952],
  [35, -13, 2.1795422645339, 1.6696535455003, 0.18181877862047, 0.0533973076087, -0.0755151966144316],
  [30, 17, 0.258814794100785, 0.946066738806702, 1.35405196870176e-05, 5.33258732984864e-06, -1.91491865829601e-05],
  [0, 0, 2.28722050637774, 0.0551708339786821, 0.282094791773878, 0.0, 0.282094791773878],
  [0, 0, 2.48829995463936, 3.30310158098448, 0.282094791773878, 0.0, 0.282094791773878],
  [14, 13, 1.51146533244376, 1.62826151106647, 0.122369385017241, -0.132134596084088, -0.173056443910637],
  [25, 3, 0.0637285971856593, 1.47685324635404, 0.0421133067417621, 0.145451087580697, -0.0595572095505783],
  [20, 6, 0.202281261690897, 3.96397233392976, 0.0216725621037034, -0.0960646906769972, 0.0306496312584305],
  [1, 0, 0.183508056970766, 4.38892555271368, 0.48039867751235, 0.0, 0.48039867751235],
  [14, -11, 2.46708078456715, 0.447977087078803, -0.0157736787758319, -0.0721078044736837, 0.101975835039631],
  [26, 26, 2.59956209138398, 4.05115578329866, 1.98201174537e-09, -2.28041979101055e-08, 2.80298789108503e-09],
  [5, 0, 0.67985557005384, 5.85791636243254, -0.390340912839023, 0.0, -0.390340912839023],
  [33, 8, 3.06878841116982, 2.91989800991231, 4.43639357836144e-05, 0.000215792674885093, 6.27400796654365e-05],
  [4, 1, 2.45669208396841, 4.94601132719934, 0.0643230263959021, -0.270301662187544, -0.0909664963019673],
  [16, -5, 2.03417561456116, 3.9255921693102, 0.204962391839317, -0.202115552325677, 0.285834555265501],
  [37, -26, 0.58542532050689, 1.65518492608975, 0.00614204399319238, 0.00854350677003426, -0.0120823431444088],
  [20, 18, 0.151119062899684, 0.222458057315116, -1.74420472544195e-14, -2.03689296531582e-14, -2.46667797827525e-14],
  [16, 4, 2.63722688947428, 3.01812840023539, -0.231739241162189, 0.12475745308087, -0.327728777785617],
  [6, -6, 1.58093186081215, 3.12577004281006, 0.480760593001792, 0.0457789410029282, -0.0647411992374189],
  [7, -6, 1.36822800111424, 1.81891535879655, -0.0272643074625751, 0.331412543463647, -0.468688113706852],
  [16, 16, 2.07398907185206, 0.408377349267596, 0.0706756766231701, 0.0181106399051397, 0.0999505004103822],
  [7, 7, 1.47648983136151, 5.4721626837331, -0.398376608351148, -0.276083499622821, 0.563389602462388],
  [40, -25, 1.92858814720175, 1.23180370529924, -0.298908030580368, -0.213769659448803, 0.302315951616375],
  [17, -8, 0.321828345284776, 1.12773408850067, -0.0479205589472572, -0.0204247973706135, 0.0288850254502439],
  [32, 11, 2.03376908635282, 5.77969996200787, 0.256815097709224, 0.236787708799866, -0.363191394202556],
  [27, 26, 2.27720605766846, 1.51071182944587, 2.30105123320444e-05, -0.00267576302704385, 3.25417786171306e-05],
  [27, -15, 2.17664073935884, 3.99872945972025, -0.219516246567608, 0.0656694049022339, -0.0928705630457094],
  [5, -2, 0.059275292242801, 0.0447921904264042, 0.0117646526077321, -0.00105675758726963, 0.00149448091205738],
  [4, -3, 0.44444458587918, 5.19932859683489, -0.0892786429839044, -0.00985841803567848, 0.0139419084896],
  [3, -3, 1.7616720535917, 1.47910394762437, -0.107263720313427, 0.38005527378571, -0.537479322639171],
]

const CONV = { cs: true, norm: 'orthonormal' }
const one = (form, l, m, conv = CONV) => SH.fromTerms([{ form, l, m, c: [1, 0] }], conv)

// Gauss–Legendre nodes in cos θ, uniform in φ: exact for these band limits
function gaussLegendre(n) {
  const x = [], w = []
  for (let i = 0; i < n; i++) {
    let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp
    for (let it = 0; it < 100; it++) {
      let p1 = 1, p2 = 0
      for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j }
      pp = n * (z * p1 - p2) / (z * z - 1)
      const dz = p1 / pp; z -= dz
      if (Math.abs(dz) < 1e-15) break
    }
    x.push(z); w.push(2 / ((1 - z * z) * pp * pp))
  }
  return { x, w }
}
function quadrature(n, np) {
  const G = gaussLegendre(n)
  return { th: G.x.map(Math.acos), ph: Array.from({ length: np }, (_, j) => 2 * Math.PI * (j + 0.5) / np), w: G.w.map(w => w * 2 * Math.PI / np), np }
}
// ⟨F, G⟩ = ∫ conj(F) G dΩ
function inner(Q, F, G) {
  let re = 0, im = 0
  for (let i = 0; i < Q.th.length; i++) for (let j = 0; j < Q.np; j++) {
    const k = i * Q.np + j, w = Q.w[i]
    re += w * (F.re[k] * G.re[k] + F.im[k] * G.im[k]); im += w * (F.re[k] * G.im[k] - F.im[k] * G.re[k])
  }
  return [re, im]
}

describe('the harmonics', () => {
  it('agree with SciPy’s sph_harm_y, complex and real, up to ℓ = 40', () => {
    for (const [l, m, th, ph, re, im, real] of SCIPY) {
      const c = SH.evalAt(one('complex', l, m), th, ph), r = SH.evalAt(one('real', l, m), th, ph)
      expect(Math.hypot(c[0] - re, c[1] - im)).toBeLessThan(1e-12)
      expect(Math.abs(r[0] - real)).toBeLessThan(1e-12)
      expect(r[1]).toBe(0)
    }
  })

  it('are orthonormal in both forms, ℓ ≤ 6', () => {
    const Q = quadrature(32, 72)
    for (const form of ['complex', 'real']) {
      const fs = []
      for (let l = 0; l <= 6; l++) for (let m = -l; m <= l; m++) fs.push(SH.synth(one(form, l, m), Q.th, Q.ph))
      let worst = 0
      for (let a = 0; a < fs.length; a++) for (let b = a; b < fs.length; b++) {
        const [re, im] = inner(Q, fs[a], fs[b])
        worst = Math.max(worst, Math.hypot(re - (a === b ? 1 : 0), im))
      }
      expect(worst).toBeLessThan(1e-12)
    }
  })

  it('stay normalized at high ℓ', () => {
    const Q = quadrature(80, 160)
    const F = SH.synth(one('complex', 60, 37), Q.th, Q.ph)
    expect(inner(Q, F, F)[0]).toBeCloseTo(1, 10)
  })

  it('integrate to what each normalization says', () => {
    const Q = quadrature(24, 48)
    for (const [norm, want] of [['4pi', () => 4 * Math.PI], ['schmidt', l => 4 * Math.PI / (2 * l + 1)]]) {
      for (const form of ['complex', 'real']) for (const [l, m] of [[0, 0], [2, 1], [5, -3], [7, 7]]) {
        const F = SH.synth(one(form, l, m, { cs: true, norm }), Q.th, Q.ph)
        expect(inner(Q, F, F)[0]).toBeCloseTo(want(l), 10)
      }
    }
    // Unnormalized: P_2^1(cos θ) e^{iφ}, P_2^1(x) = −3x√(1−x²) with the Condon–Shortley phase
    const v = SH.evalAt(one('complex', 2, 1, { cs: true, norm: 'unnormalized' }), 0.7, 0.4)
    const p = -3 * Math.cos(0.7) * Math.sin(0.7)
    expect(v[0]).toBeCloseTo(p * Math.cos(0.4), 13)
    expect(v[1]).toBeCloseTo(p * Math.sin(0.4), 13)
    // Without it, odd m > 0 changes sign and Y_ℓ^{−m} = conj(Y_ℓ^m)
    expect(SH.evalAt(one('complex', 2, 1, { cs: false, norm: 'unnormalized' }), 0.7, 0.4)[0]).toBeCloseTo(-p * Math.cos(0.4), 13)
    const a = SH.evalAt(one('complex', 3, 1, { cs: false, norm: 'orthonormal' }), 1.1, 2), b = SH.evalAt(one('complex', 3, -1, { cs: false, norm: 'orthonormal' }), 1.1, 2)
    expect(b[0]).toBeCloseTo(a[0], 14); expect(b[1]).toBeCloseTo(-a[1], 14)
  })

  it('put real lobes where their names say', () => {
    const at = (l, m, th, ph) => SH.evalAt(one('real', l, m), th, ph)[0]
    expect(at(1, 1, Math.PI / 2, 0)).toBeCloseTo(Math.sqrt(3 / (4 * Math.PI)), 14)   // p_x on +x
    expect(at(1, -1, Math.PI / 2, Math.PI / 2)).toBeGreaterThan(0)                    // p_y on +y
    expect(at(2, -2, Math.PI / 2, Math.PI / 4)).toBeGreaterThan(0)                    // d_xy at x = y > 0
    expect(at(3, -3, Math.PI / 2, Math.PI / 6)).toBeGreaterThan(0)                    // y(3x² − y²) at 30°
    // The same whichever phase convention: real harmonics don't take it
    expect(SH.evalAt(one('real', 3, 1, { cs: false, norm: 'orthonormal' }), 1, 0.3)[0]).toBe(SH.evalAt(one('real', 3, 1), 1, 0.3)[0])
  })

  it('have ℓ − |m| nodal latitudes and 2|m| sign changes around the equator', () => {
    for (let l = 0; l <= 8; l++) for (let m = -l; m <= l; m++) {
      const C = one('real', l, m)
      const th = Array.from({ length: 1501 }, (_, i) => 1e-4 + (Math.PI - 2e-4) * i / 1500)
      const down = SH.synth(C, th, [m >= 0 ? 0 : Math.PI / (2 * Math.abs(m))]).re
      let n1 = 0; for (let i = 1; i < down.length; i++) if (down[i] * down[i - 1] < 0) n1++
      const ph = Array.from({ length: 3000 }, (_, j) => 2 * Math.PI * (j + 0.37) / 3000)
      const around = SH.synth(C, [Math.abs(m) === l ? Math.PI / 2 : 1.234567], ph).re
      let n2 = 0; for (let j = 0; j < around.length; j++) if (around[j] * around[(j + 1) % around.length] < 0) n2++
      expect([l, m, n1, n2]).toEqual([l, m, l - Math.abs(m), 2 * Math.abs(m)])
    }
  })
})

describe('closed forms', () => {
  it('print as the textbooks have them', () => {
    expect(SH.closedForm(0, 0, 'complex', CONV).tex).toBe('\\frac{1}{2}\\,\\frac{1}{\\sqrt{\\pi}}')
    expect(SH.closedForm(2, 1, 'complex', CONV).tex).toBe('-\\frac{1}{2}\\,\\sqrt{\\frac{15}{2\\pi}}\\,\\sin\\theta\\,\\cos\\theta\\,e^{i\\varphi}')
    expect(SH.closedForm(3, 0, 'complex', CONV).tex).toBe('\\frac{1}{4}\\,\\sqrt{\\frac{7}{\\pi}}\\,(5\\cos^{3}\\theta - 3\\cos\\theta)')
    expect(SH.closedForm(4, 1, 'complex', CONV).tex).toBe('-\\frac{3}{8}\\,\\sqrt{\\frac{5}{\\pi}}\\,\\sin\\theta\\,(7\\cos^{3}\\theta - 3\\cos\\theta)\\,e^{i\\varphi}')
    expect(SH.closedForm(3, -2, 'real', CONV).cartesian).toBe('\\frac{1}{2}\\,\\sqrt{\\frac{105}{\\pi}}\\,\\frac{xyz}{r^{3}}')
    expect(SH.closedForm(2, 0, 'real', CONV).cartesian).toBe('\\frac{1}{4}\\,\\sqrt{\\frac{5}{\\pi}}\\,\\frac{3z^{2} - r^{2}}{r^{2}}')
    expect(SH.closedForm(3, 1, 'real', CONV).cartesian).toBe('\\frac{1}{4}\\,\\sqrt{\\frac{21}{2\\pi}}\\,\\frac{x(5z^{2} - r^{2})}{r^{3}}')
    expect(SH.closedForm(2, 2, 'real', CONV).name).toBe('d_{x^2-y^2}')
  })

  it('equal the numbers, every ℓ ≤ 7 and m, in every convention', () => {
    let worst = 0
    for (const norm of SH.NORMS) for (const cs of [true, false]) for (const form of ['complex', 'real']) for (let l = 0; l <= 7; l++) for (let m = -l; m <= l; m++) {
      const cf = SH.closedForm(l, m, form, { cs, norm }), C = one(form, l, m, { cs, norm })
      for (const [th, ph] of [[0.3, 0.2], [1.1, 2.5], [2.6, -1.3]]) {
        let p = 0; cf.poly.forEach((c, j) => { p += c * Math.pow(Math.cos(th), j) })
        const mag = cf.prefactor * Math.pow(Math.sin(th), Math.abs(m)) * p
        const want = form === 'real' ? [mag * (m > 0 ? Math.cos(m * ph) : m < 0 ? Math.sin(-m * ph) : 1), 0] : [mag * Math.cos(m * ph), mag * Math.sin(m * ph)]
        const got = SH.evalAt(C, th, ph)
        worst = Math.max(worst, Math.hypot(got[0] - want[0], got[1] - want[1]) / Math.max(1, Math.abs(cf.prefactor)))
      }
    }
    expect(worst).toBeLessThan(1e-10)
  })
})

describe('expansions', () => {
  it('give a cap’s coefficients, matching a brute-force projection', () => {
    const th0 = 0.7, ph0 = 1.1, alpha = 0.5
    const C = SH.capCoefs(th0, ph0, alpha, 6), Q = quadrature(160, 320)
    const n0 = [Math.sin(th0) * Math.cos(ph0), Math.sin(th0) * Math.sin(ph0), Math.cos(th0)]
    const cap = { re: [], im: [] }
    Q.th.forEach(t => Q.ph.forEach(p => {
      const d = Math.sin(t) * Math.cos(p) * n0[0] + Math.sin(t) * Math.sin(p) * n0[1] + Math.cos(t) * n0[2]
      cap.re.push(d > Math.cos(alpha) ? 1 : 0); cap.im.push(0)
    }))
    const Fc = SH.synth(C, Q.th, Q.ph)
    for (const [l, m] of [[0, 0], [1, 1], [2, -1], [3, 2], [6, -5], [6, 0]]) {
      const Y = SH.synth(one('real', l, m), Q.th, Q.ph)
      expect(Math.abs(inner(Q, cap, Y)[0] - inner(Q, Fc, Y)[0])).toBeLessThan(3e-3)
    }
    expect(SH.capCoefs(0, 0, alpha, 0).Ar[0]).toBeCloseTo(2 * Math.PI * (1 - Math.cos(alpha)) / Math.sqrt(4 * Math.PI), 14)
  })

  it('draw a random sky that keeps its large features as ℓmax grows', () => {
    const a = SH.skyCoefs(7, 2, 8, 2), b = SH.skyCoefs(7, 2, 24, 2)
    for (let k = 0; k < a.Ar.length; k++) { expect(b.Ar[k]).toBe(a.Ar[k]); expect(b.Br[k]).toBe(a.Br[k]) }
    expect(a.Ar[SH.idx(0, 0)]).toBe(0)
    expect(a.Ar[SH.idx(1, 1)]).toBe(0)
  })
})

describe('typed sums', () => {
  it('read names, Y_ℓ^m, Y_{ℓ,m}, Y(ℓ,m) and complex coefficients', () => {
    const p = SH.parseExpr('(s + p_x + p_y + p_z)/2', 'complex')
    expect(p.terms.map(t => [t.form, t.l, t.m, t.c[0]])).toEqual([['real', 0, 0, 0.5], ['real', 1, -1, 0.5], ['real', 1, 0, 0.5], ['real', 1, 1, 0.5]])
    expect(SH.termsTex(p.terms)).toBe('\\tfrac{1}{2}\\,s +\\tfrac{1}{2}\\,p_y +\\tfrac{1}{2}\\,p_z +\\tfrac{1}{2}\\,p_x')
    const q = SH.parseExpr('Y(2,1) - i Y(2,-1)', 'complex')
    expect(q.terms.map(t => [t.form, t.m, t.c.map(v => v + 0)])).toEqual([['complex', -1, [0, -1]], ['complex', 1, [1, 0]]])
    expect(SH.parseExpr('Y(2,1)', 'real').terms[0].form).toBe('real')
    const r = SH.parseExpr('d_{x^2-y^2} - d_z2 + Y_3^{-2} + Y_{3,-2}/sqrt(2)', 'complex')
    expect(r.terms.map(t => `${t.form} ${t.l},${t.m}`)).toEqual(['real 2,0', 'real 2,2', 'complex 3,-2', 'real 3,-2'])
    const u = SH.parseExpr('Y(1,1) − Y(1,1) + √2 π p_z', 'real')
    expect(u.terms).toHaveLength(1)
    expect(u.terms[0].c[0]).toBeCloseTo(Math.SQRT2 * Math.PI, 12)
  })

  it('refuse what isn’t a sum of harmonics, saying where', () => {
    expect(SH.parseExpr('Y(2,1) Y(1,0)', 'complex').error).toContain('Clebsch')
    expect(SH.parseExpr('Y(2,3)', 'complex').error).toContain('between')
    expect(SH.parseExpr('3', 'complex').error).toContain('number on its own')
    expect(SH.parseExpr('p_x - p_x', 'complex').error).toContain('cancels')
    expect(SH.parseExpr('p_x + q', 'complex')).toMatchObject({ pos: 6 })
    expect(SH.parseExpr('(p_x', 'complex').error).toContain('never closed')
  })

  it('make an sp³ hybrid point along (1, 1, 1)', () => {
    const F = SH.functionOf({ source: 'sum', expr: '(s + p_x + p_y + p_z)/2', form: 'real' })
    const front = SH.evalAt(F.C, Math.acos(1 / Math.sqrt(3)), Math.PI / 4)[0], back = SH.evalAt(F.C, Math.acos(-1 / Math.sqrt(3)), 5 * Math.PI / 4)[0]
    expect(front / back).toBeCloseTo(-2, 9)
    expect(F.real).toBe(true)
  })
})

describe('maps', () => {
  it('project Mollweide’s way', () => {
    const a = SH.mollweide(0, Math.PI / 2), b = SH.mollweide(Math.PI / 2, 0), c = SH.mollweide(-Math.PI / 4, -Math.PI)
    expect(a[0]).toBeCloseTo(Math.SQRT2, 12); expect(a[1]).toBeCloseTo(0, 12)
    expect(b[1]).toBeCloseTo(Math.SQRT2, 12)
    expect((c[0] / (2 * Math.SQRT2)) ** 2 + (c[1] / Math.SQRT2) ** 2).toBeCloseTo(1, 12)
  })
})

describe('copying it out', () => {
  const state = el => HV.stepState(HV.normalize(el), 0)

  it('writes Python that uses SciPy’s angle order', () => {
    const py = harmonicsPython(state({ source: 'single', l: 3, m: -2, form: 'complex' }))
    expect(py).toContain('from scipy.special import sph_harm_y')
    expect(py).toContain('f = sph_harm_y(3, -2, theta, phi)')
    expect(py).toContain('np.angle(f)')
    const real = harmonicsPython(state({ source: 'sum', expr: '(s + p_z)/sqrt(2)', view: 'map', eastLeft: true }))
    expect(real).toContain('def real_ylm')
    expect(real).toContain('0.70710678 * real_ylm(1, 0, theta, phi)')
    expect(real).toContain('projection="mollweide"')
    expect(real).toContain('-lon')
    expect(harmonicsPython(state({ source: 'single', l: 2, m: 1, cs: false, norm: 'schmidt' }))).toContain('f = -sph_harm_y(2, 1, theta, phi) * np.sqrt(4 * np.pi / 5)')
    expect(harmonicsPython(state({ source: 'cap' }))).toContain('eval_legendre')
    expect(harmonicsPython(state({ source: 'sum', expr: 'q' }))).toMatch(/^# /)
  })

  it('writes TeX with its conventions', () => {
    expect(harmonicsTex(state({ source: 'single', l: 2, m: 1 }))).toBe('% orthonormal, Condon–Shortley phase on\nY_{2}^{1}(\\theta,\\varphi) = -\\frac{1}{2}\\,\\sqrt{\\frac{15}{2\\pi}}\\,\\sin\\theta\\,\\cos\\theta\\,e^{i\\varphi}')
    expect(harmonicsTex(state({ source: 'single', l: 1, m: 1, form: 'real' }))).toContain('= \\frac{1}{2}\\,\\sqrt{\\frac{3}{\\pi}}\\,\\frac{x}{r}')
    expect(conventionsText(state({ norm: 'schmidt', cs: false }))).toBe('Schmidt semi-normalized, Condon–Shortley phase off; θ from +z, φ from +x')
  })
})
