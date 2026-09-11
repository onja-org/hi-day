import { IsISO8601, IsString, MinLength } from 'class-validator';

export class CreateScreenshotDto {
  /** Must be a key this device was actually issued via `/device/screenshots/upload-url` — see ScreenshotsService.recordScreenshot. */
  @IsString()
  @MinLength(1)
  storageKey: string;

  @IsISO8601()
  capturedAt: string;
}
