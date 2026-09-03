import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntriesController } from '../controllers/time-entries.controller';
import { TimeEntriesService } from '../services/time-entries.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeEntry, Membership, Organisation]),
    AuditLogModule,
    JwtAuthModule,
  ],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService, RoleGuard],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
