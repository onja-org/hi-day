#!/usr/bin/env bash
# Builds firefox-ax-helper and copies it to native/darwin/firefox-ax-helper —
# the path the TypeScript resolver spawns and electron-builder bundles.
#
# Default is a universal (arm64 + x86_64) binary, which is what a release must
# ship. That goes through SwiftPM's multi-arch path, which uses XCBuild and so
# requires FULL XCODE; with only the Command Line Tools installed it fails with
#   xcbuild executable at '.../XCBuild.framework/...' does not exist
#
# Pass --native to build for this machine's architecture only, using the plain
# SwiftPM path that Command Line Tools can drive. Enough to test locally; NOT
# enough to ship.
set -euo pipefail
cd "$(dirname "$0")"

NATIVE_ONLY=0
[ "${1:-}" = "--native" ] && NATIVE_ONLY=1

DEST="../firefox-ax-helper"

if [ "$NATIVE_ONLY" -eq 1 ]; then
  echo "Building for this machine's architecture only (--native)." >&2
  echo "This binary is NOT universal and must not be shipped." >&2
  swift build -c release
  BUILT_BINARY=".build/release/firefox-ax-helper"
else
  if ! swift build -c release --arch arm64 --arch x86_64; then
    echo >&2
    echo "error: universal build failed." >&2
    echo "  A universal build needs full Xcode — the Command Line Tools alone" >&2
    echo "  cannot drive it. Install Xcode, or re-run with --native to build" >&2
    echo "  only for this machine (fine for testing, not for release)." >&2
    exit 1
  fi
  BUILT_BINARY=".build/apple/Products/Release/firefox-ax-helper"
fi

if [ ! -f "$BUILT_BINARY" ]; then
  echo "error: expected binary at $BUILT_BINARY — swift build output layout may have changed." >&2
  exit 1
fi

cp "$BUILT_BINARY" "$DEST"
chmod +x "$DEST"
echo "Copied binary to $(cd .. && pwd)/firefox-ax-helper"
lipo -info "$DEST" || true
