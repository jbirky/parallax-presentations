// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The email a team invitation for one address sends (services/email.js):
// who invited them to which team, in what role, and the link to join, which
// works only for that address. In the landing page's ink, paper, red and
// blue, in fonts every mail app has.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const ROLE_SENTENCES = {
  admin: 'As an admin, you can make and edit the team’s presentations, invite people and run the team.',
  member: 'As a member, you can make and edit the team’s presentations.',
  viewer: 'As a viewer, you can see the team’s presentations without changing them.',
}

const day = iso => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// { teamName, invitedBy?, role, email, expiresAt?, url, origin } → { subject, text, html }
function teamInviteEmail({ teamName, invitedBy, role, email, expiresAt, url, origin }) {
  const who = invitedBy ? `${invitedBy} invited you` : 'You’re invited'
  const subject = `${who} to ${teamName} on Parallax`
  const roleSentence = ROLE_SENTENCES[role] || ROLE_SENTENCES.member
  const until = expiresAt ? ` until ${day(expiresAt)}` : ''
  const forWhom = `The link works only for ${email}${until}. Sign in or make a free account with that address to accept it.`
  const ignore = 'If you weren’t expecting this, you can ignore it: nothing happens unless you open the link.'
  const site = String(origin || '').replace(/^https?:\/\//, '')

  const text = [
    `${who} to ${teamName} on Parallax.`,
    roleSentence,
    `Join the team: ${url}`,
    forWhom,
    ignore,
  ].join('\n\n') + '\n'

  const font = "'Helvetica Neue', Helvetica, Arial, sans-serif"
  const bar = (w, c, last) => `<span style="display:inline-block;width:${w}px;height:9px;background:${c};${last ? 'margin-right:10px;' : ''}"></span>`
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#fafaf7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-top:4px solid #0c0c0d">
<tr><td style="padding:28px 32px 6px;font:600 12px/1.4 ${font};letter-spacing:2px;text-transform:uppercase;color:#0c0c0d">${bar(6, '#ee2b2b')}${bar(14, '#0c0c0d')}${bar(6, '#1e60ff', true)}Parallax</td></tr>
<tr><td style="padding:10px 32px 0;font:800 26px/1.15 ${font};letter-spacing:-0.5px;color:#0c0c0d">${esc(who)} to ${esc(teamName)}</td></tr>
<tr><td style="padding:14px 32px 0;font:16px/1.55 ${font};color:#3d3d40">${esc(roleSentence)}</td></tr>
<tr><td style="padding:24px 32px"><a href="${esc(url)}" style="display:inline-block;padding:14px 24px;background:#0c0c0d;color:#fafaf7;font:600 16px ${font};text-decoration:none">Join ${esc(teamName)}</a></td></tr>
<tr><td style="padding:0 32px 10px;font:14px/1.55 ${font};color:#3d3d40">${esc(forWhom)}</td></tr>
<tr><td style="padding:0 32px 28px;font:13px/1.5 ${font};color:#66666a;word-break:break-all">Or open this link: <a href="${esc(url)}" style="color:#1a56e8">${esc(url)}</a></td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font:12px/1.5 ${font};color:#66666a">${esc(ignore)}${site ? `<br>Parallax · ${esc(site)}` : ''}</p>
</td></tr></table>
</body></html>
`
  return { subject, text, html }
}

module.exports = { teamInviteEmail }
