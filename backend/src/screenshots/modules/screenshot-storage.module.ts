import { Module } from '@nestjs/common';
import { ScreenshotStorageService } from '../services/screenshot-storage.service';

/**
 * The Wasabi client on its own, so anything needing to delete stored
 * screenshots can have it without importing `ScreenshotsModule` — which
 * imports `TimeEntriesModule` and would make a cycle.
 */
@Module({
  providers: [ScreenshotStorageService],
  exports: [ScreenshotStorageService],
})
export class ScreenshotStorageModule {}
