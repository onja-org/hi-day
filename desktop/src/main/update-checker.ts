const RELEASES_REPO = 'onja-org/hi-day-releases';
const GITHUB_API_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;

// The public releases repo (see docs — desktop-v* tags publish here, not
// to this app's own private source repo). Points at whatever the newest
// release is; never needs updating for a new version.
export const RELEASES_PAGE_URL = `https://github.com/${RELEASES_REPO}/releases/latest`;

export interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion?: string;
}

interface GitHubReleaseResponseBody {
  tag_name?: string;
}

/**
 * The releases repo tags releases `desktop-vX.Y.Z` (see
 * .github/workflows/desktop-build.yml) — this pulls out just the version.
 */
export function parseVersionFromTag(tag: string): string | null {
  const match = /^desktop-v(\d+\.\d+\.\d+)$/.exec(tag);
  return match ? match[1] : null;
}

/** Plain numeric X.Y.Z comparison — no pre-release/build-metadata suffixes here. */
export function isNewerVersion(currentVersion: string, latestVersion: string): boolean {
  const current = currentVersion.split('.').map(Number);
  const latest = latestVersion.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const currentPart = current[i] ?? 0;
    const latestPart = latest[i] ?? 0;
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
}

/**
 * Best-effort — a failed check (offline, GitHub rate limit, etc.) just
 * reports no update available rather than surfacing an error; this is a
 * "nice to know" notice, not something worth interrupting the person over.
 */
export async function checkForUpdate(
  currentVersion: string,
): Promise<UpdateCheckResult> {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!response.ok) {
      return { updateAvailable: false };
    }

    const body = (await response.json()) as GitHubReleaseResponseBody;
    const latestVersion = body.tag_name
      ? parseVersionFromTag(body.tag_name)
      : null;

    if (!latestVersion) {
      return { updateAvailable: false };
    }

    return {
      updateAvailable: isNewerVersion(currentVersion, latestVersion),
      latestVersion,
    };
  } catch {
    return { updateAvailable: false };
  }
}
