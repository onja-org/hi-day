#!/usr/bin/env bash
# Builds firefox-ax-helper as a universal (arm64 + x86_64) binary and copies
# it out to native/darwin/firefox-ax-helper — the path the TypeScript
# resolver actually spawns, and what electron-builder's extraResources
# bundles. Run this on macOS with Xcode command line tools installed; there
# is no way to run or verify this script outside that environment.
set -euo pipefail
cd "$(dirname "$0")"

swift build -c release --arch arm64 --arch x86_64

BUILT_BINARY=".build/apple/Products/Release/firefox-ax-helper"
if [ ! -f "$BUILT_BINARY" ]; then
  echo "error: expected universal binary at $BUILT_BINARY — swift build output layout may have changed." >&2
  exit 1
fi

DEST="../firefox-ax-helper"
cp "$BUILT_BINARY" "$DEST"
chmod +x "$DEST"
echo "Copied universal binary to $(cd .. && pwd)/firefox-ax-helper"
lipo -info "$DEST" || true
