#!/usr/bin/env node

/**
 * Patches the pixel-agents webview-ui build output to inject
 * an acquireVsCodeApi shim. This allows the VS Code extension's
 * webview to run inside a Kanbai Electron iframe.
 *
 * The shim is injected before </head> so it is available before
 * any application scripts execute.
 */

const fs = require('fs')
const path = require('path')

const htmlPath = path.join(
  __dirname,
  '..',
  'vendor',
  'pixel-agents',
  'dist',
  'webview',
  'index.html',
)

if (!fs.existsSync(htmlPath)) {
  console.error(`ERROR: ${htmlPath} not found. Run 'npm run build' in webview-ui first.`)
  process.exit(1)
}

const SHIM = `<script>
window.acquireVsCodeApi = function() {
  return {
    postMessage: function(msg) {
      window.parent.postMessage({ source: 'pixel-agents-webview', payload: msg }, '*');
    },
    getState: function() { return window.__paState || {}; },
    setState: function(s) { window.__paState = s; }
  };
};
// Hide "+ Agent" button — agents are auto-detected via Claude Code hooks
new MutationObserver(function(_, obs) {
  document.querySelectorAll('button').forEach(function(btn) {
    if (btn.textContent && btn.textContent.trim() === '+ Agent' && btn.parentElement) {
      btn.parentElement.style.display = 'none';
      obs.disconnect();
    }
  });
}).observe(document.body, { childList: true, subtree: true });
</script>`

let html = fs.readFileSync(htmlPath, 'utf-8')

// Remove any previously injected shim (idempotent)
html = html.replace(
  /<!-- pixel-agents-shim-start -->[\s\S]*?<!-- pixel-agents-shim-end -->/,
  '',
)

// Inject before </head> with markers for idempotency
const marker = `<!-- pixel-agents-shim-start -->\n${SHIM}\n<!-- pixel-agents-shim-end -->`
html = html.replace('</head>', `${marker}\n</head>`)

fs.writeFileSync(htmlPath, html, 'utf-8')
console.log('    Shim injected into', htmlPath)
