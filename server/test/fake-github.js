// A stand-in for GitHub's API and raw file host, for importing community
// plugins in tests (services/plugin-import.js takes it as its fetcher).
// Repos are made in memory: repo.tag(name, files) adds a commit holding
// `files` ({ path: string or Buffer }) and points a tag at it.

const crypto = require('crypto')
const { gitBlobSha } = require('../services/plugin-import')

function fakeGitHub() {
  const repos = new Map()
  const calls = []

  function repo(owner, name, { isPrivate = false, stars = 0 } = {}) {
    const r = { owner, name, isPrivate, stars, tags: [], commits: new Map() }
    repos.set(`${owner}/${name}`.toLowerCase(), r)
    return {
      tag(tagName, files) {
        const contents = Object.fromEntries(Object.entries(files).map(([p, c]) => [p, Buffer.isBuffer(c) ? c : Buffer.from(c)]))
        const sha = crypto.createHash('sha1').update(`${owner}/${name}@${tagName}:${JSON.stringify(Object.keys(contents))}:${r.tags.length}`).digest('hex')
        r.commits.set(sha, contents)
        r.tags.unshift({ name: tagName, sha })
        return sha
      },
    }
  }

  const ok = body => ({ status: 200, headers: {}, body: Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)) })
  const missing = () => ({ status: 404, headers: {}, body: Buffer.from('{"message":"Not Found"}') })

  async function fetcher(url) {
    calls.push(url)
    const u = new URL(url)
    if (u.host === 'api.github.com') {
      let m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)$/)
      if (m) {
        const r = repos.get(`${m[1]}/${m[2]}`.toLowerCase())
        if (!r || r.isPrivate) return missing()
        return ok({ name: r.name, owner: { login: r.owner, avatar_url: `https://avatars.example/${r.owner}` }, private: false, html_url: `https://github.com/${r.owner}/${r.name}`, description: 'A plugin', stargazers_count: r.stars })
      }
      m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/tags$/)
      if (m) {
        const r = repos.get(`${m[1]}/${m[2]}`.toLowerCase())
        return r ? ok(r.tags.map(t => ({ name: t.name, commit: { sha: t.sha } }))) : missing()
      }
      m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/([0-9a-f]{40})$/)
      if (m) {
        const files = repos.get(`${m[1]}/${m[2]}`.toLowerCase())?.commits.get(m[3])
        if (!files) return missing()
        return ok({ truncated: false, tree: Object.entries(files).map(([path, c]) => ({ path, type: 'blob', mode: '100644', size: c.length, sha: gitBlobSha(c) })) })
      }
      return missing()
    }
    if (u.host === 'raw.githubusercontent.com') {
      const [, owner, name, sha, ...rest] = u.pathname.split('/')
      const files = repos.get(`${owner}/${name}`.toLowerCase())?.commits.get(sha)
      const file = files?.[rest.map(decodeURIComponent).join('/')]
      return file ? ok(file) : missing()
    }
    throw new Error(`The fake GitHub doesn’t answer ${url}`)
  }

  return { repo, fetcher, calls }
}

// A plugin's files as a repo holds them: parallax-plugin.json and dist/
function pluginFiles({ id = 'io.github.someone.lorenz', version = '1.0.0', type = 'lorenz', manifest = {}, sandbox } = {}) {
  return {
    'parallax-plugin.json': JSON.stringify({
      id, name: 'Lorenz attractor', version, license: 'MIT', description: 'A Lorenz attractor you can turn',
      sandbox: './sandbox.html', permissions: ['network:cdn.jsdelivr.net'], categories: ['physics'],
      contributes: { elementTypes: [{ type, label: 'Lorenz attractor', defaultSize: { width: 400, height: 300 }, defaultData: { sigma: 10 } }] },
      ...manifest,
    }),
    'README.md': '# Lorenz\n\nA strange attractor.',
    'dist/sandbox.html': sandbox ?? `<!DOCTYPE html><html><head><title>Lorenz</title></head><body><canvas id="lorenz-${version}"></canvas></body></html>`,
    'src/index.js': 'console.log("not shipped")',
  }
}

module.exports = { fakeGitHub, pluginFiles }
