import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { ASSIGNABLE_MEMBERSHIP_ROLES } from '../assignable-membership-roles';

export class UpdateMembershipDto {
  @IsOptional()
  @IsIn(ASSIGNABLE_MEMBERSHIP_ROLES)
  role?: MembershipRole;

  @IsOptional()
  @IsBoolean()
  deactivate?: boolean;
}
