import { IsBoolean, IsIn } from 'class-validator';
import {
  SUMMARY_EMAIL_KINDS,
  type SummaryEmailKind,
} from '../../organisations/summary-emails';

/** A person switching one of their own summary emails on or off. */
export class UpdateSummaryEmailPreferenceDto {
  @IsIn(SUMMARY_EMAIL_KINDS)
  kind: SummaryEmailKind;

  @IsBoolean()
  enabled: boolean;
}
