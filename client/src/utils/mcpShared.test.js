import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'

// What AI collaborator links use from the client (server/mcp/shared.js),
// bundled for the server
const require = createRequire(import.meta.url)
const { bundle, TARGET } = require('../../../scripts/build-mcp-shared.js')

describe("the server's copy of the Beamer converter and the rest", () => {
  it('is current: run `node scripts/build-mcp-shared.js` after changing them or their imports', async () => {
    expect(readFileSync(TARGET, 'utf8')).toBe(await bundle())
  })
})
