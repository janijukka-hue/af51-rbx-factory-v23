#!/usr/bin/env bash
# Fetch Three.js into ./vendor for fully offline preview.
# Pinned version: r160.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
VER="${THREE_VERSION:-0.160.0}"
BASE="https://unpkg.com/three@${VER}"
DEST="${HERE}/vendor"

mkdir -p "${DEST}/three-addons/controls"
echo "→ three@${VER}/build/three.module.js"
curl -fsSL "${BASE}/build/three.module.js" -o "${DEST}/three.module.js"
echo "→ three@${VER}/examples/jsm/controls/OrbitControls.js"
curl -fsSL "${BASE}/examples/jsm/controls/OrbitControls.js" -o "${DEST}/three-addons/controls/OrbitControls.js"

echo
echo "Vendor ready: ${DEST}"
echo "Reload http://localhost:8765/ — three.js now loads locally."
