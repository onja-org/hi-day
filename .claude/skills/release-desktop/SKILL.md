---
name: release-desktop
description: Cut a hiday desktop release (Linux, Windows, macOS) on our own machines instead of GitHub-hosted runners, uploading to the public releases repo so installed apps auto-update as before. Run the same /release-desktop <version> on each build machine; each does its own part and the last one publishes. Use when the user says "release the desktop app", "cut desktop vX.Y.Z", or invokes /release-desktop.
argument-hint: "[version, e.g. 0.3.4]"
disable-model-invocation: true
---

# Release the desktop app

Drive `desktop/scripts/release.sh` (see `desktop/RELEASING.md` for the human version). The user
runs this same skill on each build machine — Linux PC, Mac, Windows PC — and each one does the
part only it can do. The work is shared through the tag and the draft release, so it doesn't
matter which machine goes first or last: every step below checks what's already done and
skips it.

Every script command is idempotent: on a failure, fix the cause and re-run the same command —
never hand-upload or hand-edit the release.

Installed apps only read the public `onja-org/hi-day-releases` repo. A release reaches users
only when it's **published + marked latest** with all **15 files** (the script's `ALL_FILES`).
Until then it's a draft and invisible, so everything before publishing is safe to do without
asking — except the shared-repo actions called out below.

## 0. Environment

- Machine = `uname -s`: `Linux`, `Darwin` (Mac), or `MINGW*`/`MSYS*` (Windows — Claude Code runs
  Git Bash there, and the script supports it).
- Node must be ≥ 22.13 for pnpm 11. If `node -v` is older and `~/.nvm/nvm.sh` exists, prefix
  every command with `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && `. If `pnpm -v` then
  fails, run `npm install -g pnpm@11.1.3` once under that Node.
- Windows also needs the .NET 8 SDK (`dotnet --version`), and Visual Studio Build Tools with
  "Desktop development with C++" if `better-sqlite3` has to compile.
- `gh auth status` must show an account with write access to `onja-org/hi-day-releases`.
- Run everything from the repo root, on an up-to-date `main` (`git checkout main && git pull`),
  as `desktop/scripts/release.sh`. If the working tree has uncommitted changes, ask before
  switching branches.

## 1. Version and state

- Version `<v>` = `$ARGUMENTS`. If empty, take the latest `desktop-v*` tag
  (`git tag -l 'desktop-v*' | sort -V | tail -1`). If that release is still a draft, it's the
  one in progress — confirm it. Otherwise propose the next patch. Ask once with AskUserQuestion.
- Work out what's done, then start at the first step that isn't:
  - `git show origin/main:desktop/package.json` says `<v>`? (no → step 2)
  - `git ls-remote --tags origin refs/tags/desktop-v<v>` exists? (no → step 3)
  - `desktop/scripts/release.sh status <v>`: missing → step 3 · draft → step 4 ·
    published → it's already out; say so and stop.

## 2. Version bump (only if main isn't at `<v>`)

- If `gh pr list --head chore/desktop-v<v> --state open` shows a PR, another machine already
  started the bump — skip to waiting for it to merge (below).
- Otherwise: branch `chore/desktop-v<v>` off `origin/main`, set `"version"` in
  `desktop/package.json`, then run lint and tests (`pnpm --filter desktop lint`; if the package
  has a `rebuild:node` script run it first, then `pnpm --filter desktop test`). Commit
  `Bump desktop to <v>`, push, and `gh pr create` against `main`, with the test result in the
  body (GitHub CI may not run — we're out of minutes).
- Ask once with AskUserQuestion: "Merge the version bump PR #N into main now?" — options
  *Merge now* / *I'll merge it myself*.
  - *Merge now* → `gh pr merge <N> --squash --delete-branch`. If GitHub refuses (review
    required, branch protection), tell the user and fall through to waiting.
  - Waiting: `Bash` with `run_in_background`:
    `until git fetch -q origin main && git show origin/main:desktop/package.json | grep -q '"version": "<v>"'; do sleep 60; done`.
- Then `git checkout main && git pull`.

## 3. Tag and draft (whichever machine gets here first; the others skip it)

```bash
desktop/scripts/release.sh tag <v>        # tags origin/main, pushes the tag (no-op if it exists)
desktop/scripts/release.sh prepare <v>    # clean worktree at the tag + draft release (reused if there)
```

- Run `prepare` on **every** machine — it makes that machine's clean worktree.
- Both refuse while the old `Desktop build` workflow is enabled. It must be off: ask the user,
  and only on their yes run `gh workflow disable desktop-build.yml --repo onja-org/hi-day` (it
  changes a shared repo setting).

## 4. Build this machine's part

```bash
desktop/scripts/release.sh build <v> auto
```

| Machine | `auto` builds |
| --- | --- |
| Linux | Linux. Plus Windows (in Docker) when the commit no longer uses `better-sqlite3`; otherwise it prints "builds Linux only" and Windows is the Windows PC's job. |
| Mac | macOS, both chip types. |
| Windows | Windows, with the native `dist:win`. |

- First check `status <v>`: if every file this machine would build is already uploaded, skip
  the build and say so. Only rebuild when the user asks.
- Run `build` with `run_in_background` (5–25 minutes) and wait for the notification; don't poll.
- Linux, first Windows-in-Docker run: it pulls two images (~3 GB). Keep the worktree at its
  default `../hiday-release-<v>`: the script refuses paths over 80 characters, because the
  Linux `makensis` crashes on long paths.

## 5. Wait for the other machines

Run `desktop/scripts/release.sh status <v>`. With 15 of 15 → step 6. Otherwise tell the user,
in one short message, which machines still need to run `/release-desktop <v>`:

- `hiday-mac-*` / `latest-mac.yml` missing → the Mac.
- `hiday-win-*` / `latest.yml` missing → the Windows PC (or this Linux PC, once `main` no longer
  uses `better-sqlite3`).
- `hiday-linux-*` / `latest-linux.yml` missing → the Linux PC.

Then wait, with `Bash` + `run_in_background`:
`until desktop/scripts/release.sh status <v> >/dev/null 2>&1; do sleep 120; done`.
If the user would rather not wait, stop. They can run `/release-desktop <v>` again anywhere
later: it skips to here and publishes.

## 6. Publish — the only step that needs the user's yes

When `status` shows 15 of 15, ask with one AskUserQuestion:
"All 15 files for <v> are in the draft. Has someone installed `hiday-win-x64.exe` from the draft
on a Windows PC and checked it opens and signs in? Publish to all users now?"
Options: *Publish now* / *Not yet*. Only on *Publish now*:

```bash
desktop/scripts/release.sh publish <v> --yes   # re-checks 15 files + uploaded manifests, then publishes
```

It finishes with `verify`. If a manifest isn't updated yet, wait a minute and run
`desktop/scripts/release.sh verify <v>` again. Then remove this machine's worktree
(`git worktree remove ../hiday-release-<v>`) and report: version, release URL
(`https://github.com/onja-org/hi-day-releases/releases/tag/desktop-v<v>`), and anything
skipped. The other machines can remove theirs the same way.

To test a build without touching the releases repo (no tag or draft needed), build the
current commit at the version in its `desktop/package.json`:
`RELEASE_REF=HEAD desktop/scripts/release.sh build <that version> auto --no-upload`.

## When something fails

| Error | Fix |
|---|---|
| `Node ... is too old` / pnpm won't run | Step 0. |
| `can't write to ...-releases` | User needs write access, or `export GH_TOKEN=<fine-grained PAT, Contents: read+write on the releases repo>`. Ask them; never print a token. |
| `The 'Desktop build' workflow is 'active'` | Step 3: ask, then disable it. |
| `isn't at desktop-v<v>` / `has local changes` (worktree) | `git worktree remove --force ../hiday-release-<v>` and re-run. |
| `package.json at ... says X, not <v>` | The tag is on the wrong commit. Stop and ask — moving a pushed tag needs the user's go-ahead. |
| `is not a draft (it's missing)` | Run `prepare <v>`. |
| `is already published` / `it's published` | That version is out. Never upload into a published release — bump to the next version. |
| `Can't talk to Docker` (Linux) | Docker not running or user not in the `docker` group (`sudo usermod -aG docker $USER`, re-login). Ask the user. |
| `still depends on better-sqlite3` / `non-Windows native addons` (Linux) | Expected while `main` uses `better-sqlite3`: Windows comes from the Windows PC. Don't work around it — a Linux `.node` in the Windows installer means the app never opens its window. |
| Windows-in-Docker build fails (Linux) | Have the Windows PC run `/release-desktop <v>` instead. |
| `dotnet not found` (Windows) | Install the .NET 8 SDK, then re-run. |
| `better-sqlite3` / node-gyp / MSBuild errors (Windows) | Install Visual Studio Build Tools with "Desktop development with C++", then re-run. |
| `Filename too long` (Windows) | `git config --global core.longpaths true`, remove the worktree, re-run `prepare`. |
| `firefox-ax-helper is not universal` (Mac) | Update Xcode / command line tools, re-run `build <v> auto`. |
| A published release is broken | Ask first, then `gh release edit desktop-v<v> --repo onja-org/hi-day-releases --draft=true` (the previous release becomes latest again); fix forward with a new version. |

## Never

- Publish without the user's explicit yes in this run, or with fewer than 15 files.
- Upload files from different builds of the same platform (each `latest*.yml` holds the sha512 of
  its own installers) — re-run that platform's whole `build` instead.
- Re-enable `desktop-build.yml`, move or delete a pushed tag, delete a release, or merge
  anything other than the version-bump PR without asking.
- Create a repo named `workfoce-monitoring-app-releases` (the old name; existing installs reach
  the new repo through its redirect).
