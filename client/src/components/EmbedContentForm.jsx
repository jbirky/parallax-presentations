// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The form for an HTML embed's content block (utils/embedContent.js): words
// as text boxes, numbers as number boxes, lists one item per line, and lists
// of records as tables whose rows can be added, moved and removed.

import { useEffect, useState } from 'react'
import { blankRow, fieldKind, fieldLabel, listToText, tableColumns, textToList } from '../utils/embedContent'

const input = { width: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: 12, padding: '4px 6px' }
// Text areas grow with their words where the browser can (field-sizing)
const area = { ...input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, fieldSizing: 'content', minHeight: '2.6em', maxHeight: 220 }
const muted = { fontSize: 11, color: 'var(--text-muted)' }
const iconBtn = { background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: '3px 5px' }

// A number box that lets a half-typed number ("-", "1.") be, and changes the
// value only when what's typed is a number
function NumberInput({ value, onChange, label }) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(t => (Number(t) === value && t.trim() !== '' ? t : String(value))) }, [value])
  return (
    <input className="prop-input" type="text" size={1} inputMode="decimal" aria-label={label} value={text} style={{ ...input, fontVariantNumeric: 'tabular-nums' }}
      onChange={e => { const t = e.target.value; setText(t); const n = Number(t); if (t.trim() !== '' && Number.isFinite(n)) onChange(n) }}
      onBlur={() => setText(String(value))} />
  )
}

// Anything the form has no box for, as JSON, taken once it parses
function JsonInput({ value, onChange, label }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  const [bad, setBad] = useState(false)
  useEffect(() => {
    setText(t => {
      try { if (JSON.stringify(JSON.parse(t)) === JSON.stringify(value)) return t } catch { /* replaced below */ }
      return JSON.stringify(value, null, 2)
    })
    setBad(false)
  }, [value])
  return (
    <>
      <textarea className="prop-input" aria-label={label} spellCheck={false} value={text}
        rows={Math.min(8, text.split('\n').length)}
        style={{ ...area, fontFamily: "'JetBrains Mono', monospace", borderColor: bad ? 'var(--danger)' : undefined }}
        onChange={e => {
          setText(e.target.value)
          try { onChange(JSON.parse(e.target.value)); setBad(false) } catch { setBad(true) }
        }} />
      {bad && <div style={{ ...muted, color: 'var(--danger)' }}>Not valid JSON yet: the last valid value is kept</div>}
    </>
  )
}

// A list of words or numbers, one per line
function ListInput({ value, onChange, label }) {
  const [text, setText] = useState(() => listToText(value))
  useEffect(() => { setText(t => (JSON.stringify(textToList(t, value)) === JSON.stringify(value) ? t : listToText(value))) }, [value])
  return (
    <textarea className="prop-input" aria-label={label} value={text} rows={Math.max(2, Math.min(6, (value || []).length + 1))} style={area}
      placeholder="One per line"
      onChange={e => { setText(e.target.value); onChange(textToList(e.target.value, value)) }} />
  )
}

// One value's box, chosen by what the value is
function Field({ value, onChange, label, fieldKey, labels, choices, compact = false }) {
  const kind = fieldKind(value, choices?.[fieldKey])
  switch (kind) {
    case 'text':
      return <input className="prop-input" type="text" size={1} aria-label={label} value={value} style={input} onChange={e => onChange(e.target.value)} />
    case 'longtext':
      return <textarea className="prop-input" aria-label={label} value={value} rows={compact ? Math.min(4, Math.ceil(value.length / 48)) : Math.min(6, Math.ceil(value.length / 70) + 1)} style={area} onChange={e => onChange(e.target.value)} />
    case 'number':
      return <NumberInput value={value} onChange={onChange} label={label} />
    case 'boolean':
      return <input type="checkbox" aria-label={label} checked={value} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
    case 'choice': {
      const options = choices[fieldKey].includes(value) ? choices[fieldKey] : [value, ...choices[fieldKey]]
      return (
        <select className="prop-input" aria-label={label} value={String(value)} style={input}
          onChange={e => onChange(options.find(o => String(o) === e.target.value))}>
          {options.map(o => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
        </select>
      )
    }
    case 'list':
      return <ListInput value={value} onChange={onChange} label={label} />
    case 'table':
      return <TableField rows={value} onChange={onChange} label={label} labels={labels} choices={choices} />
    case 'group':
      return <Group data={value} onChange={onChange} labels={labels} choices={choices} nested />
    default:
      return <JsonInput value={value} onChange={onChange} label={label} />
  }
}

// How wide a table's column is, relative to the others, and its narrowest in
// px: by the kind of value, and for words by the longest in the column
function columnSize(rows, k, choices) {
  const values = rows.map(r => r[k]).filter(v => v !== undefined)
  const kind = fieldKind(values[0], choices?.[k])
  const longest = list => Math.max(0, ...list.map(v => String(v ?? '').length))
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  if (kind === 'number') return { weight: clamp(longest(values) / 4, 1, 1.6), min: 56 }
  if (kind === 'boolean') return { weight: 0.5, min: 36 }
  if (kind === 'choice') return { weight: clamp(longest(choices[k]) / 9, 1, 2), min: 100 }
  if (kind === 'text') return { weight: clamp(longest(values) / 6, 1.3, 3), min: 72 }
  return { weight: 4, min: 180 }
}

// Rows of records: a column per key, and buttons to add, move and remove rows
function TableField({ rows, onChange, label, labels, choices }) {
  const cols = tableColumns(rows)
  const sizes = cols.map(k => columnSize(rows, k, choices))
  const total = sizes.reduce((a, c) => a + c.weight, 0) || 1
  const minWidth = sizes.reduce((a, c) => a + c.min, 0) + 84
  const setCell = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const move = (i, d) => { const next = rows.slice(); [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next) }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12 }} aria-label={label}>
        <colgroup>
          {cols.map((k, i) => <col key={k} style={{ width: `${(100 * sizes[i].weight / total).toFixed(2)}%` }} />)}
          <col style={{ width: 84 }} />
        </colgroup>
        <thead>
          <tr>
            {cols.map(k => <th key={k} style={{ ...muted, fontWeight: 600, textAlign: 'left', padding: '0 4px 4px', verticalAlign: 'bottom', overflowWrap: 'break-word' }}>{fieldLabel(k, labels)}</th>)}
            <th aria-label="Row" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ verticalAlign: 'top', borderTop: '1px solid var(--border)' }}>
              {cols.map(k => (
                <td key={k} style={{ padding: 4 }}>
                  {k in row
                    ? <Field value={row[k]} onChange={v => setCell(i, k, v)} label={`${fieldLabel(k, labels)}, row ${i + 1}`} fieldKey={k} labels={labels} choices={choices} compact />
                    : <button type="button" style={iconBtn} onClick={() => setCell(i, k, '')}>+ add</button>}
                </td>
              ))}
              <td style={{ padding: 4, whiteSpace: 'nowrap' }}>
                <button type="button" style={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move row ${i + 1} up`} title="Move up">↑</button>{' '}
                <button type="button" style={iconBtn} disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move row ${i + 1} down`} title="Move down">↓</button>{' '}
                <button type="button" style={iconBtn} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove row ${i + 1}`} title="Remove">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px', marginTop: 4 }}
        onClick={() => onChange([...rows, blankRow(rows, choices)])}>+ Add row</button>
    </div>
  )
}

// Named fields, one under another; keys starting with $ are the form's settings
function Group({ data, onChange, labels, choices, nested = false }) {
  const keys = Object.keys(data).filter(k => !k.startsWith('$'))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: nested ? 8 : 14, ...(nested ? { borderLeft: '2px solid var(--border)', paddingLeft: 10 } : {}) }}>
      {keys.map(k => {
        const label = fieldLabel(k, labels)
        const kind = fieldKind(data[k], choices?.[k])
        return (
          <div key={k}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {label}{kind === 'list' && <span style={{ ...muted, fontWeight: 400 }}> · one per line</span>}
            </div>
            <Field value={data[k]} onChange={v => onChange({ ...data, [k]: v })} label={label} fieldKey={k} labels={labels} choices={choices} />
          </div>
        )
      })}
    </div>
  )
}

export default function EmbedContentForm({ data, onChange }) {
  const labels = data.$labels && typeof data.$labels === 'object' ? data.$labels : null
  const choices = data.$choices && typeof data.$choices === 'object' ? data.$choices : null
  if (!Object.keys(data).some(k => !k.startsWith('$'))) return <p style={muted}>The content block is empty.</p>
  return <Group data={data} onChange={onChange} labels={labels} choices={choices} />
}
