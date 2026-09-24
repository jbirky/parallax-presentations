// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Wording for a plan's limits, as the server gives them: maxPresentations and
// expirationDays are null for unlimited and never, maxFileBytes for no limit
// beyond the server's own.

export function formatSize(bytes) {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${Math.round(gb * 10) / 10} GB`
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

// One line per limit, e.g. ['3 presentations', '100 MB storage', 'Presentations expire after 30 days']
export function planSummary(limits) {
  if (!limits) return []
  const { maxPresentations, storageBytes, expirationDays, maxFileBytes } = limits
  const lines = [
    maxPresentations == null ? 'Unlimited presentations' : `${maxPresentations} presentation${maxPresentations === 1 ? '' : 's'}`,
    `${formatSize(storageBytes)} storage`,
  ]
  if (maxFileBytes) lines.push(`Files up to ${formatSize(maxFileBytes)} each`)
  lines.push(expirationDays ? `Presentations expire after ${expirationDays} day${expirationDays === 1 ? '' : 's'}` : 'No expiration')
  return lines
}
