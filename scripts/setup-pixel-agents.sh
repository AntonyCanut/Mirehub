#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$PROJECT_ROOT/vendor/pixel-agents"
WEBVIEW_DIR="$VENDOR_DIR/webview-ui"

echo "==> Setting up pixel-agents..."

# Clone if not already present
if [ ! -d "$VENDOR_DIR" ]; then
  echo "    Cloning pixel-agents repository..."
  mkdir -p "$PROJECT_ROOT/vendor"
  git clone https://github.com/pablodelucca/pixel-agents.git "$VENDOR_DIR"
else
  echo "    pixel-agents already cloned, pulling latest..."
  cd "$VENDOR_DIR" && git pull && cd "$PROJECT_ROOT"
fi

# Build webview-ui
echo "    Installing webview-ui dependencies..."
cd "$WEBVIEW_DIR"
npm install
echo "    Building webview-ui..."
npm run build
cd "$PROJECT_ROOT"

# Patch the built HTML with acquireVsCodeApi shim
echo "    Patching dist/index.html with acquireVsCodeApi shim..."
node "$SCRIPT_DIR/patch-pixel-agents-html.js"

echo "==> pixel-agents setup complete!"
