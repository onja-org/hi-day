import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { TokenService } from '../../auth/services/token.service';
import { RoleGuard } from '../../common/guards/role.guard';
import { Device } from '../../database/entities/device.entity';
import { DeviceSession } from '../../database/entities/device-session.entity';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { DeviceSessionController } from '../controllers/device-session.controller';
import { DevicesController } from '../controllers/devices.controller';
import { MyDevicesController } from '../controllers/my-devices.controller';
import { DeviceSessionGuard } from '../device-session.guard';
import { DeviceSessionService } from '../services/device-session.service';
import { DevicesService } from '../services/devices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, DeviceSession, Membership, Organisation]),
    AuditLogModule,
    JwtAuthModule,
  ],
  controllers: [
    DevicesController,
    MyDevicesController,
    DeviceSessionController,
  ],
  providers: [
    DevicesService,
    DeviceSessionService,
    DeviceSessionGuard,
    RoleGuard,
    TokenService,
  ],
  exports: [DevicesService, DeviceSessionService],
})
export class DevicesModule {}
