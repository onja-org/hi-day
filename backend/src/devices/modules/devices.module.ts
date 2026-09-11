import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { TokenService } from '../../auth/services/token.service';
import { RoleGuard } from '../../common/guards/role.guard';
import { Device } from '../../database/entities/device.entity';
import { DevicePairingRequest } from '../../database/entities/device-pairing-request.entity';
import { DeviceSession } from '../../database/entities/device-session.entity';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { DevicePairingController } from '../controllers/device-pairing.controller';
import { DeviceSessionController } from '../controllers/device-session.controller';
import { DevicesController } from '../controllers/devices.controller';
import { MyDevicesController } from '../controllers/my-devices.controller';
import { DeviceSessionGuard } from '../device-session.guard';
import { DevicePairingService } from '../services/device-pairing.service';
import { DeviceSessionService } from '../services/device-session.service';
import { DevicesService } from '../services/devices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Device,
      DevicePairingRequest,
      DeviceSession,
      Membership,
      Organisation,
    ]),
    AuditLogModule,
    JwtAuthModule,
    // Named separately from other modules' own 'default' throttlers — the
    // desktop app polls the pairing status endpoint every few seconds
    // while waiting for approval, which needs a much higher allowance than
    // this codebase's usual auth-adjacent limits (see ADR-0009).
    ThrottlerModule.forRoot([{ name: 'pairing', ttl: 60 * 1000, limit: 40 }]),
  ],
  controllers: [
    DevicePairingController,
    DevicesController,
    MyDevicesController,
    DeviceSessionController,
  ],
  providers: [
    DevicePairingService,
    DevicesService,
    DeviceSessionService,
    DeviceSessionGuard,
    RoleGuard,
    TokenService,
  ],
  exports: [DevicesService, DeviceSessionService],
})
export class DevicesModule {}
