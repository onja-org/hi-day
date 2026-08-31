import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { EmailModule } from '../../email/modules/email.module';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import { JwtAuthModule } from './jwt-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    EmailModule,
    OrganisationsModule,
    JwtAuthModule,
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 15 * 60 * 1000, limit: 5 },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
  exports: [PasswordService, TokenService],
})
export class AuthModule {}
