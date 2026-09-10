import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { UrlSession } from '../../database/entities/url-session.entity';
import { RoleGuard } from '../../common/guards/role.guard';
import { UrlSessionsController } from '../controllers/url-sessions.controller';
import { UrlSessionsService } from '../services/url-sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UrlSession, Membership, Organisation]),
    AuditLogModule,
    JwtAuthModule,
  ],
  controllers: [UrlSessionsController],
  providers: [UrlSessionsService, RoleGuard],
  exports: [UrlSessionsService],
})
export class UrlSessionsModule {}
