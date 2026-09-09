import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AppEventTitleUnavailableReason } from '../../database/entities/app-event-title-unavailable-reason.enum';

const TITLE_UNAVAILABLE_REASON_VALUES = Object.values(
  AppEventTitleUnavailableReason,
);

export class AppEventItemDto {
  @IsString()
  @MinLength(1)
  appName: string;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsIn(TITLE_UNAVAILABLE_REASON_VALUES)
  titleUnavailableReason?: AppEventTitleUnavailableReason | null;

  @IsISO8601()
  sampledAt: string;
}
