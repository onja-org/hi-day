import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { REPORT_DATE_PRESETS } from '../../common/report-date-range.util';

const GROUPINGS = ['none', 'day', 'week', 'project', 'member', 'team', 'todo'];
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILTER_VALUES = 200;

export class DayRangeDto {
  @Matches(DATE_KEY)
  from: string;

  @Matches(DATE_KEY)
  to: string;
}

export class ReportFiltersDto {
  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @IsUUID('all', { each: true })
  memberIds: string[];

  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @IsUUID('all', { each: true })
  teamIds: string[];

  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @IsUUID('all', { each: true })
  projectIds: string[];
}

export class SavedReportSettingsDto {
  // null means a fixed custom range (`days`), not a rolling preset.
  @ValidateIf(
    (settings: SavedReportSettingsDto) => settings.datePreset !== null,
  )
  @IsIn([...REPORT_DATE_PRESETS])
  datePreset: string | null;

  @ValidateNested()
  @Type(() => DayRangeDto)
  days: DayRangeDto;

  @IsIn(['me', 'all'])
  scope: 'me' | 'all';

  @IsIn(GROUPINGS)
  grouping: string;

  @ValidateNested()
  @Type(() => ReportFiltersDto)
  filters: ReportFiltersDto;
}

export class ReportScheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true })
  emails: string[];

  @IsString()
  @MaxLength(2000)
  message: string;

  @IsIn(['pdf', 'csv'])
  fileType: 'pdf' | 'csv';

  @IsIn([...REPORT_DATE_PRESETS])
  dateRange: string;

  @IsIn(['daily', 'weekly', 'monthly'])
  frequency: 'daily' | 'weekly' | 'monthly';

  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days: number[];
}

/** Used for both create and update: saving always replaces the report's name, settings and schedule. */
export class UpsertSavedReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ValidateNested()
  @Type(() => SavedReportSettingsDto)
  settings: SavedReportSettingsDto;

  // Absent or null means "not scheduled" (and removes an existing schedule).
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportScheduleDto)
  schedule?: ReportScheduleDto | null;
}
