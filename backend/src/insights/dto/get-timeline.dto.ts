import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Query string for one member's Insights Timeline. `from` and `to` are
 * inclusive calendar days on the organisation's calendar; the service caps
 * how many days one request may span.
 */
export class GetTimelineDto {
  /** Whose timeline; omitted means the caller's own. */
  @IsOptional()
  @IsUUID()
  membershipId?: string;

  @IsString()
  @Matches(DATE_KEY, { message: 'from must be formatted as YYYY-MM-DD.' })
  from!: string;

  @IsString()
  @Matches(DATE_KEY, { message: 'to must be formatted as YYYY-MM-DD.' })
  to!: string;
}
