// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The sample talk's slides on the landing page (PracticeDemo's TALK, which
// "From outline to talk" shows in each step's demo), drawn small in the
// Parallax theme (themes/parallax.css): paper, Archivo titles under the
// mark's three bars, blue square bullets, and a Big Number in stereo. Sizes
// are in cqw, so a slide draws the same at any width.
//
// The first slide is the hero deck's first (examples/decks.js hero(), its
// GALAXY_FIGURE): the title and sentence at the left, the two sliders under
// them, and the rotation curve at the right, drawn here as it stands at the
// sliders' starting values with the figure's own formulas.

// GALAXY_FIGURE's speeds: the disk alone, and the disk with the halo
const GM = 421948, CORE = 3
const px = r => 62 + r / 26 * 516
const py = v => 370 - v / 320 * 346
function speeds(r, haloPct, scalePct) {
  const a = 1.556 * (1.2 + 4.5 * scalePct / 100), flat = 330 * haloPct / 100
  const disk2 = GM * r * r / Math.pow(r * r + a * a, 1.5)
  const halo2 = r > 0 ? flat * flat * (1 - CORE / r * Math.atan(r / CORE)) : 0
  return [Math.sqrt(disk2), Math.sqrt(disk2 + halo2)]
}
export const HALO = 62, SCALE = 38
const CURVE = (() => {
  const d = ['', '']
  let end
  for (let i = 0; i <= 130; i++) {
    const r = i / 5
    end = speeds(r, HALO, SCALE)
    for (let k = 0; k < 2; k++) d[k] += (i ? 'L' : 'M') + px(r).toFixed(1) + ' ' + py(end[k]).toFixed(1)
  }
  const top = Math.min(352, Math.max(18, py(end[1]) - 40))
  return { disk: d[0], total: d[1], totalY: top, diskY: Math.min(362, Math.max(top + 20, py(end[0]) + 28)) }
})()
const MEASURED = [[111.6, 202.4, 185.1, 219.7], [151.3, 124.6, 110.5, 138.6], [200.9, 118.1, 105.1, 131], [250.5, 102.9, 88.9, 117], [300.2, 121.3, 106.2, 136.4],
  [359.7, 111.6, 95.4, 127.8], [419.2, 126.7, 109.4, 144], [478.8, 115.9, 97.5, 134.3], [548.2, 131, 111.6, 150.5]]

function HeroSlide({ slide }) {
  return (
    <div className="lp-mini hero">
      <div className="lp-hs-text">
        <p className="lp-hs-field">{slide.field}</p>
        <h4>{slide.title}</h4>
        <p className="lp-hs-lede">{slide.text}</p>
      </div>
      <div className="lp-hs-controls" aria-hidden="true">
        <span>Dark halo mass<b style={{ '--v': `${HALO}%` }} /></span>
        <span>Disk scale length<b style={{ '--v': `${SCALE}%` }} /></span>
      </div>
      <svg className="lp-hs-chart" viewBox="0 0 600 420" role="img" aria-label="A rotation curve: measured orbital speeds stay flat far from the center, as the disk with a dark halo does, not the visible disk alone">
        <path d="M60 110.5H580M60 197H580M60 283.5H580" stroke="#d9d9d3" strokeWidth="1" />
        <path d="M60 24V370H584" fill="none" stroke="#0c0c0d" strokeWidth="2" />
        <text x="322" y="408" textAnchor="middle" fontSize="16" fill="#3d3d40">Distance from the center</text>
        <text x="24" y="200" textAnchor="middle" fontSize="16" fill="#3d3d40" transform="rotate(-90 24 200)">Orbital speed</text>
        <svg x="60" y="20" width="524" height="350" viewBox="60 20 524 350">
          <path d={CURVE.disk} fill="none" stroke="#9c9c9a" strokeWidth="3" strokeDasharray="8 8" />
          <path d={CURVE.total} fill="none" stroke="#1e60ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <text x="574" y={CURVE.diskY} textAnchor="end" fontSize="15" fill="#66666a">Visible disk alone</text>
        <text x="574" y={CURVE.totalY} textAnchor="end" fontSize="15" fontWeight="600" fill="#1a56e8">Disk + dark halo</text>
        <path d={MEASURED.map(([x, , lo, hi]) => `M${x} ${lo}V${hi}`).join('')} stroke="#ee2b2b" strokeWidth="2" />
        <g fill="#ee2b2b">{MEASURED.map(([x, y]) => <circle key={x} cx={x} cy={y} r="6" />)}</g>
        <g fontSize="15" fill="#3d3d40"><circle cx="86" cy="44" r="6" fill="#ee2b2b" /><text x="100" y="49">Measured speeds</text></g>
      </svg>
    </div>
  )
}

// One of the talk's slides: { kind: 'hero' | 'number' | 'list' | 'refs', … }
export function MiniSlide({ slide }) {
  if (slide.kind === 'hero') return <HeroSlide slide={slide} />
  if (slide.kind === 'number') {
    return (
      <div className="lp-mini number">
        <h4><span>{slide.number}</span><em>{slide.unit}</em></h4>
        <p>{slide.caption}</p>
        <small>{slide.source}</small>
      </div>
    )
  }
  return (
    <div className={`lp-mini${slide.kind === 'refs' ? ' refs' : ''}`}>
      <h4>{slide.title}</h4>
      <ul>{slide.items.map(t => <li key={t}>{t}</li>)}</ul>
    </div>
  )
}
