import { IsString, MaxLength } from 'class-validator';

export class UnsubscribeSummaryEmailDto {
  @IsString()
  @MaxLength(200)
  token: string;
}
