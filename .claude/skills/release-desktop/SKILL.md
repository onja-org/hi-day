---
name: release-desktop
description: Cut a hiday desktop release (Linux, Windows, macOS) on our own machines instead of GitHub-hosted runners, uploading to the public releases repo so installed apps auto-update as before. Use when the user says "release the desktop app", "cut desktop vX.Y.Z", or invokes /release-desktop.
argument-hint: "[version, e.g. 0.3.4]"
disable-model-invocation: true
---

# Release the desktop app

Drive `desktop/scripts/release.sh` end to end. Every subcommand is idempotent, so on any
failure fix the cause and re-run the same command — never hand-upload or hand-edit the release.

Installed apps only read the public `onja-org/hi-day-releases` repo. A release
reaches users only when it's **published + marked latest** with all **15 files** (the script's
`ALL_FILES`). Until then it's a draft and invisible, so everything before `publish` is safe to
do without asking.

## 0. Environment

- Node must be ≥ 22.13 for pnpm 11. If `node -v` is older and `~/.nvm/nvm.sh` exists, prefix
  every command with `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && `. If `pnpm -v` then fails,
  run `npm install -g pnpm@11.1.3` once under that Node.
- Run the script from the repo root as `desktop/scripts/release.sh`.

## 1. Work out the version and where we are

- Version = `$ARGUMENTS`. If empty, read the latest `desktop-v*` tag
  (`git tag -l 'desktop-v*' | sort -V | tail -1`) and propose the next patch. Ask the user to
  confirm or give another, with one AskUserQuestion.
- Find the state, then resume from the first step that isn't done:
  - `git show origin/main:desktop/package.json` version equals it? (else → step 2)
  - `git ls-remote --tags origin refs/tags/desktop-v<v>` exists? (else → step 3)
  - `desktop/scripts/release.sh status <v>` — release missing / draft with N of 15 / published.

## 2. Version bump (only if main isn't at the version yet)

Branch off `origin/main` as `chore/desktop-v<v>`, set `"version"` in `desktop/package.json`,
commit (`Bump desktop to <v>`), push, and `gh pr create` against `main`. GitHub CI may not run
(we're out of minutes), so run `pnpm --filter desktop lint && pnpm --filter desktop test`
locally and put the result in the PR body. Then stop and ask the user to merge it — or merge
it with `gh pr merge --squash` if they tell you to. Continue once `origin/main` has the bump.

## 3. Tag, draft, build

```bash
desktop/scripts/release.sh tag <v>          # tags origin/main, pushes the tag
desktop/scripts/release.sh prepare <v>      # clean worktree at the tag + draft release
desktop/scripts/release.sh build <v> auto   # Linux: linux + win · Mac: mac
```

- `tag` refuses while the old `Desktop build` workflow is enabled. Tell the user it must be
  disabled (`gh workflow disable desktop-build.yml --repo onja-org/hi-day`) and
  run that only once they agree — it changes shared repo settings.
- `build` takes 10–25 minutes. Run it with `run_in_background` and wait for the notification
  instead of polling.
- First Windows run pulls two Docker images (~3 GB) — expected. Windows needs no Wine or
  .NET on the host: both run in Docker.
- Leave the worktree at its default `../hiday-release-<v>`. The script refuses a path over 80
  characters, because the Linux `makensis` crashes ("stack smashing detected") on long paths.

To test a platform without touching the releases repo (no tag, no draft needed), build the
current commit at the version in its `desktop/package.json`:
`RELEASE_REF=HEAD desktop/scripts/release.sh build <that version> auto --no-upload`.

## 4. Get the other platform built

After `build`, the script prints which files are still missing.

- **On Linux, Mac files missing:** tell the user, in one short message, that someone on a Mac
  with Claude Code runs `/release-desktop <v>`, or by hand:
  `desktop/scripts/release.sh prepare <v> && desktop/scripts/release.sh build <v> mac`.
  Then wait for the upload with Monitor, polling every 2 minutes:
  `until desktop/scripts/release.sh status <v> >/dev/null 2>&1; do sleep 120; done`.
- **On a Mac, Linux/Windows files missing:** same, the other way round (`build <v> auto` on Linux).
- **Windows files missing because `auto` printed "builds Linux only"** (the commit still uses
  `better-sqlite3`): someone builds on a Windows PC with Node 22, pnpm 11.1.3, .NET 8 SDK, git
  and `gh`, in PowerShell from their clone:
  `git fetch --tags; git checkout desktop-v<v>; pnpm install --frozen-lockfile; pnpm --filter desktop dist:win`,
  checks `Get-Content desktop\release\latest.yml -First 1` says `version: <v>`, then
  `gh release upload desktop-v<v> desktop\release\hiday-win-x64.exe desktop\release\hiday-win-x64.exe.blockmap desktop\release\latest.yml --repo onja-org/hi-day-releases --clobber`.
  Give the user those lines and wait for the upload the same way.

## 5. Publish — the only step that needs the user's yes

When `status` shows 15 of 15, ask with one AskUserQuestion:
"All 15 files for <v> are in the draft. Has someone installed `hiday-win-x64.exe` from the draft
on a Windows PC and checked it opens and signs in? Publish to all users now?"
Options: publish now / not yet. Only on "publish now":

```bash
desktop/scripts/release.sh publish <v> --yes   # re-checks 15 files + uploaded manifests, then publishes
```

It finishes by running `verify`. If verify says a manifest isn't updated yet, wait a minute and
run `desktop/scripts/release.sh verify <v>` again. Then remove the worktree
(`git worktree remove ../hiday-release-<v>`) and report: version, release URL
(`https://github.com/onja-org/hi-day-releases/releases/tag/desktop-v<v>`), and
anything skipped.

## When something fails

| Error | Fix |
|---|---|
| `Node ... is too old` / pnpm won't run | Step 0. |
| `can't write to ...-releases` | User needs write access, or `export GH_TOKEN=<fine-grained PAT, Contents: read+write on the releases repo>`. Ask them; never print a token. |
| `isn't at desktop-v<v>` / `has local changes` (worktree) | `git worktree remove --force ../hiday-release-<v>` and re-run. |
| `package.json at ... says X, not <v>` | The tag is on the wrong commit. Stop and ask — moving a pushed tag needs the user's go-ahead. |
| `Can't talk to Docker` | Docker not running or user not in the `docker` group (`sudo usermod -aG docker $USER`, re-login). Ask the user. |
| `still depends on better-sqlite3` / `non-Windows native addons` | That commit has a native addon compiled at install time, so Windows can't be built from Linux. Use the Windows PC fallback in the next row; Linux and Mac are unaffected. Don't try to work around it — a Linux `.node` in the Windows installer means the app never opens its window. |
| Windows Docker build fails | Fallback: build on a Windows PC with Node 22, pnpm and .NET 8 SDK — `pnpm --filter desktop dist:win`, then `gh release upload desktop-v<v> desktop/release/{hiday-win-x64.exe,hiday-win-x64.exe.blockmap,latest.yml} --repo onja-org/hi-day-releases --clobber`. |
| `firefox-ax-helper is not universal` (Mac) | Update Xcode / command line tools, re-run `build <v> mac`. |
| `is already published` | That version is out. Never upload into a published release — bump to the next version. |
| A published release is broken | Ask first, then `gh release edit desktop-v<v> --repo onja-org/hi-day-releases --draft=true` (the previous release becomes latest again); fix forward with a new version. |

## Never

- Publish without the user's explicit yes in this run, or with fewer than 15 files.
- Upload files from different builds of the same platform (each `latest*.yml` holds the sha512 of
  its own installers) — re-run that platform's whole `build` instead.
- Re-enable `desktop-build.yml`, move or delete a pushed tag, or delete a release without asking.
