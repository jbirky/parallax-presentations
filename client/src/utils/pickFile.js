// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The browser's file picker, from a menu or toolbar click, without a hidden
// <input> in the page: calls `onFile` with the file picked, if one is. Call it
// from the click itself, as browsers open the picker only for a user's action.

export function pickFile(accept, onFile) {
  const input = document.createElement('input')
  input.type = 'file'
  if (accept) input.accept = accept
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) onFile(file)
  }
  input.click()
}
