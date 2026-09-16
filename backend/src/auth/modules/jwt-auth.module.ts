import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DEFAULT_ACCESS_TOKEN_TTL_DAYS } from '../../common/session-cookies.util';
import { JwtAuthGuard } from '../jwt-auth.guard';

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
  imports: [jwtModule],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, jwtModule],
})
export class JwtAuthModule {}
