import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request } from 'express';
import { ActivitiesModule } from '../../activities/modules/activities.module';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { AuthModule } from '../../auth/modules/auth.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { DevicesModule } from '../../devices/modules/devices.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { Invitation } from '../../database/entities/invitation.entity';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { User } from '../../database/entities/user.entity';
import { EmailModule } from '../../email/modules/email.module';
import { InvitationAcceptController } from '../controllers/invitation-accept.controller';
import { InvitationsController } from '../controllers/invitations.controller';
import { MembershipsController } from '../controllers/memberships.controller';
import { InvitationsService } from '../services/invitations.service';
import { MembershipsService } from '../services/memberships.service';

function inviteCreateTracker(req: Request): string {
  const organisationId = (req.params as { id?: string } | undefined)?.id ?? '';
  const userId = (req as unknown as { userId?: string }).userId ?? req.ip ?? '';
  return `${userId}:${organisationId}`;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation, Membership, User, Organisation]),
    AuditLogModule,
    EmailModule,
    JwtAuthModule,
    AuthModule,
    DevicesModule,
    ActivitiesModule,
    TimeEntriesModule,
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 15 * 60 * 1000, limit: 10 },
      {
        name: 'invite',
        ttl: 15 * 60 * 1000,
        limit: 20,
        getTracker: inviteCreateTracker,
      },
    ]),
  ],
  controllers: [
    InvitationsController,
    MembershipsController,
    InvitationAcceptController,
  ],
  providers: [InvitationsService, MembershipsService, RoleGuard],
})
export class MembersModule {}
