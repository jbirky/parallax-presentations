// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useRef, useEffect, useCallback, useState } from 'react'
import { DATASETS_CLIENT } from '../utils/deckData'
import { loadVersionSandbox } from './versionSandboxes'

// A plugin element's sandbox page: fetched from sandboxUrl (a bundled or
// folder plugin's), loaded by version (sandboxVersion: { pluginId, version },
// a community plugin's), or given as html
export default function PluginSandbox({ sandboxUrl, sandboxVersion, html, pluginData, width, height, isSelected, onDataUpdate }) {
  const iframeRef = useRef(null)
  const dataRef = useRef(pluginData)
  dataRef.current = pluginData
  const [fetchedHtml, setFetchedHtml] = useState(null)
  const [unavailable, setUnavailable] = useState(false)
  const versionKey = sandboxVersion ? `${sandboxVersion.pluginId}@${sandboxVersion.version}` : null

  useEffect(() => {
    if (html != null) return
    const loading = sandboxVersion
      ? loadVersionSandbox(sandboxVersion.pluginId, sandboxVersion.version)
      : sandboxUrl ? fetch(sandboxUrl).then(r => (r.ok ? r.text() : null)).catch(() => null) : null
    if (!loading) return
    let stale = false
    setFetchedHtml(null)
    setUnavailable(false)
    loading.then(text => {
      if (stale) return
      if (text == null) setUnavailable(true)
      else setFetchedHtml(text)
    })
    return () => { stale = true }
  }, [sandboxUrl, versionKey, html]) // eslint-disable-line react-hooks/exhaustive-deps
  const pageHtml = html ?? fetchedHtml
  const wantsPage = html != null || !!sandboxUrl || !!sandboxVersion

  const postToSandbox = useCallback((type, payload) => {
    iframeRef.current?.contentWindow?.postMessage({ source: 'parallax-host', type, payload }, '*')
  }, [])

  useEffect(() => {
    postToSandbox('data-changed', pluginData || {})
  }, [pluginData, postToSandbox])

  useEffect(() => {
    postToSandbox('resize', { width, height })
  }, [width, height, postToSandbox])

  useEffect(() => {
    const handler = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return
      const msg = e.data
      if (!msg || msg.source !== 'parallax-sandbox') return

      switch (msg.type) {
        case 'update-data':
          onDataUpdate?.(msg.payload)
          break
        case 'ready':
          postToSandbox('init', {
            data: dataRef.current || {},
            width,
            height,
          })
          break
        case 'error':
          console.error(`[plugin-sandbox] ${msg.payload}`)
          break
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [width, height, postToSandbox, onDataUpdate])

  // inject the bridge script into the sandbox HTML
  const bridgeSrc = `
<!DOCTYPE html>
<html><head>
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style>
<script>
(function(){
  var _data = {};
  var _width = ${width};
  var _height = ${height};
  var _dataCallbacks = [];
  var _resizeCallbacks = [];
  var _snapshotCallback = null;

  window.parallax = Object.freeze({
    get data() { return JSON.parse(JSON.stringify(_data)); },
    get width() { return _width; },
    get height() { return _height; },
    updateData: function(patch) {
      Object.assign(_data, patch);
      window.parent.postMessage({ source: 'parallax-sandbox', type: 'update-data', payload: patch }, '*');
    },
    onDataChanged: function(cb) { _dataCallbacks.push(cb); },
    onResize: function(cb) { _resizeCallbacks.push(cb); },
    onCaptureSnapshot: function(cb) { _snapshotCallback = cb; },
    reportError: function(msg) {
      window.parent.postMessage({ source: 'parallax-sandbox', type: 'error', payload: msg }, '*');
    },
    fetch: function(url, opts) { return window.fetch(url, opts); },
    // Answered by the editor (datasets/embedBridge.js)
    datasets: ${DATASETS_CLIENT}
  });

  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (e.source !== window.parent || !msg || msg.source !== 'parallax-host') return;
    if (msg.type === 'init' || msg.type === 'data-changed') {
      _data = msg.payload.data || msg.payload;
      _dataCallbacks.forEach(function(cb) { cb(JSON.parse(JSON.stringify(_data))); });
    }
    if (msg.type === 'resize') {
      _width = msg.payload.width;
      _height = msg.payload.height;
      _resizeCallbacks.forEach(function(cb) { cb(_width, _height); });
    }
    if (msg.type === 'capture-snapshot' && _snapshotCallback) {
      Promise.resolve(_snapshotCallback(msg.payload || {})).then(function(result) {
        window.parent.postMessage({ source: 'parallax-sandbox', type: 'snapshot-result', payload: result }, '*');
      });
    }
  });

  window.parent.postMessage({ source: 'parallax-sandbox', type: 'ready' }, '*');
})();
<\/script>
</head><body></body></html>`

  const bridgeScript = bridgeSrc.match(/<script>[\s\S]*?<\/script>/)?.[0] || ''
  const bridgeStyle = bridgeSrc.match(/<style>[\s\S]*?<\/style>/)?.[0] || ''
  const injection = bridgeScript + bridgeStyle

  let srcdoc
  if (pageHtml) {
    if (/<head[^>]*>/i.test(pageHtml)) {
      srcdoc = pageHtml.replace(/<head[^>]*>/i, m => m + injection)
    } else if (/<html[^>]*>/i.test(pageHtml)) {
      srcdoc = pageHtml.replace(/<html[^>]*>/i, m => m + injection)
    } else {
      srcdoc = injection + pageHtml
    }
  } else if (!wantsPage) {
    srcdoc = bridgeSrc
  }

  if (unavailable && !pageHtml) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 8, boxSizing: 'border-box',
        background: 'rgba(128,128,128,0.08)', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'sans-serif',
      }}>
        This plugin isn’t available
      </div>
    )
  }

  if (!srcdoc && !wantsPage) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(99,102,241,0.06)', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'sans-serif',
      }}>
        Plugin element
      </div>
    )
  }

  if (wantsPage && !srcdoc) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading plugin...</div>
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      style={{
        width: '100%', height: '100%', border: 'none', display: 'block', background: 'transparent',
        pointerEvents: isSelected ? 'auto' : 'none',
      }}
      title="Plugin sandbox"
    />
  )
}
