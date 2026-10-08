// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Plugin elements in present mode and exported HTML: the plugin's sandbox page
// with a window.parallax bridge that already holds the element's data. There's
// no editor to report changes to, so updateData only applies them in place;
// interactions work during the talk and aren't saved. Shared, live and
// exported presentations from the server have it through
// server/services/deck-html.js, with sandbox pages read from the plugins'
// folders (server/services/plugin-embed.js). In a deck with datasets,
// parallax.datasets asks the deck, which answers from the data it carries
// (utils/deckData.js).

import { DATASETS_CLIENT } from '../utils/deckData'

function staticBridge({ data, width, height, datasets }) {
  // < keeps "</script>" inside the data from closing the script early
  const json = JSON.stringify(data || {}).replace(/</g, '\\u003c')
  return `<script>
(function(){
  var _data = ${json};
  var _width = ${Number(width) || 0};
  var _height = ${Number(height) || 0};
  var _dataCallbacks = [];
  function copy() { return JSON.parse(JSON.stringify(_data)); }
  window.parallax = Object.freeze({
    get data() { return copy(); },
    get width() { return _width; },
    get height() { return _height; },
    updateData: function(patch) {
      Object.assign(_data, patch);
      _dataCallbacks.forEach(function(cb) { cb(copy()); });
    },
    onDataChanged: function(cb) { _dataCallbacks.push(cb); },
    onResize: function() {},
    onCaptureSnapshot: function() {},
    reportError: function(msg) { console.error('[plugin] ' + msg); },
    fetch: function(url, opts) { return window.fetch(url, opts); }${datasets ? `,
    datasets: ${DATASETS_CLIENT}` : ''}
  });
})();
<\/script><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style>`
}

// datasets: parallax.datasets, in a deck that carries some
export function buildStaticPluginSrcdoc(sandboxHtml, { data, width, height, datasets = false }) {
  const injection = staticBridge({ data, width, height, datasets })
  if (/<head[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<head[^>]*>/i, m => m + injection)
  if (/<html[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<html[^>]*>/i, m => m + injection)
  return injection + sandboxHtml
}
