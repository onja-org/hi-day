import { IsOptional, IsUUID } from 'class-validator';

export class ApproveDevicePairingDto {
  /**
   * Which of the approver's Organisations the device joins. Required when
   * they belong to more than one; left out, a single-organisation approver
   * pairs into their only one.
   */
  @IsOptional()
  @IsUUID()
  organisationId?: string;
}
