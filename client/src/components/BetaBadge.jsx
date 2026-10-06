// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The "beta" tag beside the Parallax wordmark, sized to whatever the
// wordmark's size is. A <sup>, so rules for a wordmark's <span> (its accent
// P) don't reach it.
export default function BetaBadge() {
  return <sup className="beta-badge">beta</sup>
}
