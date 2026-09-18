#!/usr/bin/env bash

set -euo pipefail
cd "$(dirname "$0")"

SOURCE="Sources/firefox-ax-helper/main.swift"
DEST="../firefox-ax-helper"
# Matches Package.swift's platforms: [.macOS(.v11)].
DEPLOYMENT_TARGET="11.0"
SDK="$(xcrun --sdk macosx --show-sdk-path)"

build_arch() {
  xcrun swiftc -O \
    -sdk "$SDK" \
    -target "$1-apple-macos$DEPLOYMENT_TARGET" \
    -framework ApplicationServices \
    -o "$2" "$SOURCE"
}

if [ "${1:-}" = "--native" ]; then
  echo "Building for $(uname -m) only (--native)." >&2
  echo "This binary is NOT universal and must not be shipped." >&2
  build_arch "$(uname -m)" "$DEST"
else
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  for arch in arm64 x86_64; do
    if ! build_arch "$arch" "$TMP/$arch"; then
      echo >&2
      echo "error: could not build for $arch." >&2
      echo "  Cross-compiling both slices needs an SDK carrying both. Re-run" >&2
      echo "  with --native to build only for this machine (fine for testing," >&2
      echo "  not for release)." >&2
      exit 1
    fi
  done
  lipo -create -output "$DEST" "$TMP/arm64" "$TMP/x86_64"
fi

chmod +x "$DEST"
echo "Built $(cd .. && pwd)/firefox-ax-helper"
lipo -info "$DEST" || true
