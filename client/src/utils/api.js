let _getToken = async () => null
export function setTokenGetter(fn) { _getToken = fn }
// The signed-in user's session token, for live editing's WebSocket
export const getAuthToken = () => _getToken()

// Guest mode: requests carry the guest session token instead of a Clerk token
let _guestToken = null
export function setGuestToken(token) { _guestToken = token }

const _fetch = globalThis.fetch.bind(globalThis)
async function authFetch(url, options = {}) {
  const token = await _getToken()
  const headers = { ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (_guestToken) headers['X-Guest-Token'] = _guestToken
  const res = await _fetch(url, { ...options, headers })
  // A guest session that was closed or idle too long has been deleted
  if (_guestToken && res.status === 401) globalThis.dispatchEvent(new Event('parallax:guest-expired'))
  return res
}

async function safeJson(r) {
  const text = await r.text()
  try { return JSON.parse(text) }
  catch { throw new Error(r.ok ? 'Invalid JSON response' : `Request failed (${r.status})`) }
}

const BASE = '/api'

const jsonBody = (method, data) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
// A response's JSON, or an Error with the server's reason
const adminJson = fallback => async r => {
  const b = await safeJson(r)
  if (!r.ok) throw new Error(b.error || b.message || fallback)
  return b
}

// Like adminJson, keeping the rules an imported plugin breaks as `problems`
const pluginImportJson = fallback => async r => {
  const b = await safeJson(r)
  if (!r.ok) throw Object.assign(new Error(b.error || fallback), { problems: b.problems || [] })
  return b
}

// The version of each presentation as this tab last loaded or saved it. A save
// sends it, and the server refuses a save made from an older version (409)
// when someone else has saved since. Self-hosted, presentations have none.
const versions = new Map()
function noteVersion(id, deck) {
  if (id && Number.isInteger(deck?.version)) versions.set(id, deck.version)
  return deck
}

// Rejects with the server's reason; a refused save's error has code
// 'conflict' and the version that's saved now
// A dataset route's answer: its own error message, whatever the status (a
// 409 there is a name in use or a fetch already running, not a save conflict)
async function datasetChecked(r, fallback) {
  const b = await safeJson(r)
  if (!r.ok) throw Object.assign(new Error(b.error || b.message || fallback), { status: r.status, code: b.code })
  return b
}

async function checked(r, fallback) {
  const b = await safeJson(r)
  if (r.status === 409) throw Object.assign(new Error(b.message || 'Someone else saved this presentation'), { code: 'conflict', version: b.version })
  if (!r.ok) throw Object.assign(new Error(b.message || b.error || fallback), { status: r.status })
  return b
}

function json(method, data) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
}

// One save per presentation at a time: a save asked for while another is on
// its way is sent once that one is done, from the version it made, so a slow
// save doesn't make the tab's next one look out of date
const saving = new Map()
function savePresentation(id, data) {
  const send = () => authFetch(`${BASE}/presentations/${id}`, json('PUT', { ...data, version: versions.get(id) }))
    .then(r => checked(r, 'Save failed'))
    .then(deck => noteVersion(id, deck))
  const save = (saving.get(id) || Promise.resolve()).then(send, send)
  saving.set(id, save)
  const done = () => { if (saving.get(id) === save) saving.delete(id) }
  save.then(done, done)
  return save
}

// Resolves to { url }; rejects with the server's reason (storage full, file too big, ...)
function uploadTo(url, file) {
  const fd = new FormData()
  fd.append('file', file)
  return authFetch(url, { method: 'POST', body: fd }).then(async r => {
    const b = await safeJson(r)
    if (!r.ok) throw new Error(b.error || 'Upload failed')
    return b
  })
}

export const api = {
  getPresentations: () => authFetch(`${BASE}/presentations`).then(safeJson),
  getPresentation: (id) => authFetch(`${BASE}/presentations/${id}`).then(safeJson).then(deck => noteVersion(id, deck)),
  createPresentation: (data) => authFetch(`${BASE}/presentations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.message || b.error || 'Create failed'); return b }),
  updatePresentation: savePresentation,
  // After a refused save, to save over the version that's there now
  saveOverVersion: (id, version) => { versions.set(id, version) },
  deletePresentation: (id) => authFetch(`${BASE}/presentations/${id}`, { method: 'DELETE' }).then(safeJson),
  duplicatePresentation: (id) => authFetch(`${BASE}/presentations/${id}/duplicate`, { method: 'POST' }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.message || b.error || 'Duplicate failed'); return b }),
  uploadFile: (file) => uploadTo('/api/upload', file),
  uploadFileToPresentation: (presentationId, file) => uploadTo(`/api/presentations/${presentationId}/upload`, file),
  getGithubConfig: () => authFetch(`${BASE}/github/config`).then(safeJson),
  saveGithubConfig: (data) => authFetch(`${BASE}/github/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(safeJson),
  pushToGithub: (id, message) => authFetch(`${BASE}/presentations/${id}/github/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }).then(async r => {
    const body = await safeJson(r)
    if (!r.ok) throw new Error(body.error || 'Push failed')
    return body
  }),

  // Live sessions
  startLiveSession: (id) => authFetch(`${BASE}/presentations/${id}/live/start`, { method: 'POST' }).then(safeJson),
  stopLiveSession: (id, sessionId) => authFetch(`${BASE}/presentations/${id}/live/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  }).then(safeJson),
  updateLiveSlide: (sessionId, flatIndex) => _fetch(`/api/live/${sessionId}/slide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flatIndex })
  }).then(safeJson),

  // Zotero
  getZoteroConfig: () => authFetch(`${BASE}/zotero/config`).then(safeJson),
  saveZoteroConfig: (data) => authFetch(`${BASE}/zotero/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(safeJson),
  deleteZoteroConfig: () => authFetch(`${BASE}/zotero/config`, { method: 'DELETE' }).then(safeJson),
  zoteroProxy: (path, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return authFetch(`${BASE}/zotero/proxy/${path}${qs ? '?' + qs : ''}`).then(async r => {
      const total = parseInt(r.headers.get('Total-Results') || '0', 10)
      const data = await safeJson(r)
      return { data, total }
    })
  },

  // Templates
  getTemplates: () => authFetch(`${BASE}/templates`).then(safeJson),
  getTemplate: (id) => authFetch(`${BASE}/templates/${id}`).then(safeJson),
  // These three reject with the server's reason, as when a limit is reached
  createTemplate: (data) => authFetch(`${BASE}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => checked(r, 'Couldn’t create the template')),
  updateTemplate: (id, data) => authFetch(`${BASE}/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(safeJson),
  deleteTemplate: (id) => authFetch(`${BASE}/templates/${id}`, { method: 'DELETE' }).then(safeJson),
  saveAsTemplate: (id, title) => authFetch(`${BASE}/presentations/${id}/save-as-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  }).then(r => checked(r, 'Couldn’t save it as a template')),

  // Version History
  saveSnapshot: (id, name) => authFetch(`${BASE}/presentations/${id}/snapshot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
  }).then(r => checked(r, 'Couldn’t save the version')),
  getSnapshots: (id) => authFetch(`${BASE}/presentations/${id}/snapshots`).then(safeJson),
  restoreSnapshot: (id, snapshotId) => authFetch(`${BASE}/presentations/${id}/restore/${snapshotId}`, { method: 'POST' }).then(safeJson).then(deck => noteVersion(id, deck)),
  deleteSnapshot: (id, snapshotId) => authFetch(`${BASE}/presentations/${id}/snapshots/${snapshotId}`, { method: 'DELETE' }).then(safeJson),
  getSnapshotData: (id, snapshotId) => authFetch(`${BASE}/presentations/${id}/snapshots/${snapshotId}/data`).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),

  // Git history
  getGitHistory: (id) => authFetch(`${BASE}/presentations/${id}/github/history`).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),
  getGitVersion: (id, sha) => authFetch(`${BASE}/presentations/${id}/github/version/${sha}`).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),

  // Fork from Git
  browseGitRepo: (url) => authFetch(`${BASE}/github/browse-repo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Browse failed'); return b }),
  forkFromGit: (owner, repo, folder, branch) => authFetch(`${BASE}/presentations/fork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, folder, branch }),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.message || b.error || 'Fork failed'); return b }),

  // Zenodo
  getZenodoConfig: () => authFetch(`${BASE}/zenodo/config`).then(async r => { if (!r.ok) return { hasToken: false, sandbox: false }; return safeJson(r) }),
  saveZenodoConfig: (data) => authFetch(`${BASE}/zenodo/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Save failed'); return b }),
  deleteZenodoConfig: () => authFetch(`${BASE}/zenodo/config`, { method: 'DELETE' }).then(safeJson),
  getZenodoStatus: (id) => authFetch(`${BASE}/presentations/${id}/zenodo/status`).then(safeJson),
  publishToZenodo: (id, metadata) => authFetch(`${BASE}/presentations/${id}/zenodo/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Publish failed'); return b }),

  // Custom fonts
  getFonts: () => authFetch(`${BASE}/fonts`).then(safeJson),
  uploadFont: (file, familyName) => {
    const fd = new FormData()
    fd.append('file', file)
    if (familyName) fd.append('familyName', familyName)
    return authFetch(`${BASE}/fonts/upload`, { method: 'POST', body: fd }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Upload failed'); return b })
  },
  addGoogleFont: (familyName) => authFetch(`${BASE}/fonts/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyName }),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),
  deleteFont: (id) => authFetch(`${BASE}/fonts/${id}`, { method: 'DELETE' }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),

  // Datasets
  getDatasets: () => authFetch(`${BASE}/datasets`).then(safeJson),
  getDataset: (id) => authFetch(`${BASE}/datasets/${id}`).then(safeJson),
  uploadDataset: (file, name) => {
    const fd = new FormData()
    fd.append('file', file)
    if (name) fd.append('name', name)
    return authFetch(`${BASE}/datasets`, { method: 'POST', body: fd }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Upload failed'); return b })
  },
  getDatasetData: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return authFetch(`${BASE}/datasets/${id}/data${qs ? '?' + qs : ''}`).then(safeJson)
  },
  renameDataset: (id, name) => authFetch(`${BASE}/datasets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then(safeJson),
  deleteDataset: (id) => authFetch(`${BASE}/datasets/${id}`, { method: 'DELETE' }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Delete failed'); return b }),
  // Editing with others (cloud only)
  getCollaborators: (id) => authFetch(`${BASE}/presentations/${id}/collaborators`).then(r => checked(r, 'Failed')),
  turnOnInvite: (id) => authFetch(`${BASE}/presentations/${id}/invite`, { method: 'POST' }).then(r => checked(r, 'Failed')),
  turnOffInvite: (id) => authFetch(`${BASE}/presentations/${id}/invite`, { method: 'DELETE' }).then(r => checked(r, 'Failed')),
  removeCollaborator: (id, userId) => authFetch(`${BASE}/presentations/${id}/collaborators/${userId}`, { method: 'DELETE' }).then(r => checked(r, 'Failed')),
  getInvite: (token) => authFetch(`${BASE}/invites/${token}`).then(r => checked(r, 'Failed')),
  acceptInvite: (token) => authFetch(`${BASE}/invites/${token}/accept`, { method: 'POST' }).then(r => checked(r, 'Failed')),
  getPresentationDatasets: (pid) => authFetch(`${BASE}/presentations/${pid}/datasets`).then(safeJson),
  getPresentationDatasetData: (pid, datasetId, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return authFetch(`${BASE}/presentations/${pid}/datasets/${datasetId}/data${qs ? '?' + qs : ''}`).then(r => datasetChecked(r, 'Couldn’t read the dataset'))
  },
  pinDatasetVersion: (pid, datasetId, versionId) => authFetch(`${BASE}/presentations/${pid}/datasets/${datasetId}/pin`, jsonBody('PUT', { versionId })).then(r => datasetChecked(r, 'Couldn’t pin the version')),
  // Live datasets: fetched from a URL or a TAP query, and refreshed on a schedule
  getDatasetSources: () => authFetch(`${BASE}/datasets/sources`).then(r => datasetChecked(r, 'Failed')),
  testDatasetSource: (body) => authFetch(`${BASE}/datasets/sources/test`, jsonBody('POST', body)).then(r => datasetChecked(r, 'The source couldn’t be read')),
  createLiveDataset: (body) => authFetch(`${BASE}/datasets/live`, jsonBody('POST', body)).then(r => datasetChecked(r, 'The dataset couldn’t be made')),
  updateDatasetSource: (id, body) => authFetch(`${BASE}/datasets/${id}/source`, jsonBody('PATCH', body)).then(r => datasetChecked(r, 'The source couldn’t be changed')),
  refreshDataset: (id) => authFetch(`${BASE}/datasets/${id}/refresh`, { method: 'POST' }).then(r => datasetChecked(r, 'The dataset couldn’t be refreshed')),
  getDatasetVersions: (id) => authFetch(`${BASE}/datasets/${id}/versions`).then(r => datasetChecked(r, 'Failed')),
  getDatasetFetches: (id) => authFetch(`${BASE}/datasets/${id}/fetches`).then(r => datasetChecked(r, 'Failed')),
  // Transforms: the steps that shape a dataset for slides
  saveDatasetTransforms: (id, transforms) => authFetch(`${BASE}/datasets/${id}/transforms`, jsonBody('PUT', { transforms })).then(r => datasetChecked(r, 'The transforms couldn’t be saved')),
  previewDatasetTransforms: (id, transforms) => authFetch(`${BASE}/datasets/${id}/transforms/preview`, jsonBody('POST', { transforms })).then(r => datasetChecked(r, 'The transforms couldn’t run')),
  linkDataset: (pid, datasetId, alias) => authFetch(`${BASE}/presentations/${pid}/datasets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datasetId, alias }),
  }).then(safeJson),
  unlinkDataset: (pid, datasetId) => authFetch(`${BASE}/presentations/${pid}/datasets/${datasetId}`, { method: 'DELETE' }).then(safeJson),

  // File management
  getUploads: () => authFetch(`${BASE}/uploads`).then(safeJson),
  getPresentationUploads: (presentationId) => authFetch(`${BASE}/presentations/${presentationId}/uploads`).then(safeJson),
  deleteUpload: (id) => authFetch(`${BASE}/uploads/${id}`, { method: 'DELETE' }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Delete failed'); return b }),

  // User / plan
  getMe: () => authFetch(`${BASE}/me`).then(safeJson),

  // Share links
  enableShare: (id) => authFetch(`${BASE}/presentations/${id}/share`, { method: 'POST' }).then(safeJson),
  disableShare: (id) => authFetch(`${BASE}/presentations/${id}/share`, { method: 'DELETE' }).then(safeJson),
  getShareStatus: (id) => authFetch(`${BASE}/presentations/${id}/share`).then(safeJson),

  // Billing
  // The listed plans: { billing, plans }. Public, so it works signed out.
  getPlans: () => _fetch(`${BASE}/plans`).then(safeJson),
  createCheckout: (plan) => authFetch(`${BASE}/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  }).then(async r => {
    const b = await safeJson(r)
    if (!r.ok) throw new Error(b.error || 'Could not start checkout')
    return b
  }),
  createPortal: () => authFetch(`${BASE}/billing/portal`, { method: 'POST' }).then(safeJson),
  getBillingStatus: () => authFetch(`${BASE}/billing/status`).then(safeJson),
  cancelSubscription: () => authFetch(`${BASE}/billing/cancel`, { method: 'POST' }).then(safeJson),
  resumeSubscription: () => authFetch(`${BASE}/billing/resume`, { method: 'POST' }).then(safeJson),

  // Admin dashboard; null for anyone who isn't an admin
  getAdminOverview: () => authFetch(`${BASE}/admin/overview`).then(async r => {
    if (r.status === 404) return null
    const b = await safeJson(r)
    if (!r.ok) throw new Error(b.error || 'Could not load the dashboard')
    return b
  }),
  endAllGuestSessions: () => authFetch(`${BASE}/admin/guest-sessions/end-all`, { method: 'POST' }).then(async r => {
    const b = await safeJson(r)
    if (!r.ok) throw new Error(b.error || 'Could not end the guest sessions')
    return b
  }),
  savePlan: (plan, isNew) => authFetch(isNew ? `${BASE}/admin/plans` : `${BASE}/admin/plans/${plan.id}`, {
    method: isNew ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  }).then(async r => {
    const b = await safeJson(r)
    if (!r.ok) throw new Error(b.error || 'Could not save the plan')
    return b
  }),
  deletePlan: (id) => authFetch(`${BASE}/admin/plans/${id}`, { method: 'DELETE' }).then(async r => {
    const b = await safeJson(r)
    if (!r.ok) throw new Error(b.error || 'Could not delete the plan')
    return b
  }),
  // The landing page's statistics for the last `days` days
  getLandingStats: (days) => authFetch(`${BASE}/admin/stats?days=${days}`).then(adminJson('Could not load the statistics')),
  // The landing page's examples, as /admin edits them
  getAdminExamples: () => authFetch(`${BASE}/admin/examples`).then(adminJson('Could not load the examples')),
  addExample: (data) => authFetch(`${BASE}/admin/examples`, jsonBody('POST', data)).then(adminJson('Could not add the example')),
  saveExample: (slug, data) => authFetch(`${BASE}/admin/examples/${encodeURIComponent(slug)}`, jsonBody('PUT', data)).then(adminJson('Could not save the example')),
  orderExamples: (slugs) => authFetch(`${BASE}/admin/examples/order`, jsonBody('PUT', { slugs })).then(adminJson('Could not reorder the examples')),
  refreshExample: (slug) => authFetch(`${BASE}/admin/examples/${encodeURIComponent(slug)}/refresh`, { method: 'POST' }).then(adminJson('Could not update the example')),
  redrawExampleThumbnail: (slug) => authFetch(`${BASE}/admin/examples/${encodeURIComponent(slug)}/thumbnail`, { method: 'POST' }).then(adminJson('Could not draw the thumbnail')),
  copyExample: (slug) => authFetch(`${BASE}/admin/examples/${encodeURIComponent(slug)}/copy`, { method: 'POST' }).then(adminJson('Could not make a copy')),
  deleteExample: (slug) => authFetch(`${BASE}/admin/examples/${encodeURIComponent(slug)}`, { method: 'DELETE' }).then(adminJson('Could not delete the example')),
  // Community plugins: versions waiting for review (status: pending,
  // approved, rejected, revoked or all), and an admin's decision on one
  getPluginReviewQueue: (status = 'pending') => authFetch(`${BASE}/admin/plugin-versions?status=${encodeURIComponent(status)}`).then(adminJson('Could not load the plugin versions')),
  reviewPluginVersion: (id, action, note = '') => authFetch(`${BASE}/admin/plugin-versions/${id}/${action}`, jsonBody('POST', { note })).then(adminJson(`Could not ${action} the version`)),
  setUserPlan: (userId, plan) => authFetch(`${BASE}/admin/users/${userId}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  }).then(async r => {
    const b = await safeJson(r)
    if (!r.ok) throw new Error(b.error || 'Could not change the plan')
    return b
  }),

  // Community plugins (server/services/community-plugins.js): the listed
  // plugins, the ones you installed, importing a tag of a GitHub repo, and
  // what you've imported. An import that breaks the rules rejects with an
  // Error whose `problems` lists each rule.
  getPluginCatalog: () => _fetch(`${BASE}/plugins`).then(adminJson('Could not load the plugins')),
  getInstalledPlugins: () => authFetch(`${BASE}/me/plugins`).then(adminJson('Could not load your plugins')),
  installPlugin: (slug) => authFetch(`${BASE}/plugins/${encodeURIComponent(slug)}/install`, { method: 'POST' }).then(adminJson('Could not install the plugin')),
  uninstallPlugin: (slug) => authFetch(`${BASE}/plugins/${encodeURIComponent(slug)}/install`, { method: 'DELETE' }).then(adminJson('Could not uninstall the plugin')),
  lookupPluginRepo: (url) => authFetch(`${BASE}/plugin-repos/lookup`, jsonBody('POST', { url })).then(pluginImportJson('Could not read that repo')),
  importPluginVersion: (url, tag) => authFetch(`${BASE}/plugin-repos/import`, jsonBody('POST', { url, tag })).then(pluginImportJson('Could not import that version')),
  getPluginSubmissions: () => authFetch(`${BASE}/me/plugin-submissions`).then(adminJson('Could not load your plugins')),
  // A version's sandbox page as its importer or an admin may see it before
  // it's approved, or null
  getPluginVersionSandbox: (pluginId, version) => authFetch(`${BASE}/plugin-versions/${encodeURIComponent(pluginId)}/${encodeURIComponent(version)}/sandbox`).then(r => (r.ok ? r.text() : null)),

  // Guest mode
  getGuestConfig: () => _fetch(`${BASE}/guest/config`).then(safeJson),
  // The landing page's examples: { hero, examples }, or null
  getLandingExamples: () => _fetch(`${BASE}/examples`).then(r => (r.ok ? r.json() : null)),
  // One of the landing page's example decks, or null
  getExample: (slug) => _fetch(`${BASE}/examples/${encodeURIComponent(slug)}`).then(r => (r.ok ? r.json() : null)),
  // Copies of the datasets an example deck plots, linked to presentation pid
  copyExampleDatasets: (slug, pid) => authFetch(`${BASE}/examples/${encodeURIComponent(slug)}/datasets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentationId: pid }),
  }).then(safeJson),
  startGuestSession: (turnstileToken) => _fetch(`${BASE}/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turnstileToken })
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Could not start a guest session'); return b }),
  resumeGuestSession: () => authFetch(`${BASE}/guest/resume`, { method: 'POST' })
    .then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Guest session ended'); return b }),
  pingGuestActivity: () => authFetch(`${BASE}/guest/activity`, { method: 'POST' }).catch(() => {}),
}
