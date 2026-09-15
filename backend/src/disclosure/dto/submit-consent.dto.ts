import { IsIn, IsUUID } from 'class-validator';
import { ConsentDecision } from '../../database/entities/consent-decision.enum';

export class SubmitConsentDto {
  @IsUUID()
  disclosureVersionId: string;

  @IsIn([ConsentDecision.GRANTED, ConsentDecision.DECLINED])
  decision: ConsentDecision;
}
