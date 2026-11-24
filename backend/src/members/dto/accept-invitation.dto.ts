import { IsOptional, IsString, MinLength, Validate } from 'class-validator';
import {
  IsNotCommonPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_TOO_SHORT_MESSAGE,
} from '../../auth/dto/password-policy';

export class AcceptInvitationDto {
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_TOO_SHORT_MESSAGE })
  @Validate(IsNotCommonPassword)
  password?: string;

  /**
   * The existing account's password, for someone who can't log in first —
   * a deactivated former member being re-invited. Not held to today's
   * complexity rules: it was set under whatever rules applied then.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;
}
