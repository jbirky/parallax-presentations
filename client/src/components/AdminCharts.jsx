// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Small SVG charts for the admin dashboard: one series each, drawn at the
// container's real width so text never scales.

import { useState, useEffect, useRef } from 'react'

const AXIS_FONT = { fontSize: 11, fill: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

// Clean tick values from 0 up past `max` (1, 2, 2.5 or 5 times a power of ten)
export function niceTicks(max, { count = 4, integer = false } = {}) {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  let step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= raw)
  if (integer) step = Math.max(1, Math.ceil(step))
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Number((i * step).toFixed(10)))
}

// A column with a 4px rounded data end and a square base
function columnPath(x, y, w, h) {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function Tooltip({ x, containerWidth, value, label }) {
  const width = 150
  const left = Math.max(0, Math.min(containerWidth - width, x - width / 2))
  return (
    <div role="status" style={{
      position: 'absolute', top: 0, left, width, pointerEvents: 'none',
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6,
      padding: '6px 10px', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', fontSize: 12, lineHeight: 1.4,
    }}>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</div>
      <div style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  )
}

const MARGIN = { top: 18, right: 12, bottom: 24, left: 40 }

// data: [{ key, label, tooltipLabel, value }]
export function ColumnChart({ data, height = 180, integer = false, formatValue = String, ariaLabel }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState(null)
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotH = height - MARGIN.top - MARGIN.bottom
  const ticks = niceTicks(Math.max(0, ...data.map(d => d.value)), { integer })
  const top = ticks[ticks.length - 1]
  const y = v => MARGIN.top + plotH - (v / top) * plotH
  const band = data.length ? plotW / data.length : 0
  const barW = Math.max(2, Math.min(24, band - 2))
  const xOf = i => MARGIN.left + i * band + (band - barW) / 2
  // Label every k-th column, counting back from the latest so it's always labeled
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 64))))
  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0)
  const direct = new Set([data.length - 1, maxIndex].filter(i => data[i] && data[i].value > 0))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block', overflow: 'visible' }}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
              <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end" style={AXIS_FONT}>{formatValue(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (
            <g key={d.key}>
              <path d={columnPath(xOf(i), y(d.value), barW, y(0) - y(d.value))}
                fill={active === i ? 'var(--accent-hover)' : 'var(--accent)'} />
              {direct.has(i) && (
                <text x={xOf(i) + barW / 2} y={y(d.value) - 6} textAnchor="middle"
                  style={{ ...AXIS_FONT, fill: 'var(--text-secondary)' }}>{formatValue(d.value)}</text>
              )}
              {(data.length - 1 - i) % every === 0 && (
                <text x={xOf(i) + barW / 2} y={height - 6} textAnchor="middle" style={AXIS_FONT}>{d.label}</text>
              )}
              {/* The whole column is the hover target, not just the painted bar */}
              <rect x={MARGIN.left + i * band} y={MARGIN.top} width={band} height={plotH} fill="transparent"
                tabIndex={0} aria-label={`${d.tooltipLabel || d.label}: ${formatValue(d.value)}`}
                onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)} onBlur={() => setActive(null)} style={{ outline: 'none', cursor: 'default' }} />
            </g>
          ))}
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip x={xOf(active) + barW / 2} containerWidth={width}
          value={formatValue(data[active].value)} label={data[active].tooltipLabel || data[active].label} />
      )}
    </div>
  )
}

// points: [{ t (ms), value }], oldest first
export function LineChart({ points, height = 180, formatValue = String, formatTime, ariaLabel, emptyText }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState(null)
  if (points.length < 2) {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '0 16px' }}>
          {emptyText}
        </div>
      </div>
    )
  }
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotH = height - MARGIN.top - MARGIN.bottom
  const ticks = niceTicks(Math.max(...points.map(p => p.value)))
  const top = ticks[ticks.length - 1]
  const t0 = points[0].t
  const span = Math.max(1, points[points.length - 1].t - t0)
  const x = t => MARGIN.left + ((t - t0) / span) * plotW
  const y = v => MARGIN.top + plotH - (v / top) * plotH
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const area = `${line}L${x(points[points.length - 1].t).toFixed(1)},${y(0)}L${x(t0).toFixed(1)},${y(0)}Z`
  const last = points[points.length - 1]
  const timeTicks = [points[0], points[Math.floor(points.length / 2)], last]

  function nearest(clientX, rect) {
    const t = t0 + ((clientX - rect.left - MARGIN.left) / plotW) * span
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i
    return best
  }
  function onKeyDown(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const current = active ?? points.length - 1
    setActive(Math.max(0, Math.min(points.length - 1, current + (e.key === 'ArrowLeft' ? -1 : 1))))
  }
  const shown = active !== null ? points[active] : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} tabIndex={0} onKeyDown={onKeyDown}
          onFocus={() => setActive(points.length - 1)} onBlur={() => setActive(null)}
          onPointerMove={e => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(null)} style={{ display: 'block', overflow: 'visible', outline: 'none' }}>
          {ticks.map(v => (
            <g key={v}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
              <text x={MARGIN.left - 8} y={y(v)} dy="0.32em" textAnchor="end" style={AXIS_FONT}>{formatValue(v)}</text>
            </g>
          ))}
          {timeTicks.map((p, i) => (
            <text key={i} x={x(p.t)} y={height - 6} textAnchor={['start', 'middle', 'end'][i]} style={AXIS_FONT}>{formatTime(p.t)}</text>
          ))}
          <path d={area} fill="var(--accent)" fillOpacity="0.1" />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {shown && <line x1={x(shown.t)} x2={x(shown.t)} y1={MARGIN.top} y2={y(0)} stroke="var(--text-muted)" strokeWidth="1" />}
          {(shown ? [shown] : [last]).map(p => (
            <circle key={p.t} cx={x(p.t)} cy={y(p.value)} r="4" fill="var(--accent)" stroke="var(--bg-secondary)" strokeWidth="2" />
          ))}
          {!shown && (
            <text x={x(last.t) - 8} y={y(last.value) - 10} textAnchor="end" style={{ ...AXIS_FONT, fill: 'var(--text-secondary)' }}>
              {formatValue(last.value)}
            </text>
          )}
        </svg>
      )}
      {shown && <Tooltip x={x(shown.t)} containerWidth={width} value={formatValue(shown.value)} label={formatTime(shown.t)} />}
    </div>
  )
}
