import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MAX_SLOT_HOURS_PAGE_SIZE } from '../services/screenshots.service';

/**
 * Query string for the Screenshots page's 10-minute view. Paged by **hour**
 * — a slot belongs to one, so an hour is the smallest unit a page can be cut
 * on without splitting a row. `page`/`pageSize` arrive as strings and are
 * coerced; an out-of-range value is a 400, never a silently-clamped page.
 */
export class ListScreenshotSlotsDto {
  /** `YYYY-MM-DD`; the service checks the format and defaults it. */
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SLOT_HOURS_PAGE_SIZE)
  pageSize?: number;

  /** An instant to open on: with no `page`, the page holding its hour is
   * served, so a link to a moment (e.g. an Unusual activity instance)
   * lands on it rather than on the day's newest hours. */
  @IsOptional()
  @IsISO8601()
  at?: string;
}
