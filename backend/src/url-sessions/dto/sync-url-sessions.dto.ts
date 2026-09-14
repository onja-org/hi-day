import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { UrlSessionEntryDto } from './url-session-entry.dto';

// Client tunes its own batch size (SyncQueue's default is 50 — see
// docs/url-tracking-api.md's Batching section, "nothing here requires that
// number specifically"); this cap is just a defensive upper bound, not a
// pinned contract value.
const MAX_SESSIONS_PER_REQUEST = 200;

export class SyncUrlSessionsDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SESSIONS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => UrlSessionEntryDto)
  sessions: UrlSessionEntryDto[];
}
