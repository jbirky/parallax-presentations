// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Who else has a live presentation open, and what they're doing in it. Each
// editor's tab shares its state through the live connection's awareness
// (utils/liveDeck.js), a small state per tab that everyone connected sees,
// gone when the tab disconnects:
//
//   { user: user id, slide: slide id, selected: [element ids],
//     editing: element id | null }  // a text box being typed in, or an
//                                   // element whose editor is open
//
// Names, pictures and colors come from the presentation's people list
// (api.getCollaborators), looked up by user id, not from what a tab says.
// Editing an element holds it: others can't open it until it's let go.
// That's kept by the editor, not the server.

// Easy to tell apart on the editor's dark background, and none of them the
// accent the editor uses for its own selection
export const PRESENCE_COLORS = ['#f97316', '#22c55e', '#ec4899', '#06b6d4', '#eab308', '#a855f7', '#ef4444', '#14b8a6']

export function colorFor(userId) {
  let hash = 0
  for (const ch of String(userId || '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length]
}

// The other tabs, from awareness states (client id → state), as
// { clientId, userId, name, avatarUrl, color, self, slide, selected, editing }.
// `self` marks this user's own other tabs. Tabs that haven't said who they
// are yet are left out.
export function peersFrom(states, ownClientId, people = [], you = null) {
  const byId = new Map(people.map(p => [p.id, p]))
  const peers = []
  for (const [clientId, state] of states) {
    if (clientId === ownClientId || !state?.user) continue
    const person = byId.get(state.user)
    peers.push({
      clientId,
      userId: state.user,
      name: person ? (person.name || person.email) : 'Someone',
      avatarUrl: person?.avatarUrl || '',
      color: colorFor(state.user),
      self: state.user === you,
      known: !!person,
      slide: state.slide || null,
      selected: Array.isArray(state.selected) ? state.selected : [],
      editing: state.editing || null,
    })
  }
  return peers.sort((a, b) => a.clientId - b.clientId)
}

// Each person once, for avatars: their tab that's editing something first
export function distinctPeople(peers) {
  const seen = new Map()
  for (const peer of peers) {
    const had = seen.get(peer.userId)
    if (!had || (!had.editing && peer.editing)) seen.set(peer.userId, peer)
  }
  return [...seen.values()]
}

// Slide id → the people on it, each once
export function peopleBySlide(peers) {
  const slides = new Map()
  for (const peer of peers) {
    if (!peer.slide) continue
    if (!slides.has(peer.slide)) slides.set(peer.slide, [])
    const list = slides.get(peer.slide)
    if (!list.some(p => p.userId === peer.userId)) list.push(peer)
  }
  return slides
}

// On one slide: element id → { people: who has it selected or open, each
// once, editing: who has it open, or null }
export function elementsInUse(peers, slideId) {
  const elements = new Map()
  const entry = id => {
    if (!elements.has(id)) elements.set(id, { people: [], editing: null })
    return elements.get(id)
  }
  for (const peer of peers) {
    if (peer.slide !== slideId) continue
    for (const id of new Set([...peer.selected, ...(peer.editing ? [peer.editing] : [])])) {
      const use = entry(id)
      if (!use.people.some(p => p.userId === peer.userId)) use.people.push(peer)
      if (peer.editing === id && !use.editing) use.editing = peer
    }
  }
  return elements
}

// Who has element id open, other than this tab: the first of them, or null
export function editorOf(peers, elementId) {
  return (elementId && peers.find(p => p.editing === elementId)) || null
}

// Two tabs that open the same element at the same moment both think it's
// free. The one with the lower client id keeps it; this tab should let go
// when that's someone else.
export function shouldLetGo(peers, ownClientId, elementId) {
  return !!elementId && peers.some(p => p.editing === elementId && p.clientId < ownClientId)
}

// "Alex is editing this" / "You're editing this in another tab"
export function editingMessage(peer) {
  return peer.self ? "You're editing this in another tab" : `${peer.name} is editing this`
}
