import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { AppEvent } from '../../database/entities/app-event.entity';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { UrlSession } from '../../database/entities/url-session.entity';
import { WorkClassification } from '../../database/entities/work-classification.entity';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { WorkClassificationController } from '../controllers/work-classification.controller';
import { WorkClassificationService } from '../services/work-classification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkClassification,
      AppEvent,
      UrlSession,
      Membership,
      Organisation,
    ]),
    JwtAuthModule,
    TimeEntriesModule,
  ],
  controllers: [WorkClassificationController],
  providers: [WorkClassificationService, RoleGuard],
  exports: [WorkClassificationService],
})
export class WorkClassificationModule {}
