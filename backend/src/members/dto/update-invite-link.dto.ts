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
import { INVITE_LINK_ROLES } from './create-invite-link.dto';

/** Every field of CreateInviteLinkDto, all optional — only what's sent changes. */
export class UpdateInviteLinkDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(INVITE_LINK_ROLES)
  role?: MembershipRole;

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

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  usageCap?: number | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
