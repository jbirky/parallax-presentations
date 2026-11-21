// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The point of an element that snaps to the grid and guides (the inspector's
// Anchor point)
export const SNAP_REF_OPTIONS = [
  { id: 'ul', label: 'Upper Left',   fx: 0,   fy: 0   },
  { id: 'uc', label: 'Upper Center', fx: 0.5, fy: 0   },
  { id: 'ur', label: 'Upper Right',  fx: 1,   fy: 0   },
  { id: 'ml', label: 'Middle Left',  fx: 0,   fy: 0.5 },
  { id: 'mc', label: 'Center',       fx: 0.5, fy: 0.5 },
  { id: 'mr', label: 'Middle Right', fx: 1,   fy: 0.5 },
  { id: 'll', label: 'Lower Left',   fx: 0,   fy: 1   },
  { id: 'lc', label: 'Lower Center', fx: 0.5, fy: 1   },
  { id: 'lr', label: 'Lower Right',  fx: 1,   fy: 1   },
]
