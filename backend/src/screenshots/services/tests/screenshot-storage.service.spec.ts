import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
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
 * Optional so a self-hosted install need not open a storage account before
 * Hi Day will start. These were read with `getOrThrow`, which looked fine in
 * Docker only because an empty string satisfies it — the app then failed on
 * the first upload with an opaque credentials error.
 */
describe('screenshot storage with nothing configured', () => {
  const blank = Object.fromEntries(Object.keys(CONFIGURED).map((k) => [k, '']));

  it('starts, whether the settings are absent or blank', () => {
    expect(new ScreenshotStorageService(configWith({})).isConfigured).toBe(
      false,
    );
    expect(new ScreenshotStorageService(configWith(blank)).isConfigured).toBe(
      false,
    );
  });

  /** One missing value is a mistake, not an opt-out, and a half-built client
   * would fail later and less clearly. */
  it('treats a partial configuration as none', () => {
    const partial = { ...CONFIGURED, WASABI_SECRET_ACCESS_KEY: '' };

    expect(new ScreenshotStorageService(configWith(partial)).isConfigured).toBe(
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
});

describe('screenshot storage with a bucket configured', () => {
  it('signs an upload URL for the configured bucket', async () => {
    const storage = new ScreenshotStorageService(configWith(CONFIGURED));

    const url = await storage.createUploadUrl('screenshots/org/dev/1.jpg');

    expect(storage.isConfigured).toBe(true);
    expect(url).toContain('/shots/screenshots/org/dev/1.jpg');
    expect(url).toContain('X-Amz-Signature');
  });

  // Never derived from anything a client sends, so one device cannot
  // overwrite another's object.
  it('keys objects by organisation and device', () => {
    const storage = new ScreenshotStorageService(configWith(CONFIGURED));

    const key = storage.buildStorageKey('org-1', 'dev-1', new Date(1700000000));

    expect(key).toMatch(/^screenshots\/org-1\/dev-1\/1700000000-.+\.jpg$/);
  });
});

/**
 * `Number('')` is 0 and `Number('abc')` is NaN, and either signs a URL that
 * has already expired — so every upload is rejected and no screenshot is
 * ever recorded, with nothing in the logs saying why. A blank value is what
 * copying .env.example and deleting the number leaves behind, and `get`'s
 * default does not cover it: an empty string is defined.
 */
describe('how long a presigned URL lasts', () => {
  async function ttlOf(raw: string | undefined): Promise<number> {
    const storage = new ScreenshotStorageService(
      configWith({ ...CONFIGURED, SCREENSHOT_URL_TTL_SECONDS: raw }),
    );
    const url = await storage.createUploadUrl('screenshots/x.jpg');
    return Number(new URL(url).searchParams.get('X-Amz-Expires'));
  }

  it('uses the configured number of seconds', async () => {
    await expect(ttlOf('900')).resolves.toBe(900);
  });

  it('falls back to five minutes when unset', async () => {
    await expect(ttlOf(undefined)).resolves.toBe(300);
  });

  it('falls back rather than expiring instantly on a blank value', async () => {
    await expect(ttlOf('')).resolves.toBe(300);
    await expect(ttlOf('   ')).resolves.toBe(300);
  });

  it('falls back on a value that is not a positive number', async () => {
    for (const raw of ['abc', '0', '-60']) {
      await expect(ttlOf(raw)).resolves.toBe(300);
    }
  });
});

/**
 * `DeleteObjects` succeeds as a request even when keys inside it fail —
 * those come back in `Errors`. Ignoring them let the retention job delete
 * rows whose objects were still stored, and let a purge loop forever on a
 * key the store kept refusing.
 */
describe('deleting objects', () => {
  /** `send` is overloaded (its last form takes a callback and returns
   * void), so a promise-returning fake has to be cast to stand in for it. */
  function fakeSend(answer: (command: unknown) => Promise<unknown>) {
    return jest
      .spyOn(S3Client.prototype, 'send')
      .mockImplementation(answer as never);
  }

  function storageAnswering(
    answer: (keys: string[]) => { Errors?: { Key: string; Code: string }[] },
  ) {
    const storage = new ScreenshotStorageService(configWith(CONFIGURED));
    const send = fakeSend((command: unknown) => {
      if (command instanceof DeleteObjectsCommand) {
        const keys = (command.input.Delete?.Objects ?? []).map(
          (object) => object.Key!,
        );
        return Promise.resolve(answer(keys));
      }
      return Promise.resolve({});
    });
    return { storage, send };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the keys the store refused', async () => {
    const { storage } = storageAnswering(() => ({
      Errors: [{ Key: 'b.jpg', Code: 'AccessDenied' }],
    }));

    await expect(
      storage.deleteObjects(['a.jpg', 'b.jpg', 'c.jpg']),
    ).resolves.toEqual(['b.jpg']);
  });

  it('returns nothing when every key was deleted', async () => {
    const { storage } = storageAnswering(() => ({}));

    await expect(storage.deleteObjects(['a.jpg'])).resolves.toEqual([]);
  });

  describe('by prefix', () => {
    function listing(pending: Set<string>) {
      return (command: unknown) =>
        command instanceof ListObjectsV2Command
          ? Promise.resolve({ Contents: [...pending].map((Key) => ({ Key })) })
          : undefined;
    }

    it('retries a key the store refused once, then finishes', async () => {
      const pending = new Set(['org/a.jpg', 'org/b.jpg']);
      let refusedOnce = false;
      const storage = new ScreenshotStorageService(configWith(CONFIGURED));
      fakeSend((command: unknown) => {
        const list = listing(pending)(command);
        if (list) return list;
        const keys = (
          (command as DeleteObjectsCommand).input.Delete?.Objects ?? []
        ).map((object) => object.Key!);
        const errors: { Key: string; Code: string }[] = [];
        for (const key of keys) {
          if (key === 'org/b.jpg' && !refusedOnce) {
            refusedOnce = true;
            errors.push({ Key: key, Code: 'SlowDown' });
          } else {
            pending.delete(key);
          }
        }
        return Promise.resolve({ Errors: errors });
      });

      await expect(storage.deleteByPrefix('org/')).resolves.toBe(2);
      expect(pending.size).toBe(0);
    });

    it('gives up on a key the store keeps refusing instead of looping for ever', async () => {
      const pending = new Set(['org/stuck.jpg', 'org/fine.jpg']);
      const storage = new ScreenshotStorageService(configWith(CONFIGURED));
      const send = fakeSend((command: unknown) => {
        const list = listing(pending)(command);
        if (list) return list;
        pending.delete('org/fine.jpg');
        return Promise.resolve({
          Errors: [{ Key: 'org/stuck.jpg', Code: 'AccessDenied' }],
        });
      });

      await expect(storage.deleteByPrefix('org/')).rejects.toThrow(
        /org\/stuck\.jpg/,
      );
      // Three list-and-delete rounds, then it stops.
      expect(send).toHaveBeenCalledTimes(6);
    });
  });
});
