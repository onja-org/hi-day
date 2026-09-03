import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FINGERPRINT_FILE_NAME = 'device-fingerprint.txt';

/**
 * Returns a stable id for this machine+install, generating and persisting
 * one on first run. This is deliberately not hardware-derived (no MAC
 * address, disk serial, etc.) — the ticket only needs an id stable across
 * app restarts, not tamper-resistant hardware forensics.
 */
export function getOrCreateDeviceFingerprint(userDataDir: string): string {
  const filePath = join(userDataDir, FINGERPRINT_FILE_NAME);

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8').trim();
    if (existing.length > 0) {
      return existing;
    }
  }

  const fingerprint = randomUUID();
  mkdirSync(userDataDir, { recursive: true });
  writeFileSync(filePath, fingerprint, 'utf-8');
  return fingerprint;
}
