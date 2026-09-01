import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

const PASSWORD_COMPLEXITY_PATTERN = /(?=.*[A-Za-z])(?=.*\d)/;

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6)
  @Matches(PASSWORD_COMPLEXITY_PATTERN, {
    message: 'password must contain at least one letter and one number',
  })
  password: string;
}
