import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * The only content-type the agent is allowed to upload as — baked into the
 * presigned PUT URL (SigV4 signs the `Content-Type` header when it's set
 * on the command), so a client can't swap in an arbitrary file type.
 */
const SCREENSHOT_CONTENT_TYPE = 'image/jpeg';

/** S3-compatible `DeleteObjects` accepts at most 1000 keys per call. */
const MAX_DELETE_BATCH_SIZE = 1000;

/**
 * Wraps the Wasabi (S3-compatible) client used for screenshots — see
 * docs/adr/0012-... for the full design. The API only ever handles
 * presigned URLs and storage keys here, never image bytes — screenshots
 * upload directly from the desktop agent to the bucket
 * (docs/TECH_DESIGN.md §4).
 */
/** The settings without which there is nowhere to put a screenshot. */
const REQUIRED_STORAGE_VARS = [
  'WASABI_BUCKET',
  'WASABI_REGION',
  'WASABI_ENDPOINT',
  'WASABI_ACCESS_KEY_ID',
  'WASABI_SECRET_ACCESS_KEY',
] as const;

@Injectable()
export class ScreenshotStorageService {
  private readonly logger = new Logger(ScreenshotStorageService.name);

  /**
   * Null where no object storage is configured.
   *
   * Screenshot capture needs somewhere to put the images, and a self-hosted
   * install should not have to open an account with a storage provider
   * before Hi Day will start — time tracking, projects, reports and the
   * desktop agent all work without one. So the settings are optional and
   * every other feature carries on; only screenshots are unavailable.
   *
   * These used to be read with `getOrThrow`, which made a bucket mandatory
   * to boot. It appeared to work in Docker only because an empty string
   * satisfies `getOrThrow` — the app then started and failed on the first
   * upload with an opaque credentials error instead of saying plainly that
   * nothing was configured.
   */
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly urlTtlSeconds: number;

  constructor(configService: ConfigService) {
    this.bucket = configService.get<string>('WASABI_BUCKET')?.trim() ?? '';
    this.urlTtlSeconds = Number(
      configService.get<string>('SCREENSHOT_URL_TTL_SECONDS', '300'),
    );

    const settings = REQUIRED_STORAGE_VARS.map(
      (name) => configService.get<string>(name)?.trim() ?? '',
    );
    const missing = REQUIRED_STORAGE_VARS.filter((_, i) => settings[i] === '');

    if (missing.length > 0) {
      this.client = null;
      this.logger.warn(
        `Screenshot storage is not configured (${missing.join(', ')}), so ` +
          'screenshots cannot be captured or viewed. Everything else works.',
      );
      return;
    }

    const [, region, endpoint, accessKeyId, secretAccessKey] = settings;
    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      // Wasabi (like most non-AWS S3-compatible providers) serves buckets
      // at <endpoint>/<bucket>/<key>, not AWS's default virtual-hosted
      // <bucket>.<endpoint> style.
      forcePathStyle: true,
    });
  }

  /** Whether screenshots can be stored at all on this installation. */
  get isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Throws unless storage is configured. Callers that can answer without it
   * check `isConfigured` first; the rest fail loudly here rather than
   * sending an unsigned request to nowhere.
   */
  private get s3(): S3Client {
    if (!this.client) {
      throw new Error(
        'Screenshot storage is not configured on this installation. Set ' +
          `${REQUIRED_STORAGE_VARS.join(', ')} to enable screenshots.`,
      );
    }
    return this.client;
  }

  /**
   * One key per screenshot, namespaced by org and device so a bucket
   * listing (or a future per-device export) reads naturally — never
   * derived from anything the client sends, so a device can't overwrite
   * another device's object by guessing its key.
   */
  buildStorageKey(
    organisationId: string,
    deviceId: string,
    capturedAt: Date,
  ): string {
    return `screenshots/${organisationId}/${deviceId}/${capturedAt.getTime()}-${randomUUID()}.jpg`;
  }

  // `async` so that an unconfigured installation rejects rather than
  // throwing synchronously out of a function that returns a promise — a
  // caller using `.catch()` would otherwise miss it entirely.
  async createUploadUrl(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: SCREENSHOT_CONTENT_TYPE,
      }),
      { expiresIn: this.urlTtlSeconds },
    );
  }

  /** Time-limited read access for the web console's screenshot gallery — never a public/permanent URL. */
  // `async` for the same reason as `createUploadUrl`.
  async createViewUrl(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: this.urlTtlSeconds },
    );
  }

  /** Used by the retention cleanup job — deletes the underlying objects once their DB rows expire. */
  async deleteObjects(storageKeys: string[]): Promise<void> {
    for (let i = 0; i < storageKeys.length; i += MAX_DELETE_BATCH_SIZE) {
      const batch = storageKeys.slice(i, i + MAX_DELETE_BATCH_SIZE);
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((key) => ({ Key: key })) },
        }),
      );
    }
  }

  /**
   * Deletes every object under a key prefix and returns how many were
   * removed — used by account purge, where "nothing left behind" has to hold
   * even for objects no DB row points at any more (an orphan from a failed
   * upload, say). Re-listing until empty rather than trusting one pass.
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    let deleted = 0;
    for (;;) {
      const keys = await this.listKeys(prefix);
      if (keys.length === 0) {
        return deleted;
      }
      await this.deleteObjects(keys);
      deleted += keys.length;
    }
  }

  /** True if any object still exists under the prefix. */
  async hasObjectsWithPrefix(prefix: string): Promise<boolean> {
    const result = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 1,
      }),
    );
    return (result.KeyCount ?? 0) > 0;
  }

  private async listKeys(prefix: string): Promise<string[]> {
    const result = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: MAX_DELETE_BATCH_SIZE,
      }),
    );
    return (result.Contents ?? []).flatMap((object) =>
      object.Key ? [object.Key] : [],
    );
  }
}
