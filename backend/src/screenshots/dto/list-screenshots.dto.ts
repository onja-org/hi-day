import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MAX_SCREENSHOTS_PAGE_SIZE } from '../services/screenshots.service';

/**
 * Query string for a day's screenshot gallery. `date`'s format is checked
 * by the service (it also defaults it), so here it only has to be a string.
 * `page`/`pageSize` arrive as strings and are coerced — a non-integer or
 * out-of-range value is a 400, never a silently-clamped page.
 */
export class ListScreenshotsDto {
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
  @Max(MAX_SCREENSHOTS_PAGE_SIZE)
  pageSize?: number;

  /** `oldest` (the default) for a day's gallery; `newest` for a preview
   * of the latest few. */
  @IsOptional()
  @IsIn(['oldest', 'newest'])
  order?: 'oldest' | 'newest';
}
