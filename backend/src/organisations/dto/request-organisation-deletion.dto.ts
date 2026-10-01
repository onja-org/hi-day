import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { OrganisationDeletionMode } from '../../database/entities/organisation-deletion-request.entity';

export class RequestOrganisationDeletionDto {
  @IsIn(Object.values(OrganisationDeletionMode))
  mode: OrganisationDeletionMode;

  /** Required when `mode` is `scheduled`; must be in the future. */
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  /** Must match the organisation's name exactly. */
  @IsString()
  @MinLength(1)
  confirmName: string;
}
