import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** A 6-digit code from the authenticator app, or a recovery code. */
export class TwoFactorCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;
}
