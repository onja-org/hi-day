#!/usr/bin/env bash
# Builds firefox-ax-helper and copies it to native/darwin/firefox-ax-helper —
# the path the TypeScript resolver spawns and electron-builder bundles.
#
# Compiles with swiftc directly rather than through SwiftPM. This is one source
# file linking one framework, so a package manager buys nothing, and SwiftPM
# brought three separate failures on a Command-Line-Tools-only machine: a
# tools-version gate, XCBuild (full Xcode only) for multi-arch, and a manifest
# that would not compile at all —
#
#   error: no such module 'PackageDescription'
#
# swiftc needs none of that. Package.swift stays for editor/SwiftPM users but
# is not on this path.
#
# Default is universal (arm64 + x86_64), which is what a release must ship.
# --native builds only for this machine: enough to test, NOT enough to ship.
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
