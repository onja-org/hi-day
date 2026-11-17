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
export const MAX_DELETE_BATCH_SIZE = 1000;

/**
 * How many times `deleteByPrefix` tries one key before giving up on the
 * whole prefix. A key the store keeps refusing would otherwise be listed
 * and refused again forever.
 */
const MAX_PREFIX_DELETE_ATTEMPTS = 3;

/**
 * Wraps the Wasabi (S3-compatible) client used for screenshots — see
 * docs/adr/0012-... for the full design. The API only ever handles
 * presigned URLs and storage keys here, never image bytes — screenshots
 * upload directly from the desktop agent to the bucket
 * (docs/TECH_DESIGN.md §4).
 */
/** Five minutes: long enough for an upload, short enough that a leaked
 * link dies quickly. */
const DEFAULT_URL_TTL_SECONDS = 300;

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
   * Null where no object storage is configured. Optional so a self-hosted
   * install need not open a storage account before Hi Day will start; only
   * screenshots are unavailable without it.
   */
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly urlTtlSeconds: number;

  constructor(configService: ConfigService) {
    this.bucket = configService.get<string>('WASABI_BUCKET')?.trim() ?? '';
    this.urlTtlSeconds = this.readUrlTtl(
      configService.get<string>('SCREENSHOT_URL_TTL_SECONDS'),
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

  /**
   * Seconds a presigned URL stays valid.
   *
   * Guarded because `Number('')` is 0 and `Number('abc')` is NaN, and
   * either makes `expiresIn` sign a URL that is already expired — so every
   * upload is rejected and no screenshot is ever recorded, with nothing in
   * the logs naming the cause. A blank value is exactly what copying
   * .env.example and deleting the number leaves behind, and `get`'s own
   * default does not cover it: an empty string is defined.
   */
  private readUrlTtl(raw: string | undefined): number {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;

    if (raw !== undefined && raw.trim() !== '') {
      this.logger.warn(
        `SCREENSHOT_URL_TTL_SECONDS is "${raw}", which is not a positive number. Using ${DEFAULT_URL_TTL_SECONDS}s.`,
      );
    }
    return DEFAULT_URL_TTL_SECONDS;
  }

  /** Whether screenshots can be stored at all on this installation. */
  get isConfigured(): boolean {
    return this.client !== null;
  }

  /** Fails loudly rather than sending an unsigned request to nowhere. */
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

  // `async` so an unconfigured install rejects rather than throwing
  // synchronously, which a caller using `.catch()` would miss.
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
  async createViewUrl(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: this.urlTtlSeconds },
    );
  }

  /**
   * Deletes these objects and returns the keys the store refused.
   *
   * `DeleteObjects` succeeds as a request even when some of its keys fail:
   * those come back in `Errors`, not as a thrown error. Ignoring that
   * array is how a caller came to delete the row behind an object that was
   * still there. A key that doesn't exist counts as deleted, as S3 itself
   * reports it. Every refusal is logged here, so a caller with nothing to
   * do about one may ignore the result.
   */
  async deleteObjects(storageKeys: string[]): Promise<string[]> {
    const failed: string[] = [];
    for (let i = 0; i < storageKeys.length; i += MAX_DELETE_BATCH_SIZE) {
      const batch = storageKeys.slice(i, i + MAX_DELETE_BATCH_SIZE);
      const result = await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((key) => ({ Key: key })) },
        }),
      );
      for (const error of result.Errors ?? []) {
        if (!error.Key) continue;
        failed.push(error.Key);
        this.logger.warn(
          `Could not delete ${error.Key}: ${error.Code ?? 'unknown'} ${error.Message ?? ''}`.trim(),
        );
      }
    }
    return failed;
  }

  /**
   * Deletes every object under a key prefix and returns how many were
   * removed — used by account purge, where "nothing left behind" has to hold
   * even for objects no DB row points at any more (an orphan from a failed
   * upload, say). Re-listing until empty rather than trusting one pass.
   *
   * A refused key is listed again on the next pass and retried, but only
   * `MAX_PREFIX_DELETE_ATTEMPTS` times: one the store refuses for good used
   * to keep this looping forever, and with it the purge that called it.
   * Throwing instead lets the purge fail, be logged, and retry next hour.
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    let deleted = 0;
    const attempts = new Map<string, number>();
    for (;;) {
      const keys = await this.listKeys(prefix);
      if (keys.length === 0) {
        return deleted;
      }
      const failed = await this.deleteObjects(keys);
      deleted += keys.length - failed.length;

      const exhausted: string[] = [];
      for (const key of failed) {
        const tries = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, tries);
        if (tries >= MAX_PREFIX_DELETE_ATTEMPTS) exhausted.push(key);
      }
      if (exhausted.length > 0) {
        throw new Error(
          `Could not delete ${exhausted.length} object(s) under ${prefix} after ` +
            `${MAX_PREFIX_DELETE_ATTEMPTS} attempts, e.g. ${exhausted[0]}`,
        );
      }
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
