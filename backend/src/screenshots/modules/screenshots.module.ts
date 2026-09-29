import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { Screenshot } from '../../database/entities/screenshot.entity';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { ScreenshotsController } from '../controllers/screenshots.controller';
import { ScreenshotsService } from '../services/screenshots.service';
import { ScreenshotStorageModule } from './screenshot-storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Screenshot, Membership, Organisation]),
    OrganisationsModule,
    JwtAuthModule,
    TimeEntriesModule,
    ScreenshotStorageModule,
  ],
  controllers: [ScreenshotsController],
  providers: [ScreenshotsService, RoleGuard],
  exports: [ScreenshotsService],
})
export class ScreenshotsModule {}
