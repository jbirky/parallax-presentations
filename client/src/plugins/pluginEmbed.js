// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Plugin elements in present mode and exported HTML: the plugin's sandbox page
// with a window.parallax bridge that already holds the element's data. There's
// no editor to report changes to, so updateData only applies them in place;
// interactions work during the talk and aren't saved. The server builds the
// same thing in server/services/plugin-embed.js; keep the two in step.

function staticBridge({ data, width, height }) {
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
    fetch: function(url, opts) { return window.fetch(url, opts); }
  });
})();
<\/script><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style>`
}

export function buildStaticPluginSrcdoc(sandboxHtml, { data, width, height }) {
  const injection = staticBridge({ data, width, height })
  if (/<head[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<head[^>]*>/i, m => m + injection)
  if (/<html[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<html[^>]*>/i, m => m + injection)
  return injection + sandboxHtml
}
