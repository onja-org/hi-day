import { ConfigService } from '@nestjs/config';
import { ScreenshotStorageService } from '../screenshot-storage.service';

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

const CONFIGURED = {
  WASABI_BUCKET: 'shots',
  WASABI_REGION: 'eu-central-1',
  WASABI_ENDPOINT: 'https://s3.example.test',
  WASABI_ACCESS_KEY_ID: 'key',
  WASABI_SECRET_ACCESS_KEY: 'secret',
};

/**
 * Object storage is optional: a self-hosted install should not have to open
 * an account with a storage provider before Hi Day will start. Time
 * tracking, projects, reports and the desktop agent all work without one.
 *
 * These used to be read with `getOrThrow`. That looked fine in Docker only
 * because an empty string satisfies it — the app started and then failed on
 * the first upload with an opaque credentials error.
 */
describe('screenshot storage with nothing configured', () => {
  it('starts with no settings at all', () => {
    expect(() => new ScreenshotStorageService(configWith({}))).not.toThrow();
  });

  it('starts with the settings present but blank, as Docker passes them', () => {
    const blank = Object.fromEntries(
      Object.keys(CONFIGURED).map((key) => [key, '']),
    );

    expect(() => new ScreenshotStorageService(configWith(blank))).not.toThrow();
  });

  it('knows it cannot store anything', () => {
    expect(new ScreenshotStorageService(configWith({})).isConfigured).toBe(
      false,
    );
  });

  // Loudly, naming what to set — not an unsigned request to nowhere.
  it('explains itself when asked for a URL anyway', async () => {
    const storage = new ScreenshotStorageService(configWith({}));

    await expect(storage.createUploadUrl('screenshots/x.jpg')).rejects.toThrow(
      /not configured/i,
    );
  });

  /**
   * One missing value is a misconfiguration, not a deliberate opt-out, and
   * a half-built client would fail later and less clearly.
   */
  it('treats a partial configuration as none', () => {
    const partial = { ...CONFIGURED, WASABI_SECRET_ACCESS_KEY: '' };

    expect(new ScreenshotStorageService(configWith(partial)).isConfigured).toBe(
      false,
    );
  });
});

describe('screenshot storage with a bucket configured', () => {
  it('is ready to store', () => {
    expect(
      new ScreenshotStorageService(configWith(CONFIGURED)).isConfigured,
    ).toBe(true);
  });

  it('signs an upload URL for the configured bucket', async () => {
    const storage = new ScreenshotStorageService(configWith(CONFIGURED));

    const url = await storage.createUploadUrl('screenshots/org/dev/1.jpg');

    expect(url).toContain('/shots/screenshots/org/dev/1.jpg');
    expect(url).toContain('X-Amz-Signature');
  });

  // Namespaced by org and device, never derived from anything a client
  // sends, so one device cannot overwrite another's object.
  it('keys objects by organisation and device', () => {
    const storage = new ScreenshotStorageService(configWith(CONFIGURED));

    const key = storage.buildStorageKey('org-1', 'dev-1', new Date(1700000000));

    expect(key).toMatch(/^screenshots\/org-1\/dev-1\/1700000000-/);
    expect(key.endsWith('.jpg')).toBe(true);
  });
});
