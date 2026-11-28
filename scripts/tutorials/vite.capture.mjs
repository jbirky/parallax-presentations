// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The app as the hosted site builds it (cloud mode), with Clerk replaced by a
// signed-in stub (clerk-stub.jsx), for capture.py to drive. capture.py runs
// the build; by hand, from client/:
//   VITE_PARALLAX_MODE=cloud VITE_CLERK_PUBLISHABLE_KEY=pk_capture \
//     node ../node_modules/vite/bin/vite.js build -c ../scripts/tutorials/vite.capture.mjs --outDir <dir>
// It reads no .env: the mode and key come from the environment.

import path from 'path'
import { fileURLToPath } from 'url'
import { mergeConfig } from 'vite'
import base from '../../client/vite.config.js'

const here = path.dirname(fileURLToPath(import.meta.url))

export default mergeConfig(base, {
  root: path.resolve(here, '../../client'),
  envDir: here,
  resolve: { alias: { '@clerk/clerk-react': path.join(here, 'clerk-stub.jsx') } },
})
