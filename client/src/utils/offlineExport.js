// Offline export: inline the libraries a deck links to, read from this app's
// bundled copies, so neither exporting nor the exported file needs internet

import { libUrl, localizeLibraries } from './libraries'

// The links generateRevealHTML writes, which the export replaces
const CDN_RESOURCES = {
  css: [
    libUrl('reveal.js', 'dist/reset.css'),
    libUrl('reveal.js', 'dist/reveal.css'),
    libUrl('katex', 'dist/katex.min.css'),
  ],
  js: [
    libUrl('reveal.js', 'dist/reveal.js'),
    libUrl('reveal.js', 'plugin/notes/notes.js'),
    libUrl('reveal.js', 'plugin/highlight/highlight.js'),
    libUrl('katex', 'dist/katex.min.js'),
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

// Reads a library from its bundled copy when there is one
async function fetchText(url) {
  try {
    const resp = await fetch(localizeLibraries(url))
    if (!resp.ok) return `/* Failed to fetch: ${url} */`
    return await resp.text()
  } catch {
    return `/* Failed to fetch: ${url} */`
  }
}

export async function generateOfflineHTML(html) {
  // Replace <link rel="stylesheet" href="CDN_URL"> with <style>...</style>
  // Replace <script src="CDN_URL"></script> with <script>...</script>
  // The code goes in through replacer functions: in a replacement string,
  // the "$&" and "$'" in reveal.js, KaTeX and highlight.js would be expanded
  // into the page itself, ending the inlined script early

  let result = html

  // Fetch and inline CSS
  for (const url of CDN_RESOURCES.css) {
    const css = await fetchText(url)
    result = result.replace(
      new RegExp(`<link[^>]*href=["']${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'g'),
      () => `<style>/* ${url} */\n${css}\n</style>`
    )
  }

  // Theme CSS (dynamic URL)
  const themeMatch = result.match(/<link[^>]*href=["'](https:\/\/cdn\.jsdelivr\.net\/npm\/reveal\.js@[^"']*\/dist\/theme\/[^"']+\.css)["'][^>]*>/)
  if (themeMatch) {
    const themeCss = await fetchText(themeMatch[1])
    result = result.replace(themeMatch[0], () => `<style>/* ${themeMatch[1]} */\n${themeCss}\n</style>`)
  }

  // Code theme CSS (dynamic URL)
  const codeThemeMatch = result.match(/<link[^>]*href=["'](https:\/\/cdn\.jsdelivr\.net\/npm\/@highlightjs\/cdn-assets@[^"']+\/styles\/[^"']+)["'][^>]*>/)
  if (codeThemeMatch) {
    const codeThemeCss = await fetchText(codeThemeMatch[1])
    result = result.replace(codeThemeMatch[0], () => `<style>/* ${codeThemeMatch[1]} */\n${codeThemeCss}\n</style>`)
  }

  // Fetch and inline JS
  for (const url of CDN_RESOURCES.js) {
    const js = await fetchText(url)
    result = result.replace(
      new RegExp(`<script[^>]*src=["']${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*><\\/script>`, 'g'),
      () => `<script>/* ${url} */\n${js}\n</script>`
    )
  }

  // Remove Google Fonts link (can't inline web fonts easily, but they're non-essential)
  result = result.replace(/<link[^>]*href=["']https:\/\/fonts\.googleapis\.com[^"']*["'][^>]*>/g,
    '<!-- Google Fonts removed for offline mode -->')

  // Remove Computer Modern font link
  result = result.replace(/<link[^>]*href=["']https:\/\/cdn\.jsdelivr\.net\/npm\/latex\.js@[^"']*\/dist\/fonts\/cmu\.css["'][^>]*>/g,
    '<!-- Computer Modern fonts removed for offline mode -->')

  // Embed uploaded images, video and audio
  result = await inlineUploads(result)

  return result
}
