// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What an HTML embed's page knows of the deck around it, and what the deck
// hears back from it.
//
// In the embed (window.parallax, beside parallax.datasets):
// - parallax.steps: how many of the slide's clicks the embed takes (its
//   element's `steps`), and parallax.step, the one it is at (0 until the
//   first). Its step k is the slide's click stepStart - 1 + k, counted with
//   the slide's other steps, as a diagram's are.
// - parallax.onStep(fn): fn(step, from) now and whenever the step changes.
//   Stepping back to a slide jumps from 0 to the last step at once, so a
//   page draws the state of a step, and animates only a change of one.
// - parallax.shown, parallax.onShow(fn), parallax.onHide(fn): whether its
//   slide is the one showing. A deck loads every slide's embeds when it
//   opens, so an animation waits for onShow rather than running on load.
// - Its errors, failed loads, rejected promises and console.error lines go
//   to the deck, which keeps them in window.__parallaxEmbedProblems for
//   the slide renderer (server/services/slide-thumbnail.js) to report.
//
// Where nothing tells it otherwise (the editor's canvas, the code editor's
// preview), the embed is shown, at its last step.

export const MAX_EMBED_STEPS = 50
const MAX_PROBLEMS = 10

// The element's steps and the slide click its first comes at
export function htmlEmbedModel(el) {
  const steps = Math.round(Number(el?.steps))
  const start = Math.round(Number(el?.stepStart))
  return {
    steps: steps >= 1 && steps <= MAX_EMBED_STEPS ? steps : 0,
    stepStart: start >= 1 && start <= 1000 ? start : 1,
  }
}

// [slide click, embed step] for each of an HTML embed's steps
export function htmlEmbedSteps(el) {
  if (el?.type !== 'html') return []
  const { steps, stepStart } = htmlEmbedModel(el)
  const out = []
  for (let k = 1; k <= steps && stepStart - 1 + k <= 1000; k++) out.push([stepStart - 1 + k, k])
  return out
}

const safeId = id => String(id || '').replace(/[^A-Za-z0-9_-]/g, '')

// A slide's hidden fragments for its embeds' steps; HTML_EMBED_DECK_SCRIPT
// tells each embed the last one showing. Reveal renumbers
// data-fragment-index from 0, so the embed's own step is kept apart
export function htmlEmbedStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = safeId(el.id)
    for (const [n, k] of htmlEmbedSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-html-step="${id}" data-html-step-at="${k}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}

// Runs in the embed's page, first: win is its window; init is
// { steps, step, shown, shift, from }, where lines past `from` are
// reported `shift` lines earlier, as they were in the element's content
/* eslint-disable no-var */
function embedRuntime(win, init) {
  var state = { step: init.step, shown: init.shown };
  var listeners = { step: [], show: [], hide: [] };
  var reported = 0;
  function report(message) {
    if (reported >= init.max) return;
    reported++;
    try { win.parent.postMessage({ source: 'parallax-embed', type: 'problem', message: String(message).slice(0, 300) }, '*'); } catch (e) { /* the deck went away */ }
  }
  function lineOf(n) { return n > init.from ? n - init.shift : n; }
  win.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== win && t.tagName) { report('Couldn’t load ' + (t.src || t.href || ('a <' + t.tagName.toLowerCase() + '>'))); return; }
    report((e.message || 'Script error') + (e.lineno ? ' (line ' + lineOf(e.lineno) + ')' : ''));
  }, true);
  win.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    report('Unhandled promise rejection: ' + (r && r.message ? r.message : r));
  });
  var original = win.console && win.console.error;
  if (original) {
    win.console.error = function () {
      report(Array.prototype.map.call(arguments, function (a) { return a && a.message ? a.message : String(a); }).join(' '));
      return original.apply(this, arguments);
    };
  }
  // A listener that throws is reported as any error is, and the rest still run
  function call(fn, a, b) { try { fn(a, b); } catch (err) { setTimeout(function () { throw err; }); } }
  function on(kind, fn, now) {
    if (typeof fn !== 'function') return function () {};
    listeners[kind].push(fn);
    if (now) now();
    return function () { listeners[kind] = listeners[kind].filter(function (f) { return f !== fn; }); };
  }
  win.addEventListener('message', function (e) {
    var d = e.data;
    if (e.source !== win.parent || !d || d.source !== 'parallax-deck' || d.type !== 'embed-state') return;
    var step = Math.max(0, Math.min(init.steps, Math.round(Number(d.step)) || 0));
    var shown = !!d.shown;
    if (shown && !state.shown) { state.shown = true; listeners.show.slice().forEach(function (fn) { call(fn); }); }
    if (step !== state.step) { var from = state.step; state.step = step; listeners.step.slice().forEach(function (fn) { call(fn, step, from); }); }
    if (!shown && state.shown) { state.shown = false; listeners.hide.slice().forEach(function (fn) { call(fn); }); }
  });
  var prev = win.parallax || {};
  var api = {
    onStep: function (fn) { return on('step', fn, function () { call(fn, state.step, state.step); }); },
    onShow: function (fn) { return on('show', fn, state.shown ? function () { call(fn); } : null); },
    onHide: function (fn) { return on('hide', fn); },
  };
  Object.defineProperties(api, {
    steps: { value: init.steps, enumerable: true },
    step: { get: function () { return state.step; }, enumerable: true },
    shown: { get: function () { return state.shown; }, enumerable: true },
  });
  if (prev.datasets) api.datasets = prev.datasets;
  win.parallax = Object.freeze(api);
  // The deck says where the embed is as soon as it hears this
  try { win.parent.postMessage({ source: 'parallax-embed', type: 'hello' }, '*'); } catch (e) { /* no deck */ }
}
/* eslint-enable no-var */

const RUNTIME_CODE = `(${embedRuntime.toString()})`.replace(/<\/(script)/gi, '<\\/$1')

// The embed's page: its own HTML with `before` (the scripts and styles every
// embed gets) and the runtime injected first thing. opts: { steps, inDeck }.
// In a deck the embed waits to be told where it is; elsewhere it is shown at
// its last step
export function embedPage(userHtml, before, { steps = 0, inDeck = false } = {}) {
  const init = { steps, step: inDeck ? 0 : steps, shown: !inDeck, max: MAX_PROBLEMS }
  const script = s => `<script>${s}<\/script>`
  const injected = (shift, from) => before + script(`${RUNTIME_CODE}(window,${JSON.stringify({ ...init, shift, from })});`)
  // The lines the injection adds (numbers add none), so errors name the
  // content's own lines: the content's line n past the injection point is
  // the page's line n + shift
  const shift = (injected(0, 0).match(/\n/g) || []).length
  const at = injectionPoint(userHtml)
  const linesBefore = (userHtml.slice(0, at).match(/\n/g) || []).length
  return userHtml.slice(0, at) + injected(shift, linesBefore + shift) + userHtml.slice(at)
}

// Where the injection goes: into <head>, else after <html> or the doctype,
// so the doctype stays first (standards mode); a snippet gets it first
function injectionPoint(userHtml) {
  for (const re of [/<head[^>]*>/i, /<html[^>]*>/i, /<!doctype[^>]*>/i]) {
    const m = re.exec(userHtml)
    if (m) return m.index + m[0].length
  }
  return 0
}

// In a deck's <head>: keeps what its HTML embeds report, by element and
// slide, for the slide renderer to read
export const EMBED_PROBLEMS_SCRIPT = `<script>
  (function() {
    var problems = window.__parallaxEmbedProblems = [];
    window.addEventListener('message', function(e) {
      var d = e.data;
      if (!d || d.source !== 'parallax-embed' || d.type !== 'problem' || problems.length >= 200) return;
      var frame = Array.prototype.find.call(document.querySelectorAll('iframe[data-html-embed]'), function(f) { return f.contentWindow === e.source; });
      if (!frame) return;
      var section = frame.closest('section[data-slide-id]');
      problems.push({ element: frame.getAttribute('data-html-embed'), slide: section ? section.getAttribute('data-slide-id') : null, message: String(d.message).slice(0, 300) });
    });
  })();
</script>`

// In a deck with HTML embeds: tells each whether its slide is showing and
// the step it is at, whenever that may have changed and when it asks
export const HTML_EMBED_DECK_SCRIPT = `
    (function() {
      function frames() { return document.querySelectorAll('iframe[data-html-embed]'); }
      function stepOf(frame, slide) {
        var id = frame.getAttribute('data-html-embed'), n = 0;
        slide.querySelectorAll('.fragment[data-html-step]').forEach(function(m) {
          if (m.getAttribute('data-html-step') === id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-html-step-at') || 0);
        });
        return n;
      }
      function send(frame) {
        var slide = frame.closest('section');
        if (!slide || !frame.contentWindow) return;
        try { frame.contentWindow.postMessage({ source: 'parallax-deck', type: 'embed-state', shown: slide === Reveal.getCurrentSlide(), step: stepOf(frame, slide) }, '*'); } catch (e) {}
      }
      function sendAll() { Array.prototype.forEach.call(frames(), send); }
      Array.prototype.forEach.call(frames(), function(frame) { frame.addEventListener('load', function() { send(frame); }); });
      window.addEventListener('message', function(e) {
        var d = e.data;
        if (!d || d.source !== 'parallax-embed' || d.type !== 'hello' || !Reveal.isReady()) return;
        var frame = Array.prototype.find.call(frames(), function(f) { return f.contentWindow === e.source; });
        if (frame) send(frame);
      });
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sendAll); });
    })();
`
