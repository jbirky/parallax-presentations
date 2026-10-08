// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Makes an upload or a fetched response ready to store, off the server's
// main thread: a large one parsed there would hold up every other request.
// Started once per body by runInWorker (dataset-service.js).

const { parentPort, workerData } = require('worker_threads')
const { processBody } = require('./dataset-table')

const { body, format, opts } = workerData
processBody(Buffer.from(body.buffer, body.byteOffset, body.byteLength), format, opts)
  .then(out => parentPort.postMessage({ ok: true, ...out }))
  .catch(err => parentPort.postMessage({ ok: false, error: err.message }))
