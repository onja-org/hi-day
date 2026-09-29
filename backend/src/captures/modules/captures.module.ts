import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEvent } from '../../database/entities/app-event.entity';
import { Screenshot } from '../../database/entities/screenshot.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { UrlSession } from '../../database/entities/url-session.entity';
import { ScreenshotStorageModule } from '../../screenshots/modules/screenshot-storage.module';
import { CaptureCleanupService } from '../services/capture-cleanup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppEvent, UrlSession, Screenshot, TimeEntry]),
    ScreenshotStorageModule,
  ],
  providers: [CaptureCleanupService],
  exports: [CaptureCleanupService],
})
export class CapturesModule {}
