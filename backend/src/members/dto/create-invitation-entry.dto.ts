import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { ASSIGNABLE_MEMBERSHIP_ROLES } from '../assignable-membership-roles';

export class CreateInvitationEntryDto {
  @IsString()
  @MinLength(1)
  email: string;

  @IsIn(ASSIGNABLE_MEMBERSHIP_ROLES)
  role: MembershipRole;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
