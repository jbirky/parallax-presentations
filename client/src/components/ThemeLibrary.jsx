// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The Themes panel's My themes: the themes this person saved (/api/themes,
// utils/customTheme.js). Clicking one applies it to the deck, which keeps a
// copy; Save as theme saves the deck's look, Save changes updates the theme
// the deck came from, and a newer saved version is offered as an update.
// Themes go to and from .json files with Export and Import.
//
// In a team's deck, team.id set, the team's themes are listed too (Team
// themes): its owner, admins and members save to them, and change or delete
// them (members only what they saved). One of yours can be copied to the team.

import { useEffect, useRef, useState } from 'react'
import { Download, Trash2, Upload, Plus, RefreshCw, Save, Check, Users } from 'lucide-react'
import { api } from '../utils/api'
import { deckTheme } from '../utils/themes'
import { deckFont } from '../utils/deckFont'
import { themeDocFromDeck, themeDiffers, themeFileText, readThemeFile, themeFileName } from '../utils/customTheme'

// A theme's colors and fonts, small
function Chip({ doc }) {
  const t = deckTheme(doc.base, doc.colors)
  const style = t.backgroundCss ? { background: t.backgroundCss } : { backgroundColor: t.background }
  return (
    <span className="theme-lib-chip" style={style} aria-hidden="true">
      <span style={{ color: t.heading, fontFamily: deckFont(doc.textStyles?.headingFont || doc.font || t.font), fontWeight: doc.textStyles?.headingWeight || 700 }}>Aa</span>
      <span className="theme-lib-chip-bar" style={{ background: t.accent }} />
    </span>
  )
}

const ADDERS = ['owner', 'admin', 'member']

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ThemeLibrary({ deck, onApply, onSource, team = null }) {
  const [themes, setThemes] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const teamId = team?.id || null

  useEffect(() => {
    let live = true
    api.listThemes(teamId || undefined).then(list => { if (live) setThemes(Array.isArray(list) ? list : []) }, err => { if (live) { setThemes([]); setError(err.message) } })
    return () => { live = false }
  }, [teamId])

  const canAdd = !!teamId && ADDERS.includes(team.role)
  const canChange = theme => !theme.teamId || team?.role === 'owner' || team?.role === 'admin' || (team?.role === 'member' && theme.createdBy === team.you)
  const mine = (themes || []).filter(t => !t.teamId)
  const teams = (themes || []).filter(t => t.teamId)

  const source = deck?.themeSource
  const saved = source && themes?.find(t => t.id === source.id)
  const newer = saved && saved.version > (source.version || 0)
  const changed = saved && !newer && canChange(saved) && themeDiffers(deck, saved)
  const where = saved?.teamId ? 'the team’s library' : 'your library'

  const act = async work => {
    setBusy(true)
    setError('')
    try { await work() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const replace = theme => setThemes(list => [...(list || []).filter(t => t.id !== theme.id), theme].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })))

  const saveAs = (toTeam = false) => {
    const name = window.prompt(toTeam ? 'Name this theme for the team' : 'Name this theme', source?.name ? `${source.name} copy` : `${deck?.title || 'My'} theme`)
    if (!name || !name.trim()) return
    act(async () => {
      const doc = themeDocFromDeck(deck, name)
      const theme = toTeam ? await api.createTeamTheme(teamId, doc) : await api.createTheme(doc)
      replace(theme)
      onSource({ id: theme.id, name: theme.name, version: theme.version })
    })
  }
  const saveChanges = () => act(async () => {
    const doc = themeDocFromDeck(deck, saved.name)
    const theme = saved.teamId ? await api.updateTeamTheme(saved.teamId, saved.id, doc) : await api.updateTheme(saved.id, doc)
    replace(theme)
    onSource({ id: theme.id, name: theme.name, version: theme.version })
  })
  const update = () => {
    if (!window.confirm(`Use the newest “${saved.name}” from ${where}? It replaces this deck’s colors, fonts, text styles and stylesheet.`)) return
    onApply(saved, saved)
  }
  const remove = theme => {
    if (!window.confirm(`Delete “${theme.name}” from ${theme.teamId ? 'the team’s library' : 'your library'}? Decks that use it keep their copy.`)) return
    act(async () => {
      if (theme.teamId) await api.deleteTeamTheme(theme.teamId, theme.id)
      else await api.deleteTheme(theme.id)
      setThemes(list => list.filter(t => t.id !== theme.id))
    })
  }
  const copyToTeam = theme => act(async () => {
    const { id, version, createdAt, updatedAt, ...doc } = theme
    replace(await api.createTeamTheme(teamId, doc))
  })
  const importFile = file => act(async () => {
    const doc = readThemeFile(await file.text())
    const theme = await api.createTheme(doc)
    replace(theme)
    onApply(theme, theme)
  })

  const row = theme => {
    const current = source?.id === theme.id
    return (
      <li key={theme.id} className={current ? 'current' : undefined}>
        <button type="button" className="theme-lib-apply" onClick={() => onApply(theme, theme)} disabled={busy}
          title={theme.creatorName ? `Use “${theme.name}” in this deck (saved by ${theme.creatorName})` : `Use “${theme.name}” in this deck`} aria-current={current || undefined}>
          <Chip doc={theme} />
          <span className="theme-lib-name">{theme.name}</span>
          {current && <Check size={12} aria-label="In this deck" />}
        </button>
        {canAdd && !theme.teamId && (
          <button type="button" className="btn-icon" onClick={() => copyToTeam(theme)} disabled={busy} title={`Copy “${theme.name}” to the team’s themes`} aria-label={`Copy ${theme.name} to the team`}><Users size={12} /></button>
        )}
        <button type="button" className="btn-icon" onClick={() => download(themeFileName(theme.name), themeFileText(theme))} title={`Export “${theme.name}”`} aria-label={`Export ${theme.name}`}><Download size={12} /></button>
        {canChange(theme) && (
          <button type="button" className="btn-icon" onClick={() => remove(theme)} disabled={busy} title={`Delete “${theme.name}”`} aria-label={`Delete ${theme.name}`}><Trash2 size={12} /></button>
        )}
      </li>
    )
  }
  return (
    <section className="theme-lib" aria-label="My themes">
      <div className="theme-lib-head">
        <h4 className="text-styles-heading" style={{ margin: 0 }}>My themes</h4>
        <div className="theme-lib-actions">
          <button type="button" className="btn-icon" onClick={() => saveAs()} disabled={busy} title="Save this deck’s look as a theme" aria-label="Save as theme"><Plus size={14} /></button>
          <button type="button" className="btn-icon" onClick={() => fileRef.current?.click()} disabled={busy} title="Import a theme from a .json file" aria-label="Import theme"><Upload size={13} /></button>
          <button type="button" className="btn-icon" onClick={() => download(themeFileName(source?.name || deck?.title), themeFileText(themeDocFromDeck(deck, source?.name || `${deck?.title || 'Deck'} theme`)))}
            title="Export this deck’s look as a .json file" aria-label="Export this deck’s theme"><Download size={13} /></button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f) }} />
        </div>
      </div>
      {newer && (
        <div className="theme-lib-notice" role="status">
          <span>“{saved.name}” has changed in {where}.</span>
          <button type="button" className="theme-css-link" onClick={update}><RefreshCw size={11} /> Update</button>
        </div>
      )}
      {changed && (
        <button type="button" className="btn btn-secondary theme-lib-save" onClick={saveChanges} disabled={busy}>
          <Save size={12} /> Save changes to “{saved.name}”
        </button>
      )}
      {error && <p className="theme-lib-error" role="alert">{error}</p>}
      {themes === null ? (
        <p className="prop-hint">Loading…</p>
      ) : mine.length === 0 ? (
        <p className="prop-hint">Save this deck’s look, its colors, fonts, text styles and CSS, to use it in your other decks.</p>
      ) : (
        <ul className="theme-lib-list">{mine.map(row)}</ul>
      )}
      {teamId && themes !== null && (
        <>
          <div className="theme-lib-head theme-lib-team-head">
            <h4 className="text-styles-heading" style={{ margin: 0 }}>Team themes</h4>
            {canAdd && (
              <div className="theme-lib-actions">
                <button type="button" className="btn-icon" onClick={() => saveAs(true)} disabled={busy} title="Save this deck’s look to the team’s themes" aria-label="Save to the team’s themes"><Plus size={14} /></button>
              </div>
            )}
          </div>
          {teams.length === 0 ? (
            <p className="prop-hint">{canAdd ? 'Themes saved here are for everyone in the team.' : 'The team hasn’t saved any themes yet.'}</p>
          ) : (
            <ul className="theme-lib-list">{teams.map(row)}</ul>
          )}
        </>
      )}
    </section>
  )
}
