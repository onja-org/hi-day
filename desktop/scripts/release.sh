#!/usr/bin/env bash
#
# Cuts a desktop release by hand, without GitHub-hosted runners — the same
# draft → upload everything → publish sequence desktop-build.yml ran, just on
# our own machines. Installed apps only ever read the public releases repo, so
# where a file was built doesn't matter as long as every platform's installers
# and latest*.yml land in the same release before it is published.
#
#   release.sh tag      <version>              tag origin/main and push the tag
#   release.sh prepare  <version>              worktree at the tag + draft release
#   release.sh build    <version> <platform>   linux | win | mac | auto, then upload
#   release.sh status   <version>              which of the 15 files are uploaded
#   release.sh publish  <version> [--yes]      refuse unless all 15 are there
#   release.sh verify   <version>              published latest*.yml show <version>
#
# `build` takes --no-upload (build only, e.g. to test a platform) and `auto`
# means linux+win on Linux, mac on macOS. Every command is safe to re-run.
#
# Environment overrides: RELEASES_REPO, RELEASE_WORKTREE (default
# ../hiday-release-<version> next to this clone), and RELEASE_REF — build some
# other commit instead of the tag, for a --no-upload test build only.

set -euo pipefail

SOURCE_REPO="onja-org/hi-day"
RELEASES_REPO="${RELEASES_REPO:-onja-org/hi-day-releases}"
REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"

# Pinned so a release build never silently changes toolchain. The wine image
# carries Node 22 (pnpm 11 needs >= 22.13) plus Wine for rcedit/NSIS.
DOTNET_IMAGE="mcr.microsoft.com/dotnet/sdk:8.0"
WINE_IMAGE="electronuserland/builder:22-wine-05.26"
PNPM_VERSION="11.1.3"

# Must match what the landing page links to and what electron-updater reads —
# these are exactly the assets desktop-v0.3.3 shipped with.
LINUX_FILES=(hiday-linux-x86_64.AppImage hiday-linux-amd64.deb latest-linux.yml)
WIN_FILES=(hiday-win-x64.exe hiday-win-x64.exe.blockmap latest.yml)
MAC_FILES=(
  hiday-mac-arm64.dmg hiday-mac-arm64.dmg.blockmap
  hiday-mac-arm64.zip hiday-mac-arm64.zip.blockmap
  hiday-mac-x64.dmg hiday-mac-x64.dmg.blockmap
  hiday-mac-x64.zip hiday-mac-x64.zip.blockmap
  latest-mac.yml
)
ALL_FILES=("${LINUX_FILES[@]}" "${WIN_FILES[@]}" "${MAC_FILES[@]}")

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok() { printf '\033[32m✔ %s\033[0m\n' "$*"; }
die() { printf '\033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

usage() { sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-1}"; }

# --- checks -----------------------------------------------------------------

check_version_arg() {
  [[ "${VERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Version must look like 0.3.4 (got '${VERSION:-}')."
}

check_node() {
  command -v node >/dev/null || die "node not found. Install Node 22 (nvm use 22)."
  node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)' \
    || die "Node $(node -v) is too old; pnpm 11 needs >= 22.13. Run: nvm use 22"
  command -v pnpm >/dev/null || die "pnpm not found. Run: npm install -g pnpm@$PNPM_VERSION"
  pnpm -v >/dev/null 2>&1 || die "pnpm is installed but won't run. Run: npm install -g pnpm@$PNPM_VERSION"
}

check_gh() {
  command -v gh >/dev/null || die "gh CLI not found."
  local push
  push="$(gh api "repos/$RELEASES_REPO" --jq '.permissions.push' 2>/dev/null || true)"
  [ "$push" = "true" ] || die "Your gh login can't write to $RELEASES_REPO. Run 'gh auth login' with an account that has write access, or export GH_TOKEN."
}

# A tag push would otherwise start the old CI release, which (once minutes come
# back) re-uploads over what we built here.
check_ci_disabled() {
  local state
  state="$(gh api "repos/$SOURCE_REPO/actions/workflows/desktop-build.yml" --jq '.state' 2>/dev/null || echo unknown)"
  case "$state" in
    disabled_manually|disabled_inactivity) ;;
    *) die "The 'Desktop build' workflow is '$state'. Disable it first:
  gh workflow disable desktop-build.yml --repo $SOURCE_REPO" ;;
  esac
}

tag_exists_on_origin() {
  git -C "$REPO_ROOT" ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1
}

# --- release state ----------------------------------------------------------

# Prints "draft", "published" or "missing".
release_state() {
  local draft
  draft="$(gh release view "$TAG" --repo "$RELEASES_REPO" --json isDraft --jq '.isDraft' 2>/dev/null || echo missing)"
  case "$draft" in
    true) echo draft ;;
    false) echo published ;;
    *) echo missing ;;
  esac
}

uploaded_assets() {
  gh release view "$TAG" --repo "$RELEASES_REPO" --json assets --jq '.assets[].name'
}

missing_assets() {
  local have
  have="$(uploaded_assets)"
  for f in "${ALL_FILES[@]}"; do
    grep -qxF "$f" <<<"$have" || echo "$f"
  done
}

# --- worktree ---------------------------------------------------------------

ensure_worktree() {
  git -C "$REPO_ROOT" fetch --quiet origin "refs/tags/$TAG:refs/tags/$TAG" 2>/dev/null || true
  local tag_commit
  tag_commit="$(git -C "$REPO_ROOT" rev-parse "$REF^{commit}" 2>/dev/null)" \
    || die "$REF doesn't exist. Run: $0 tag $VERSION"

  if [ -d "$WORKTREE" ]; then
    [ "$(git -C "$WORKTREE" rev-parse HEAD)" = "$tag_commit" ] \
      || die "$WORKTREE exists but isn't at $REF. Remove it: git worktree remove --force $WORKTREE"
    [ -z "$(git -C "$WORKTREE" status --porcelain --untracked-files=no)" ] \
      || die "$WORKTREE has local changes. Release builds must come from the tag as-is."
  else
    step "Creating a clean worktree of $REF at $WORKTREE"
    git -C "$REPO_ROOT" worktree add --detach "$WORKTREE" "$tag_commit" >/dev/null
  fi

  local pkg_version
  pkg_version="$(node -p "require('$WORKTREE/desktop/package.json').version")"
  [ "$pkg_version" = "$VERSION" ] || die "desktop/package.json at $REF says $pkg_version, not $VERSION. The tag is on the wrong commit."

  step "Installing dependencies (frozen lockfile)"
  (cd "$WORKTREE" && pnpm install --frozen-lockfile)
  ok "Worktree ready at $WORKTREE ($REF, version $VERSION)"
}

# --- build helpers ----------------------------------------------------------

lint_and_test() {
  step "Lint and test desktop"
  (cd "$WORKTREE" && pnpm --filter desktop lint)
  # While desktop still uses better-sqlite3, vitest needs it built for plain
  # Node's ABI; the dist:* scripts rebuild it for Electron's again afterwards.
  if node -e "process.exit(require('$WORKTREE/desktop/package.json').scripts?.['rebuild:node'] ? 0 : 1)"; then
    (cd "$WORKTREE" && pnpm --filter desktop rebuild:node)
  fi
  (cd "$WORKTREE" && pnpm --filter desktop test)
}

# Fails if any expected file is missing or a latest*.yml is for another version
# — uploading a stale yml is how users end up told about the wrong release.
check_outputs() {
  local yml="$1"; shift
  local out="$WORKTREE/desktop/release"
  for f in "$@"; do
    [ -f "$out/$f" ] || die "Build finished but $out/$f is missing."
  done
  grep -qx "version: $VERSION" "$out/$yml" || die "$yml is not for $VERSION: $(head -1 "$out/$yml")"
}

upload() {
  local out="$WORKTREE/desktop/release" paths=()
  for f in "$@"; do paths+=("$out/$f"); done
  if [ "$NO_UPLOAD" = 1 ]; then
    ok "Built (not uploaded, --no-upload): $*"
    return
  fi
  [ "$(release_state)" = "draft" ] || die "$TAG is not a draft on $RELEASES_REPO (it's $(release_state)). Run '$0 prepare $VERSION' first; never upload into a published release."
  step "Uploading to the $TAG draft"
  gh release upload "$TAG" "${paths[@]}" --repo "$RELEASES_REPO" --clobber
  ok "Uploaded: $*"
}

build_linux() {
  [ "$(uname -s)" = "Linux" ] || die "Linux installers must be built on Linux."
  step "Building Linux installers"
  rm -rf "$WORKTREE/desktop/release"
  (cd "$WORKTREE" && pnpm --filter desktop dist:linux)
  check_outputs latest-linux.yml "${LINUX_FILES[@]}"
  upload "${LINUX_FILES[@]}"
}

# Native addons compiled at install time (rather than shipped as prebuilds/)
# come out built for this Linux host, and with npmRebuild: false nothing swaps
# them, so the Windows installer would carry a Linux .node that fails to load.
# better-sqlite3 was one (main before the node:sqlite switch); refuse up front.
win_cross_buildable() {
  ! node -e "process.exit(require('$WORKTREE/desktop/package.json').dependencies?.['better-sqlite3'] ? 0 : 1)"
}

check_win_cross_buildable() {
  if ! win_cross_buildable; then
    die "This commit still depends on better-sqlite3, which can't be built for Windows from Linux.
  Build Windows on a Windows PC instead (pnpm --filter desktop dist:win, then upload ${WIN_FILES[*]}),
  or release once the node:sqlite change (chore/desktop-node-sqlite) is on main."
  fi
}

# Backstop for any future addon: every compiled .node in the package must be a
# Windows binary. prebuilds/ is skipped on purpose — it holds every platform's.
check_win_native_addons() {
  local bad
  bad="$(find "$1" -path '*/build/Release/*.node' -exec file {} + | grep -v 'PE32' || true)"
  [ -z "$bad" ] || die "The Windows package contains non-Windows native addons:
$bad
  Build Windows on a Windows PC instead (pnpm --filter desktop dist:win)."
}

# Built from Linux in two containers instead of `pnpm dist:win`, which expects
# dotnet on the host: one publishes win-resolver.exe (EnableWindowsTargeting lets
# the Linux SDK build a net8.0-windows project), one runs electron-builder under
# Wine. Nothing in the worktree is left root-owned afterwards.
build_win() {
  [ "$(uname -s)" = "Linux" ] || die "This script builds Windows from Linux. On Windows itself run: pnpm --filter desktop dist:win"
  command -v docker >/dev/null || die "docker not found."
  docker info >/dev/null 2>&1 || die "Can't talk to Docker. Is it running, and are you in the docker group?"

  # electron-builder's Linux makensis dies with "stack smashing detected" on
  # long paths: a ~140-char worktree path crashed it, ~50 chars works.
  [ "${#WORKTREE}" -le 80 ] || die "Worktree path is ${#WORKTREE} chars; makensis crashes on long paths. Use a shorter RELEASE_WORKTREE (<= 80)."

  local uid_gid; uid_gid="$(id -u):$(id -g)"
  mkdir -p "$HOME/.cache/electron" "$HOME/.cache/electron-builder"

  # As root: the SDK's first-run NuGet mutex fails for a non-root uid. Ownership
  # of what it wrote is handed back afterwards; the NuGet cache lives in a named
  # volume so it never lands root-owned in $HOME.
  step "Building win-resolver.exe (.NET in Docker)"
  docker run --rm -e DOTNET_CLI_TELEMETRY_OPTOUT=1 -e DOTNET_NOLOGO=1 \
    -v hiday-release-nuget:/root/.nuget/packages \
    -v "$WORKTREE:$WORKTREE" -w "$WORKTREE" "$DOTNET_IMAGE" \
    sh -c "dotnet publish native/win/resolver/WinResolver/WinResolver.csproj \
             -c Release -r win-x64 --self-contained \
             -p:PublishSingleFile=true -p:EnableWindowsTargeting=true; \
           rc=\$?; chown -R $uid_gid native/win; exit \$rc"

  step "Compiling the app"
  rm -rf "$WORKTREE/desktop/release"
  (cd "$WORKTREE" && pnpm --filter desktop build)

  # electron-builder runs `pnpm list` to collect production deps, and pnpm
  # opens the store the worktree was installed from — so that store is mounted
  # at its host path (read-write: pnpm 11 keeps a SQLite index there).
  local store; store="$(cd "$WORKTREE" && pnpm store path)"
  step "Packaging the Windows installer (electron-builder under Wine in Docker)"
  docker run --rm -u "$uid_gid" -e HOME=/tmp/home -v "$store:$store" \
    -e ELECTRON_CACHE=/cache/electron -e ELECTRON_BUILDER_CACHE=/cache/electron-builder \
    -v "$HOME/.cache/electron:/cache/electron" \
    -v "$HOME/.cache/electron-builder:/cache/electron-builder" \
    -v "$WORKTREE:$WORKTREE" -w "$WORKTREE/desktop" "$WINE_IMAGE" \
    bash -euc "
      mkdir -p /tmp/home
      npm install -g --silent --prefix /tmp/home/.npm-global pnpm@$PNPM_VERSION
      export PATH=/tmp/home/.npm-global/bin:\$PATH
      node_modules/.bin/electron-builder --win --publish never
    "

  check_win_native_addons "$WORKTREE/desktop/release/win-unpacked"
  check_outputs latest.yml "${WIN_FILES[@]}"
  upload "${WIN_FILES[@]}"
}

build_mac() {
  [ "$(uname -s)" = "Darwin" ] || die "macOS installers must be built on a Mac."
  xcrun --sdk macosx --show-sdk-path >/dev/null 2>&1 || die "Xcode command line tools missing. Run: xcode-select --install"
  step "Building macOS installers (x64 + arm64)"
  rm -rf "$WORKTREE/desktop/release"
  (cd "$WORKTREE" && pnpm --filter desktop dist:mac)
  check_outputs latest-mac.yml "${MAC_FILES[@]}"
  upload "${MAC_FILES[@]}"
}

# --- commands ---------------------------------------------------------------

cmd_tag() {
  check_gh
  check_ci_disabled
  git -C "$REPO_ROOT" fetch --quiet origin main
  local main_version
  main_version="$(git -C "$REPO_ROOT" show origin/main:desktop/package.json | node -p 'JSON.parse(require("fs").readFileSync(0)).version')"
  [ "$main_version" = "$VERSION" ] || die "origin/main's desktop/package.json is $main_version, not $VERSION. Merge the version bump first."
  if tag_exists_on_origin; then
    ok "$TAG already exists on origin."
    return
  fi
  git -C "$REPO_ROOT" tag "$TAG" origin/main
  git -C "$REPO_ROOT" push origin "refs/tags/$TAG"
  ok "Tagged origin/main ($(git -C "$REPO_ROOT" rev-parse --short origin/main)) as $TAG and pushed it."
}

cmd_prepare() {
  check_node
  check_gh
  check_ci_disabled
  tag_exists_on_origin || die "Tag $TAG isn't on origin. Run: $0 tag $VERSION"
  ensure_worktree
  case "$(release_state)" in
    draft) ok "Draft release $TAG already exists on $RELEASES_REPO, reusing it." ;;
    published) die "$TAG is already published on $RELEASES_REPO. Bump the version for a new release." ;;
    missing)
      step "Creating draft release $TAG on $RELEASES_REPO"
      gh release create "$TAG" --repo "$RELEASES_REPO" --title "Desktop $TAG" --generate-notes --draft >/dev/null
      ok "Draft created (hidden from users until published)." ;;
  esac
}

cmd_build() {
  check_node
  if [ "$NO_UPLOAD" != 1 ]; then
    check_gh
    # Checked up front rather than at upload time, 10+ minutes of building later.
    [ "$(release_state)" = draft ] || die "$TAG is not a draft on $RELEASES_REPO (it's $(release_state)). Run '$0 prepare $VERSION' first."
  fi
  ensure_worktree
  local platforms
  case "$PLATFORM" in
    linux|win|mac) platforms=("$PLATFORM") ;;
    auto)
      case "$(uname -s)" in
        Linux)
          if win_cross_buildable; then
            platforms=(linux win)
          else
            platforms=(linux)
            echo "Note: this commit still uses better-sqlite3, so 'auto' builds Linux only. Build Windows on a Windows PC (see the release doc)."
          fi ;;
        Darwin) platforms=(mac) ;;
        *) die "Unsupported OS $(uname -s) for 'auto'." ;;
      esac ;;
    *) die "Platform must be linux, win, mac or auto." ;;
  esac
  [[ " ${platforms[*]} " != *" win "* ]] || check_win_cross_buildable
  lint_and_test
  for p in "${platforms[@]}"; do "build_$p"; done
  [ "$NO_UPLOAD" = 1 ] || cmd_status || true
}

cmd_status() {
  local state; state="$(release_state)"
  [ "$state" != missing ] || die "No release $TAG on $RELEASES_REPO yet. Run: $0 prepare $VERSION"
  step "$TAG on $RELEASES_REPO is $state"
  local missing; missing="$(missing_assets)"
  local have=$(( ${#ALL_FILES[@]} - $(grep -c . <<<"$missing" || true) ))
  echo "$have of ${#ALL_FILES[@]} files uploaded."
  if [ -n "$missing" ]; then
    echo "Missing:"; sed 's/^/  - /' <<<"$missing"
    grep -q '^hiday-mac\|^latest-mac' <<<"$missing" && echo "  → run '$0 build $VERSION mac' on a Mac"
    grep -q '^hiday-linux\|^latest-linux\|^hiday-win\|^latest\.yml' <<<"$missing" && echo "  → run '$0 build $VERSION auto' on Linux"
    return 1
  fi
  ok "All ${#ALL_FILES[@]} files are there."
}

# Downloads the three update manifests from the draft and checks each names
# this version — the uploaded copies, not the local ones, are what users get.
check_uploaded_manifests() {
  local tmp; tmp="$(mktemp -d)"
  gh release download "$TAG" --repo "$RELEASES_REPO" --pattern 'latest*.yml' --dir "$tmp" --clobber
  for f in latest.yml latest-linux.yml latest-mac.yml; do
    grep -qx "version: $VERSION" "$tmp/$f" || { rm -rf "$tmp"; die "Uploaded $f is not for $VERSION: $(head -1 "$tmp/$f")"; }
  done
  rm -rf "$tmp"
  ok "All three update manifests name $VERSION."
}

cmd_publish() {
  check_gh
  [ "$(release_state)" = draft ] || die "$TAG is not a draft (it's $(release_state)); nothing to publish."
  cmd_status || die "Not publishing: files are missing (see above)."
  check_uploaded_manifests
  if [ "$YES" != 1 ]; then
    read -r -p "Publish $TAG to all users now? [y/N] " answer
    [ "$answer" = y ] || [ "$answer" = Y ] || die "Not published."
  fi
  gh release edit "$TAG" --repo "$RELEASES_REPO" --draft=false --latest >/dev/null
  ok "$TAG is published and marked latest. Installed apps will pick it up on their next check."
  cmd_verify
}

cmd_verify() {
  step "Checking what users are served from releases/latest"
  local bad=0
  for f in latest.yml latest-linux.yml latest-mac.yml; do
    local line
    line="$(curl -fsSL "https://github.com/$RELEASES_REPO/releases/latest/download/$f" | head -1 || true)"
    if [ "$line" = "version: $VERSION" ]; then ok "$f → $line"; else echo "✘ $f → ${line:-<unreachable>}"; bad=1; fi
  done
  [ "$bad" = 0 ] || die "Not every manifest shows $VERSION yet (GitHub can take a minute)."
  echo "Clean up when done: git worktree remove $WORKTREE"
}

# --- main -------------------------------------------------------------------

[ $# -ge 2 ] || usage
COMMAND="$1"; VERSION="$2"; shift 2
PLATFORM=""; NO_UPLOAD=0; YES=0
if [ "$COMMAND" = build ]; then
  [ $# -ge 1 ] || die "build needs a platform: linux, win, mac or auto."
  PLATFORM="$1"; shift
fi
for arg in "$@"; do
  case "$arg" in
    --no-upload) NO_UPLOAD=1 ;;
    --yes) YES=1 ;;
    -h|--help) usage 0 ;;
    *) die "Unknown option $arg" ;;
  esac
done

check_version_arg
TAG="desktop-v$VERSION"
REF="${RELEASE_REF:-$TAG}"
[ "$REF" = "$TAG" ] || [ "$NO_UPLOAD" = 1 ] || die "RELEASE_REF is for test builds only; add --no-upload."
WORKTREE="${RELEASE_WORKTREE:-$(dirname "$REPO_ROOT")/hiday-release-$VERSION}"

case "$COMMAND" in
  tag) cmd_tag ;;
  prepare) cmd_prepare ;;
  build) cmd_build ;;
  status) cmd_status ;;
  publish) cmd_publish ;;
  verify) cmd_verify ;;
  *) usage ;;
esac
