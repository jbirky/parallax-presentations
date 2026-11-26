// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Email the site sends, through Resend's API
// (https://resend.com/docs/api-reference/emails/send-email). It needs
// RESEND_API_KEY and PARALLAX_EMAIL_FROM, an address on a domain verified in
// Resend, such as "Parallax <invites@parallax-presentations.com>". Without
// both, nothing is sent, and what would have emailed a link shows it to copy
// instead (team invitations: the POST /api/teams/:id/invites route).

const API = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10000

class EmailError extends Error {}

function isEnabled() {
  return !!(process.env.RESEND_API_KEY && process.env.PARALLAX_EMAIL_FROM)
}

// Sends one message: { to, subject, text, html, replyTo?, idempotencyKey? }.
// idempotencyKey makes a retry of the same message a no-op at Resend.
// Resolves to { id }; throws an EmailError when it isn't sent.
async function send({ to, subject, text, html, replyTo, idempotencyKey }) {
  if (!isEnabled()) throw new EmailError('This server doesn’t send email')
  let res
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.PARALLAX_EMAIL_FROM,
        to: [to],
        // One line: a subject can't carry headers of its own
        subject: String(subject).replace(/[\r\n]+/g, ' ').trim(),
        text,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    throw new EmailError(err.name === 'TimeoutError' ? 'The email service didn’t answer' : 'The email service couldn’t be reached')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new EmailError(body.message || `The email service answered ${res.status}`)
  return { id: body.id || null }
}

module.exports = { isEnabled, send, EmailError, API }
