import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { ASSIGNABLE_MEMBERSHIP_ROLES } from '../assignable-membership-roles';

export class UpdateMembershipDto {
  @IsOptional()
  @IsIn(ASSIGNABLE_MEMBERSHIP_ROLES)
  role?: MembershipRole;

  @IsOptional()
  @IsBoolean()
  deactivate?: boolean;

  /**
   * The jurisdiction used to resolve which disclosure/consent text applies
   * to this person (see CONTEXT.md's Disclosure region entry). Editable by
   * an org admin (any Membership, including their own) or a manager (only
   * for a member of a team they manage — never their own Membership, same
   * as every other field here; see MembershipsService.update). `null`
   * clears it back to "use the org's region-less default text".
   */
  @IsOptional()
  @IsString()
  disclosureRegion?: string | null;

  /**
   * The person's name. Lives on their User, which is shared across every
   * organisation they belong to — so a rename here shows everywhere.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;
}
