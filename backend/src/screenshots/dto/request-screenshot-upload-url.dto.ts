import { IsISO8601 } from 'class-validator';

export class RequestScreenshotUploadUrlDto {
  /** When the agent is about to capture — used to namespace the storage key. */
  @IsISO8601()
  capturedAt: string;
}
