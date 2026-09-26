// Writes the server's copies of the click actions and shape geometry in
// client/src/utils, for the pages the server builds: everything above
// "Editor helpers" in clickActions.js, and all of shapeGeometry.js, turned
// into CommonJS. Run after changing those parts:
//
//   node scripts/copy-click-actions.js
//
// client/src/utils/clickActions.test.js fails when a copy is out of date.

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const COPIES = [
  { source: 'client/src/utils/clickActions.js', target: 'server/services/click-actions.js', end: '// ── Editor helpers' },
  { source: 'client/src/utils/shapeGeometry.js', target: 'server/services/shape-geometry.js' },
].map(copy => ({ ...copy, SOURCE: path.join(root, copy.source), TARGET: path.join(root, copy.target) }))
// What the copies import from each other
const REQUIRES = { './shapeGeometry': './shape-geometry' }

function serverCopy(source, copy = COPIES[0]) {
  const shared = (copy.end ? source.slice(0, source.indexOf(copy.end)) : source).trimEnd()
  const names = [...shared.matchAll(/^export (?:function|const) (\w+)/gm)].map(m => m[1])
  const body = shared
    .replace(/^export (function|const) /gm, '$1 ')
    .replace(/^import \{([^}]+)\} from '([^']+)'$/gm, (line, list, from) => `const {${list}} = require('${REQUIRES[from] || from}')`)
  return `${body.replace(
    /^(\/\/ Copyright[^\n]*\n)/m,
    `$1\n// Written by scripts/copy-click-actions.js from ${copy.source};\n// edit that, then run the script.\n`
  )}\n\nmodule.exports = { ${names.join(', ')} }\n`
}

module.exports = { serverCopy, COPIES, SOURCE: COPIES[0].SOURCE, TARGET: COPIES[0].TARGET }

if (require.main === module) {
  for (const copy of COPIES) {
    fs.writeFileSync(copy.TARGET, serverCopy(fs.readFileSync(copy.SOURCE, 'utf8'), copy))
    console.log(`Wrote ${copy.target}`)
  }
}
