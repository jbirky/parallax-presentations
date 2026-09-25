// Writes server/services/click-actions.js, the server's copy of the click
// actions in client/src/utils/clickActions.js: everything above "Editor
// helpers", turned into CommonJS, for the pages the server builds. Run after
// changing that part of clickActions.js:
//
//   node scripts/copy-click-actions.js
//
// client/src/utils/clickActions.test.js fails when the copy is out of date.

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const SOURCE = path.join(root, 'client/src/utils/clickActions.js')
const TARGET = path.join(root, 'server/services/click-actions.js')
const END = '// ── Editor helpers'

function serverCopy(source) {
  const shared = source.slice(0, source.indexOf(END)).trimEnd()
  const names = [...shared.matchAll(/^export (?:function|const) (\w+)/gm)].map(m => m[1])
  const body = shared.replace(/^export (function|const) /gm, '$1 ')
  return `${body.replace(
    /^(\/\/ Copyright[^\n]*\n)/m,
    '$1\n// Written by scripts/copy-click-actions.js from client/src/utils/clickActions.js;\n// edit that, then run the script.\n'
  )}\n\nmodule.exports = { ${names.join(', ')} }\n`
}

module.exports = { serverCopy, SOURCE, TARGET }

if (require.main === module) {
  fs.writeFileSync(TARGET, serverCopy(fs.readFileSync(SOURCE, 'utf8')))
  console.log(`Wrote ${path.relative(root, TARGET)}`)
}
