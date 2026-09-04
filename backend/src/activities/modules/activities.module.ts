import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Activity } from '../../database/entities/activity.entity';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { ActivitiesController } from '../controllers/activities.controller';
import { ActivitiesService } from '../services/activities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Activity, Membership, Organisation]),
    AuditLogModule,
    JwtAuthModule,
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, RoleGuard],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
