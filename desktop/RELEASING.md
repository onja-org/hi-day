# Releasing the desktop app

Releases are built on our own machines and uploaded to the public
[`onja-org/hi-day-releases`](https://github.com/onja-org/hi-day-releases)
repo. GitHub Actions can't do it any more: the org has used up its minutes and
storage. Users notice nothing, because installed apps only ever check that
releases repo for updates. They don't care where a file was built.

Everything goes through [`scripts/release.sh`](scripts/release.sh). Every
command is safe to re-run: if one fails, fix the cause and run the same command
again.

## With Claude Code (easiest)

Open Claude Code in your `hi-day` clone on **each** build machine (Linux PC,
Mac, Windows PC) and run:

```
/release-desktop 0.3.4
```

Each machine does its own part, in any order:

- The **first one** opens the version bump PR, asks you once before merging it,
  then tags `main` and creates the draft release.
- **Every machine** builds and uploads what only it can build.
- The **last one** sees all 15 files are in, asks you once, and publishes.

Run it on a machine again at any point and it carries on from where things
are. The manual steps below do the same thing by hand.

The examples below release **0.3.4**. Replace it with your version everywhere.

## How a release works

1. A tag (`desktop-v0.3.4`) marks the commit to release.
2. A **draft** release is created. Drafts are hidden from users and from the
   auto-updater.
3. Each platform is built on its own machine and uploaded into the draft.
4. Once all **15 files** are in, the draft is published and marked latest.
   That's the moment users start getting the update.

## One-time setup

| Machine | Builds | Needs |
| --- | --- | --- |
| Linux PC | Linux (and Windows, see below) | Node 22.13+, pnpm 11.1.3, Docker (your user in the `docker` group), `gh` |
| Mac (Intel or Apple Silicon) | macOS, both chip types | Node 22.13+, pnpm 11.1.3, Xcode command line tools (`xcode-select --install`), `gh` |
| Windows PC | Windows, for now (see below) | Node 22.13+, pnpm 11.1.3, .NET 8 SDK, Git for Windows (Git Bash), `gh`; Visual Studio Build Tools ("Desktop development with C++") if `better-sqlite3` has to compile |

- Whoever uploads needs **write access to `onja-org/hi-day-releases`**: log in
  with `gh auth login`, or `export GH_TOKEN=<fine-grained token>` limited to
  that repo with *Contents: Read and write*.
- The old CI release must stay **off**, or it could overwrite our uploads once
  minutes come back. `tag` and `prepare` refuse to run while it's on:

  ```bash
  gh workflow disable desktop-build.yml --repo onja-org/hi-day
  ```

> **Windows today:** `main` still uses `better-sqlite3`, a native module that
> can only be compiled for Windows *on* Windows. Until the `node:sqlite` change
> is merged, build Windows on a Windows PC (step 4). After it's merged,
> `build <version> auto` on the Linux PC builds Windows too, inside Docker, and
> step 4 goes away. The script picks the right one on its own.

## Steps

### 1. Bump the version (anyone)

Set `"version": "0.3.4"` in `desktop/package.json`, open a PR and merge it to
`main`.

### 2. Tag, draft, and build Linux (Linux PC)

```bash
git checkout main && git pull
nvm use 22

desktop/scripts/release.sh tag 0.3.4         # checks main says 0.3.4, tags it, pushes the tag
desktop/scripts/release.sh prepare 0.3.4     # clean copy in ../hiday-release-0.3.4 + the draft release
desktop/scripts/release.sh build 0.3.4 auto  # lint, tests, build, upload (~5–10 min)
```

Do this first: it creates the draft the other machines upload into.

### 3. Build macOS (Mac)

```bash
git checkout main && git pull
desktop/scripts/release.sh prepare 0.3.4
desktop/scripts/release.sh build 0.3.4 mac
```

### 4. Build Windows (Windows PC), only while `main` uses `better-sqlite3`

In **Git Bash** (comes with Git for Windows):

```bash
git checkout main && git pull
desktop/scripts/release.sh prepare 0.3.4
desktop/scripts/release.sh build 0.3.4 auto
```

Or by hand in PowerShell, if the script won't run there:

```powershell
cd <your hi-day clone>
git fetch --tags
git checkout desktop-v0.3.4
pnpm install --frozen-lockfile
pnpm --filter desktop dist:win
Get-Content desktop\release\latest.yml -First 1      # must say: version: 0.3.4
gh release upload desktop-v0.3.4 desktop\release\hiday-win-x64.exe desktop\release\hiday-win-x64.exe.blockmap desktop\release\latest.yml --repo onja-org/hi-day-releases --clobber
```

If `dist:win` complains about missing build tools, install Visual Studio Build
Tools with "Desktop development with C++" and run it again.

### 5. Test Windows

Download `hiday-win-x64.exe` from the draft release (or use the one you just
built), install it on a Windows PC, and check that it opens and signs in.

### 6. Publish (Linux PC, or whoever finishes last)

```bash
desktop/scripts/release.sh status 0.3.4    # must show 15 of 15
desktop/scripts/release.sh publish 0.3.4   # re-checks everything, asks once, publishes, verifies
git worktree remove ../hiday-release-0.3.4
```

`publish` refuses unless all 15 files are in the draft and every uploaded
`latest*.yml` says `version: 0.3.4`. Installed apps pick the update up on their
next check (every 4 hours) or on restart. To check again later:
`desktop/scripts/release.sh verify 0.3.4`.

## The 15 files

| Platform | Files |
| --- | --- |
| Linux | `hiday-linux-x86_64.AppImage`, `hiday-linux-amd64.deb`, `latest-linux.yml` |
| Windows | `hiday-win-x64.exe`, `hiday-win-x64.exe.blockmap`, `latest.yml` |
| macOS | `hiday-mac-{arm64,x64}.{dmg,zip}`, a `.blockmap` for each of those four, `latest-mac.yml` |

`latest*.yml` tells installed apps a new version exists and holds each
installer's sha512; `.blockmap` files let them download only what changed. The
names are fixed: the landing page's download links and the updater depend on
them.

## Rules

1. **Never publish with files missing.** Without `latest-mac.yml`, Macs stop
   seeing updates and the landing page's Mac link breaks.
2. **Upload a platform's `.yml` together with its installers, from the same
   build.** The app rejects an update whose sha512 doesn't match. If you
   rebuild a platform, re-upload all of its files.
3. **Always build from the tag** (the `prepare` copy, or `git checkout
   desktop-v<version>` on Windows), never from a working branch.
4. **Never upload into a published release.** If it's out, release a new
   version.
5. **Never create a repo named `workfoce-monitoring-app-releases`.** That was
   the releases repo's old name. Builds from before the rename still ask for it
   and reach the new repo through GitHub's redirect. A new repo with that name
   would silently stop their updates.

## Test build without releasing

Build the commit you're on, using the version in its `desktop/package.json`.
This needs no tag or draft, and uploads nothing:

```bash
RELEASE_REF=HEAD desktop/scripts/release.sh build 0.3.3 auto --no-upload
```

## When something goes wrong

| Message / situation | Fix |
| --- | --- |
| `Node ... is too old` / pnpm won't run | `nvm use 22`, then `npm install -g pnpm@11.1.3` if pnpm still fails. |
| `can't write to onja-org/hi-day-releases` | Get write access, or set `GH_TOKEN` (see setup). |
| `The 'Desktop build' workflow is 'active'` | Turn it off (see setup). |
| `isn't at desktop-v...` / `has local changes` | `git worktree remove --force ../hiday-release-<version>` and re-run. |
| `package.json at ... says X, not <version>` | The tag is on the wrong commit. Stop and ask before moving a pushed tag. |
| `is not a draft (it's missing)` | Run `prepare` first. |
| `is not a draft (it's published)` | That version is out; release the next one. |
| `still depends on better-sqlite3` / `auto builds Linux only` | Expected on `main` for now: build Windows on a Windows PC (step 4). |
| `Worktree path is N chars` / `stack smashing detected` | The Windows installer tool crashes on long paths: `export RELEASE_WORKTREE=~/hiday-release-<version>`. |
| `Can't talk to Docker` | Start Docker, or add yourself to the group (`sudo usermod -aG docker $USER`, then log out and in). |
| `firefox-ax-helper is not universal` (Mac) | Update Xcode / command line tools, then re-run `build <version> mac`. |
| An upload failed halfway | Re-run the same `build` (or the Windows `gh release upload`) command. |
| A published release is broken | `gh release edit desktop-v<version> --repo onja-org/hi-day-releases --draft=true` hides it, and the previous release becomes latest again. People who already updated stay on it, so fix forward with a new version. |
| No Mac or Windows PC available | Don't publish. The draft stays hidden until the files are in. |
