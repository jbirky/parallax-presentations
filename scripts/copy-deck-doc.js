// Writes server/services/deck-doc.js, the server's copy of the deck model in
// client/src/utils/deckDoc.js: everything above "The editor's deck", turned
// into CommonJS. The server needs it as CommonJS so it shares one copy of
// yjs with Hocuspocus. Run after changing that part of deckDoc.js:
//
//   node scripts/copy-deck-doc.js
//
// client/src/utils/deckDocServer.test.js fails when the copy is out of date.

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const SOURCE = path.join(root, 'client/src/utils/deckDoc.js')
const TARGET = path.join(root, 'server/services/deck-doc.js')
const END = '// ── The editor\'s deck'

function serverCopy(source) {
  const model = source.slice(0, source.indexOf(END)).trimEnd()
  const names = [...model.matchAll(/^export (?:function|const) (\w+)/gm)].map(m => m[1])
  const body = model
    .replace("import * as Y from 'yjs'", "const Y = require('yjs')")
    .replace(/^export (function|const) /gm, '$1 ')
  return `${body.replace(
    /^(\/\/ Copyright[^\n]*\n)/m,
    '$1\n// Written by scripts/copy-deck-doc.js from client/src/utils/deckDoc.js; edit\n// that, then run the script.\n'
  )}\n\nmodule.exports = { ${names.join(', ')} }\n`
}

module.exports = { serverCopy, SOURCE, TARGET }

if (require.main === module) {
  fs.writeFileSync(TARGET, serverCopy(fs.readFileSync(SOURCE, 'utf8')))
  console.log(`Wrote ${path.relative(root, TARGET)}`)
}
