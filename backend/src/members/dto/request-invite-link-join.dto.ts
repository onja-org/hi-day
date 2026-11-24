import { IsEmail, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

export class RequestInviteLinkJoinDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;
}
