import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

const jwtModule = JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    secret: configService.getOrThrow<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: configService.get<string>(
        'JWT_EXPIRES_IN',
        '1h',
      ) as unknown as number,
    },
  }),
});

@Module({
  imports: [jwtModule],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, jwtModule],
})
export class JwtAuthModule {}
