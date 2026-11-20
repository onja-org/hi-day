import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_PATTERN,
} from '../../auth/dto/password-complexity';

export class AcceptInvitationDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  @Matches(PASSWORD_COMPLEXITY_PATTERN, {
    message: PASSWORD_COMPLEXITY_MESSAGE,
  })
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
