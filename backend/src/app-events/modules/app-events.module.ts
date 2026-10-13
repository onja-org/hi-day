import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { AppEvent } from '../../database/entities/app-event.entity';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { AppEventsController } from '../controllers/app-events.controller';
import { AppEventsService } from '../services/app-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppEvent, Membership, Organisation]),
    JwtAuthModule,
    OrganisationsModule,
    TimeEntriesModule,
  ],
  controllers: [AppEventsController],
  providers: [AppEventsService, RoleGuard],
  exports: [AppEventsService],
})
export class AppEventsModule {}
