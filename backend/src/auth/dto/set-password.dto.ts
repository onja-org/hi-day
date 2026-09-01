import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_PATTERN,
} from './password-complexity';

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6)
  @Matches(PASSWORD_COMPLEXITY_PATTERN, {
    message: PASSWORD_COMPLEXITY_MESSAGE,
  })
  password: string;
}
