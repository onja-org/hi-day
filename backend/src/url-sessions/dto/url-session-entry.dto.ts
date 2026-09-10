import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { UrlSessionConfidence } from '../../database/entities/url-session-confidence.enum';
import { UrlSessionSource } from '../../database/entities/url-session-source.enum';

/** Mirrors `desktop/src/main/url-capture/session-types.ts`'s `UrlSession` — see docs/url-tracking-api.md. */
export class UrlSessionEntryDto {
  @IsUUID()
  id: string;

  @IsString()
  url: string;

  @IsString()
  host: string;

  @IsOptional()
  @IsString()
  path?: string | null;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsString()
  browser: string;

  @IsOptional()
  @IsBoolean()
  private?: boolean | null;

  @IsUUID()
  deviceId: string;

  @IsInt()
  startedAt: number;

  @IsInt()
  endedAt: number;

  @IsInt()
  activeMs: number;

  @IsInt()
  tzOffsetMin: number;

  @IsEnum(UrlSessionSource)
  source: UrlSessionSource;

  @IsEnum(UrlSessionConfidence)
  confidence: UrlSessionConfidence;
}
