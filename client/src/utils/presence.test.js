import { describe, it, expect } from 'vitest'
import {
  colorFor, PRESENCE_COLORS, peersFrom, distinctPeople, peopleBySlide, elementsInUse, editorOf, shouldLetGo, editingMessage,
} from './presence'

const people = [
  { id: 'u-ada', name: 'Ada', email: 'ada@example.com', avatarUrl: 'https://img/ada', role: 'owner' },
  { id: 'u-ed', name: '', email: 'ed@example.com', role: 'editor' },
  { id: 'u-me', name: 'Me', email: 'me@example.com', role: 'editor' },
]
const states = entries => new Map(entries)

describe('presence', () => {
  it('gives each person the same color everywhere', () => {
    expect(colorFor('u-ada')).toBe(colorFor('u-ada'))
    expect(PRESENCE_COLORS).toContain(colorFor('u-ed'))
  })

  it('names the other tabs from the people list, and leaves out this one', () => {
    const peers = peersFrom(states([
      [5, { user: 'u-me', slide: 's1', selected: [], editing: null }],
      [9, { user: 'u-ada', slide: 's2', selected: ['e1'], editing: 'e1' }],
      [3, { user: 'u-ed', slide: 's1' }],
      [7, { user: 'u-stranger', slide: 's1' }],
      [8, {}],
      [2, { user: 'u-me', slide: 's3' }],
    ]), 5, people, 'u-me')
    expect(peers.map(p => [p.clientId, p.name, p.self])).toEqual([
      [2, 'Me', true], [3, 'ed@example.com', false], [7, 'Someone', false], [9, 'Ada', false],
    ])
    expect(peers.find(p => p.clientId === 9)).toMatchObject({ avatarUrl: 'https://img/ada', editing: 'e1', selected: ['e1'], known: true })
    expect(peers.find(p => p.clientId === 7).known).toBe(false)
    expect(peers.find(p => p.clientId === 3).selected).toEqual([])
  })

  it('shows each person once, by the tab that’s editing', () => {
    const peers = peersFrom(states([
      [1, { user: 'u-ada', slide: 's1' }],
      [2, { user: 'u-ada', slide: 's2', editing: 'e3' }],
      [3, { user: 'u-ed', slide: 's1' }],
    ]), 99, people)
    expect(distinctPeople(peers).map(p => [p.userId, p.clientId])).toEqual([['u-ada', 2], ['u-ed', 3]])
    const bySlide = peopleBySlide(peers)
    expect(bySlide.get('s1').map(p => p.userId)).toEqual(['u-ada', 'u-ed'])
    expect(bySlide.get('s2').map(p => p.userId)).toEqual(['u-ada'])
  })

  it('knows which elements on a slide others have selected or open', () => {
    const peers = peersFrom(states([
      [1, { user: 'u-ada', slide: 's1', selected: ['e1', 'e2'], editing: 'e1' }],
      [2, { user: 'u-ed', slide: 's1', selected: ['e2'] }],
      [3, { user: 'u-ed', slide: 's2', selected: ['e9'] }],
    ]), 99, people)
    const inUse = elementsInUse(peers, 's1')
    expect([...inUse.keys()].sort()).toEqual(['e1', 'e2'])
    expect(inUse.get('e1').editing.name).toBe('Ada')
    expect(inUse.get('e2').people.map(p => p.name)).toEqual(['Ada', 'ed@example.com'])
    expect(inUse.get('e2').editing).toBeNull()
    expect(editorOf(peers, 'e1').name).toBe('Ada')
    expect(editorOf(peers, 'e2')).toBeNull()
    expect(editorOf(peers, null)).toBeNull()
  })

  it('lets the tab with the lower client id keep an element two opened at once', () => {
    const peers = peersFrom(states([[4, { user: 'u-ada', editing: 'e1' }]]), 6, people)
    expect(shouldLetGo(peers, 6, 'e1')).toBe(true)
    expect(shouldLetGo(peers, 3, 'e1')).toBe(false)
    expect(shouldLetGo(peers, 6, 'e2')).toBe(false)
  })

  it('says who’s editing', () => {
    expect(editingMessage({ name: 'Ada', self: false })).toBe('Ada is editing this')
    expect(editingMessage({ name: 'Me', self: true })).toBe("You're editing this in another tab")
  })
})
