import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MembershipRole } from '../../database/entities/membership-role.enum';

/** The roles a link can grant — never admin. */
export const INVITE_LINK_ROLES: MembershipRole[] = [
  MembershipRole.MEMBER,
  MembershipRole.MANAGER,
];

export class CreateInviteLinkDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsIn(INVITE_LINK_ROLES)
  role: MembershipRole;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  teamIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  projectIds?: string[];

  /** ISO date-time; null or omitted means the link never expires. */
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsDateString()
  expiresAt?: string | null;

  /** Max accepted joins; null or omitted means unlimited. */
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  usageCap?: number | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
