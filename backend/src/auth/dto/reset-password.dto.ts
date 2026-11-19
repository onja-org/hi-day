import { IsNotEmpty, IsString, MinLength, Validate } from 'class-validator';
import {
  IsNotCommonPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_TOO_SHORT_MESSAGE,
} from './password-policy';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_TOO_SHORT_MESSAGE })
  @Validate(IsNotCommonPassword)
  password: string;
}
