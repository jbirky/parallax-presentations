// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The admin page's (/admin) shared inline styles, in the landing page's look:
// square panels under an ink rule, Archivo headings, small uppercase labels.
// The colors are the tokens .admin-page sets in index.css (ink, or paper in
// the light theme), so the panels in other files (teams, plugins) match.

export const panel = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'inset 0 4px 0 var(--text-primary)', padding: '24px 20px 18px', minWidth: 0 }
export const h2 = { margin: '0 0 4px', fontFamily: 'var(--hp-display)', fontSize: 21, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.015em', color: 'var(--text-primary)' }
// A heading inside a panel: a small uppercase label
export const h3 = { margin: '0 0 8px', fontSize: 11.5, fontWeight: 600, lineHeight: 1.4, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }
export const sub = { margin: '0 0 14px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }
export const th = { textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1.5px solid var(--text-primary)', whiteSpace: 'nowrap' }
export const td = { padding: '10px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'top' }
export const chip = { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }
export const card = { border: '1px solid var(--border)', padding: 12, display: 'grid', gap: 8, minWidth: 0 }
export const input = { background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 8px', fontSize: 13 }
export const error = { color: 'var(--hp-tag)' }
