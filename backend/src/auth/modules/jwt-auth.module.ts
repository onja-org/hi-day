import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DEFAULT_ACCESS_TOKEN_TTL_DAYS } from '../../common/session-cookies.util';
import { User } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { AccessTokenService } from '../services/access-token.service';

const jwtModule = JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const accessTokenTtlDays = Number(
      configService.get('ACCESS_TOKEN_TTL_DAYS', DEFAULT_ACCESS_TOKEN_TTL_DAYS),
    );

    return {
      secret: configService.getOrThrow<string>('JWT_SECRET'),
      signOptions: { expiresIn: `${accessTokenTtlDays}d` },
    };
  },
});

@Module({
  imports: [jwtModule, TypeOrmModule.forFeature([User])],
  providers: [JwtAuthGuard, AccessTokenService],
  exports: [JwtAuthGuard, AccessTokenService, jwtModule],
})
export class JwtAuthModule {}
