import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendorLibraries = createRequire(import.meta.url)('../server/vendor-libraries.js')

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' }

function globToRegExp(glob) {
  const escape = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${glob.split('**').map(part => part.split('*').map(escape).join('[^/]*')).join('.*')}$`)
}

function listFiles(dir, prefix = '') {
  return fs.readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap(entry => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listFiles(dir, rel)
    return [rel]
  })
}

// The libraries in server/vendor-libraries.js, at the exact versions the root
// package.json pins: served at /vendor/ by the dev server, copied to
// dist/vendor/ by the build with a manifest of their versions, and described
// to the app as __VENDOR_LIBRARIES__. Fails when a version isn't installed or
// a listed file is missing, so an upgrade that moves files is caught here.
function vendorLibrariesPlugin() {
  const pinned = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).devDependencies || {}
  const versions = {}
  const files = new Map() // url path under /vendor/ -> file on disk
  for (const [name, { files: globs }] of Object.entries(vendorLibraries.packages)) {
    const dir = path.join(rootDir, 'node_modules', name)
    const installed = fs.existsSync(path.join(dir, 'package.json'))
      ? JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version : null
    if (!pinned[name] || pinned[name] !== installed) {
      throw new Error(`${name}: the root package.json pins ${pinned[name] || 'nothing'} but ${installed || 'nothing'} is installed. Pin an exact version and run npm install.`)
    }
    versions[name] = installed
    const all = listFiles(dir)
    for (const glob of globs) {
      const re = globToRegExp(glob)
      const matches = all.filter(f => re.test(f))
      if (!matches.length) throw new Error(`${name}@${installed}: no file matches "${glob}" (server/vendor-libraries.js)`)
      for (const f of matches) files.set(`${name}@${installed}/${f}`, path.join(dir, f))
    }
  }

  return {
    name: 'vendor-libraries',
    config: () => ({
      define: { __VENDOR_LIBRARIES__: JSON.stringify({ ...vendorLibraries, versions }) },
    }),
    configureServer(server) {
      server.middlewares.use('/vendor', (req, res, next) => {
        const file = files.get(decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''))
        if (!file) return next()
        res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream')
        fs.createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      for (const [urlPath, file] of files) {
        this.emitFile({ type: 'asset', fileName: `vendor/${urlPath}`, source: fs.readFileSync(file) })
      }
      this.emitFile({ type: 'asset', fileName: 'vendor/manifest.json', source: JSON.stringify({ versions }, null, 2) })
    },
  }
}

export default defineConfig({
  plugins: [react(), vendorLibrariesPlugin()],
  envDir: '..',
  server: {
    proxy: {
      '/api': 'http://localhost:3002',
      '/uploads': 'http://localhost:3002',
      // Live editing's WebSocket
      '/collab': { target: 'ws://localhost:3002', ws: true },
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  }
})
