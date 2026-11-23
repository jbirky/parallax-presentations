// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What an AI collaborator link shows when it's opened as a page rather than
// added as a connector: by a person, or by an AI reading a link pasted into a
// chat. It says what the link is and how to add it in each app, and has the
// deck as text, so an AI that can only read the page still sees the slides.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// The steps for adding the link in each app, as [app, steps] with `url` in them
function connectSteps(url) {
  return [
    ['Claude (claude.ai and Claude Desktop)', `Customize › Connectors › Add › Add custom connector. Paste ${url} as the URL and choose “No sign-in”. On Team and Enterprise plans only an Owner can add connectors, for everyone, so use a personal account.`],
    ['Claude Code', `claude mcp add --transport http parallax ${url}`],
    ['ChatGPT (on the web)', `Plugins › + › Add custom MCP server. Paste ${url} as the Server URL, choose “No authentication”, and create it as a plugin. In a chat, type @ and pick it. On Business and Enterprise workspaces only admins can add one.`],
    ['Other apps', 'Any app that takes a remote MCP server by URL, with no authentication.'],
  ]
}

const INTRO = name => `This is an AI collaborator link to a Parallax presentation, made for “${name}”. An AI app that adds it as a connector can read and change the presentation through its tools, and its changes show live to anyone with the presentation open. Keep it private: anyone with the link can do the same, until the presentation's owner revokes it.`
const FOR_AI = 'If you are an AI assistant reading this page: the slides are below as text. To work with the presentation itself, ask the user to add this page’s address as a custom connector (a remote MCP server) in your app, using the steps below.'

// The page as HTML
function linkPageHtml({ title, linkName, url, deckText }) {
  const steps = connectSteps(url).map(([app, how]) => `<li><strong>${esc(app)}</strong><br>${app === 'Claude Code' ? `<code>${esc(how)}</code>` : esc(how)}</li>`).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · AI collaborator link · Parallax</title>
<style>
  body { font: 15px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; color: #1f2430; background: #fff; }
  h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 28px 0 8px; }
  .kind { color: #6b7280; font-size: 13px; margin: 0 0 18px; }
  .note { background: #f4f5f8; border-radius: 8px; padding: 10px 14px; }
  li { margin: 0 0 10px; } code { font: 13px ui-monospace, Menlo, monospace; background: #f4f5f8; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
  pre { white-space: pre-wrap; word-wrap: break-word; font: 13px/1.5 ui-monospace, Menlo, monospace; background: #f8f9fb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
  @media (prefers-color-scheme: dark) { body { background: #16161f; color: #e3e5ec; } .kind { color: #9aa0ad; } .note, code { background: #23232f; } pre { background: #1d1d28; border-color: #30303e; } }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p class="kind">AI collaborator link · Parallax</p>
<p>${esc(INTRO(linkName))}</p>
<p class="note">${esc(FOR_AI)}</p>
<h2>Add it in your AI app</h2>
<ul>
${steps}
</ul>
<h2>The presentation as text</h2>
<pre>${esc(deckText)}</pre>
</body>
</html>
`
}

// The page as Markdown, for apps that ask for it
function linkPageMarkdown({ title, linkName, url, deckText }) {
  const steps = connectSteps(url).map(([app, how]) => `- **${app}**: ${app === 'Claude Code' ? '`' + how + '`' : how}`).join('\n')
  return `# ${title}\n\nAI collaborator link · Parallax\n\n${INTRO(linkName)}\n\n${FOR_AI}\n\n## Add it in your AI app\n\n${steps}\n\n## The presentation as text\n\n${deckText}\n`
}

// For the page: no scripts, nothing loaded, not framed, not cached, not
// indexed, and no address passed on when a link on it is followed
const PAGE_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
}

module.exports = { linkPageHtml, linkPageMarkdown, connectSteps, PAGE_HEADERS }
