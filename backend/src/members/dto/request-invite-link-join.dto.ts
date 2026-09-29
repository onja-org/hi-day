import { IsEmail, MaxLength } from 'class-validator';

export class RequestInviteLinkJoinDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
