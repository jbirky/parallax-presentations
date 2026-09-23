// Offline export: fetch CDN resources and inline them into the HTML

const CDN_RESOURCES = {
  css: [
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css',
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
  ],
  js: [
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js',
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/notes/notes.js',
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.js',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
  ],
}

// Uploaded files are served by this app, so an export that only links to them
// breaks once it's opened elsewhere or the files are deleted (guest sessions).
// Matches /uploads/ paths that are relative or on this site's origin, never
// the tail of another site's URL.
function uploadPathRe() {
  const origin = (globalThis.location?.origin || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\w.:/-])((?:${origin})?\\/uploads\\/[^\\s"'<>)\\\\&]+)`, 'g')
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function inlineUploads(html) {
  const uploadPathRegex = uploadPathRe()
  const dataUrls = new Map()
  for (const [, , uploadPath] of html.matchAll(uploadPathRegex)) {
    if (dataUrls.has(uploadPath)) continue
    try {
      const resp = await fetch(uploadPath)
      dataUrls.set(uploadPath, resp.ok ? await blobToDataURL(await resp.blob()) : null)
    } catch {
      dataUrls.set(uploadPath, null)
    }
  }
  return html.replace(uploadPathRegex, (whole, before, uploadPath) =>
    dataUrls.get(uploadPath) ? before + dataUrls.get(uploadPath) : whole)
}

async function fetchText(url) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return `/* Failed to fetch: ${url} */`
    return await resp.text()
  } catch {
    return `/* Failed to fetch: ${url} */`
  }
}

export async function generateOfflineHTML(html) {
  // Replace <link rel="stylesheet" href="CDN_URL"> with <style>...</style>
  // Replace <script src="CDN_URL"></script> with <script>...</script>

  let result = html

  // Fetch and inline CSS
  for (const url of CDN_RESOURCES.css) {
    const css = await fetchText(url)
    result = result.replace(
      new RegExp(`<link[^>]*href=["']${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'g'),
      `<style>/* ${url} */\n${css}\n</style>`
    )
  }

  // Theme CSS (dynamic URL)
  const themeMatch = result.match(/<link[^>]*href=["'](https:\/\/cdn\.jsdelivr\.net\/npm\/reveal\.js@[^"']*\/dist\/theme\/[^"']+\.css)["'][^>]*>/)
  if (themeMatch) {
    const themeCss = await fetchText(themeMatch[1])
    result = result.replace(themeMatch[0], `<style>/* ${themeMatch[1]} */\n${themeCss}\n</style>`)
  }

  // Code theme CSS (dynamic URL)
  const codeThemeMatch = result.match(/<link[^>]*href=["'](https:\/\/cdn\.jsdelivr\.net\/npm\/highlight\.js@[^"']+)["'][^>]*>/)
  if (codeThemeMatch) {
    const codeThemeCss = await fetchText(codeThemeMatch[1])
    result = result.replace(codeThemeMatch[0], `<style>/* ${codeThemeMatch[1]} */\n${codeThemeCss}\n</style>`)
  }

  // Fetch and inline JS
  for (const url of CDN_RESOURCES.js) {
    const js = await fetchText(url)
    result = result.replace(
      new RegExp(`<script[^>]*src=["']${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*><\\/script>`, 'g'),
      `<script>/* ${url} */\n${js}\n</script>`
    )
  }

  // Remove Google Fonts link (can't inline web fonts easily, but they're non-essential)
  result = result.replace(/<link[^>]*href=["']https:\/\/fonts\.googleapis\.com[^"']*["'][^>]*>/g,
    '<!-- Google Fonts removed for offline mode -->')

  // Remove Computer Modern font link
  result = result.replace(/<link[^>]*href=["']https:\/\/cdn\.jsdelivr\.net\/gh\/dreampulse\/computer-modern[^"']*["'][^>]*>/g,
    '<!-- Computer Modern fonts removed for offline mode -->')

  // Embed uploaded images, video and audio
  result = await inlineUploads(result)

  return result
}
