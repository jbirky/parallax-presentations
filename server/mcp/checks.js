// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Checking the values an AI collaborator sends (edits.js, guides.js): each
// returns the value, cleaned, or undefined when it wasn't given, and throws
// an EditError saying what's wrong and what would do.

class EditError extends Error {}
const fail = message => { throw new EditError(message) }

function num(value, name, min, max) {
  if (value === undefined) return undefined
  const n = typeof value === 'string' && value.trim() ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) fail(`${name} must be a number from ${min} to ${max}.`)
  return Math.round(n * 100) / 100
}

const int = (value, name, min, max) => {
  const n = num(value, name, min, max)
  if (n !== undefined && !Number.isInteger(n)) fail(`${name} must be a whole number from ${min} to ${max}.`)
  return n
}

function str(value, name, max, { min = 0, pattern = null, hint = '' } = {}) {
  if (value === undefined) return undefined
  if (typeof value !== 'string') fail(`${name} must be text.`)
  const s = value.trim()
  if (s.length < min || s.length > max) fail(min ? `${name} must be 1 to ${max} characters.` : `${name} can be up to ${max} characters.`)
  if (s && pattern && !pattern.test(s)) fail(`${name} ${hint}`)
  return s
}

// Hex, rgb() or rgba(), or a CSS color name
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\)|[a-z]{3,20})$/i
const color = (value, name) => str(value, name, 40, { min: 1, pattern: COLOR, hint: 'must be a color such as "#1f6feb", "rgba(0,0,0,0.5)" or "none".' })

function oneOf(value, name, options) {
  if (value === undefined) return undefined
  if (!options.includes(value)) fail(`${name} must be one of: ${options.join(', ')}.`)
  return value
}

function bool(value, name) {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') fail(`${name} must be true or false.`)
  return value
}

function list(value, name, max) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) fail(`${name} must be a list.`)
  if (value.length > max) fail(`${name} can have up to ${max} items.`)
  return value
}

function object(value, name) {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object.`)
  return value
}

// An object's fields, refused when it has any but `allowed`
function only(value, name, allowed) {
  const unknown = Object.keys(value).filter(k => !allowed.includes(k))
  if (unknown.length) fail(`${name} has ${unknown.map(k => JSON.stringify(k)).join(', ')}, which it doesn't take. It takes: ${allowed.join(', ')}.`)
  return value
}

module.exports = { EditError, fail, num, int, str, COLOR, color, oneOf, bool, list, object, only }
