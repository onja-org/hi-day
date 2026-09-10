import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
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
@Injectable()
export class ScreenshotStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly urlTtlSeconds: number;

  constructor(configService: ConfigService) {
    this.bucket = configService.getOrThrow<string>('WASABI_BUCKET');
    this.urlTtlSeconds = Number(
      configService.get<string>('SCREENSHOT_URL_TTL_SECONDS', '300'),
    );
    this.client = new S3Client({
      region: configService.getOrThrow<string>('WASABI_REGION'),
      endpoint: configService.getOrThrow<string>('WASABI_ENDPOINT'),
      credentials: {
        accessKeyId: configService.getOrThrow<string>('WASABI_ACCESS_KEY_ID'),
        secretAccessKey: configService.getOrThrow<string>(
          'WASABI_SECRET_ACCESS_KEY',
        ),
      },
      // Wasabi (like most non-AWS S3-compatible providers) serves buckets
      // at <endpoint>/<bucket>/<key>, not AWS's default virtual-hosted
      // <bucket>.<endpoint> style.
      forcePathStyle: true,
    });
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

  createUploadUrl(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: SCREENSHOT_CONTENT_TYPE,
      }),
      { expiresIn: this.urlTtlSeconds },
    );
  }

  /** Time-limited read access for the web console's screenshot gallery — never a public/permanent URL. */
  createViewUrl(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: this.urlTtlSeconds },
    );
  }

  /** Used by the retention cleanup job — deletes the underlying objects once their DB rows expire. */
  async deleteObjects(storageKeys: string[]): Promise<void> {
    for (let i = 0; i < storageKeys.length; i += MAX_DELETE_BATCH_SIZE) {
      const batch = storageKeys.slice(i, i + MAX_DELETE_BATCH_SIZE);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((key) => ({ Key: key })) },
        }),
      );
    }
  }
}
