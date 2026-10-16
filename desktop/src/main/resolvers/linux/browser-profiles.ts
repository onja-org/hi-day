import { readdirSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Which profiles a running Chromium browser has open, and where its data
 * lives.
 *
 * Chromium runs every profile of one user-data-dir inside a single process,
 * and records the choice nowhere in its argument vector unless the person
 * passed `--profile-directory` by hand — which almost nobody does. Relaunching
 * from the launcher alone therefore names no profile, and Chromium answers by
 * showing the profile picker: one window comes back, the rest are left to the
 * person to reopen.
 *
 * The open files give what the argv cannot. A profile in use holds its
 * databases open, so the directories behind `/proc/<pid>/fd` name exactly the
 * profiles with windows on screen — read before the process is signalled, so
 * it does not depend on the shutdown going cleanly the way Chromium's own
 * `last_active_profiles` does. The path also resolves the user-data-dir for
 * free, including the rewritten ones snap and flatpak browsers use.
 */
export interface OpenProfiles {
  /** Resolved from the open paths, so snap and flatpak homes come out right. */
  userDataDir: string | null;
  /** `Default`, `Profile 1`, … in a stable order. */
  profiles: string[];
}

const NO_PROFILES: OpenProfiles = { userDataDir: null, profiles: [] };

/**
 * Only the profiles a person owns. `System Profile` and `Guest Profile` are
 * Chromium's own and sit in the same directory; reopening either would put a
 * window on screen that was never there.
 */
function profileIndex(segments: string[]): number {
  return segments.findIndex(
    (segment) => segment === 'Default' || /^Profile \d+$/.test(segment),
  );
}

function sortKey(profile: string): number {
  return profile === 'Default' ? 0 : Number(profile.slice('Profile '.length));
}

export function readOpenProfiles(pid: number, procRoot = '/proc'): OpenProfiles {
  const directory = join(procRoot, String(pid), 'fd');
  let descriptors: string[];
  try {
    descriptors = readdirSync(directory);
  } catch {
    return NO_PROFILES;
  }

  const profiles = new Set<string>();
  let userDataDir: string | null = null;
  for (const descriptor of descriptors) {
    let target: string;
    try {
      target = readlinkSync(join(directory, descriptor));
    } catch {
      // A descriptor closed mid-scan is ordinary, not an error.
      continue;
    }
    const segments = target.split('/');
    const index = profileIndex(segments);
    // The last segment is the open file itself, never the profile directory.
    if (index <= 0 || index === segments.length - 1) continue;
    profiles.add(segments[index]);
    userDataDir ??= segments.slice(0, index).join('/');
  }

  if (profiles.size === 0) return NO_PROFILES;
  return { userDataDir, profiles: [...profiles].sort((a, b) => sortKey(a) - sortKey(b)) };
}
