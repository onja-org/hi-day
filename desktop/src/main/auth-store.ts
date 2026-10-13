import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeStorage } from 'electron';

export interface StoredSession {
  email: string;
  /** Absent on a session saved before this field existed — falls back to email in the UI. */
  name?: string;
  organisationName: string;
  deviceId: string;
  deviceToken: string;
  /**
   * The Project the timer last tracked against, so a later auto-start or
   * play never re-prompts for it. Optional: absent on a first-ever run,
   * and on a session saved before this field existed.
   */
  lastProjectId?: string;
  /** The Task alongside `lastProjectId`, when one was chosen. */
  lastTaskId?: string | null;
  /**
   * Where the Wayland screenshot grant used to be recorded, before it moved
   * to setup-state so signing out no longer forgets it. Still read, so a
   * grant given on an older version carries over.
   */
  waylandScreenshotGranted?: boolean;
}

const SESSION_FILE_NAME = 'session.dat';

/**
 * Persists the device session credential using OS-level encryption
 * (safeStorage) when available. Falls back to plaintext-on-disk when it
 * isn't — e.g. a Linux machine with no keyring daemon running — rather than
 * failing to store the session at all.
 */
export class AuthStore {
  constructor(private readonly userDataDir: string) {}

  private get filePath(): string {
    return join(this.userDataDir, SESSION_FILE_NAME);
  }

  load(): StoredSession | null {
    if (!existsSync(this.filePath)) {
      return null;
    }

    try {
      const raw = readFileSync(this.filePath);
      const json = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(raw)
        : raw.toString('utf-8');
      return JSON.parse(json) as StoredSession;
    } catch {
      // Reading at all can fail, not just parsing: the file may be
      // unreadable, or written under a keyring this machine can no longer
      // decrypt with. "No session" sends the person to the login view,
      // which can pair the device again — throwing would reject
      // `auth:status` and strand whatever view is on screen.
      return null;
    }
  }

  save(session: StoredSession): void {
    const json = JSON.stringify(session);
    const data = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(json)
      : Buffer.from(json, 'utf-8');
    writeFileSync(this.filePath, data);
  }

  /**
   * Records the Project the timer is now tracking against. A no-op when
   * nothing is stored, so this can be called freely without first checking
   * whether a session exists.
   */
  rememberProject(projectId: string, taskId: string | null): void {
    const session = this.load();
    if (!session) return;
    this.save({ ...session, lastProjectId: projectId, lastTaskId: taskId });
  }

  clear(): void {
    if (existsSync(this.filePath)) {
      unlinkSync(this.filePath);
    }
  }
}
