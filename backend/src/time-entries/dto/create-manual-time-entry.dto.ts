import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateManualTimeEntryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsDateString()
  startedAt: string;

  @IsDateString()
  endedAt: string;

  /** Omit to log for yourself. Logging for someone else requires the
   * caller to be an org admin/manager, or hold a `manager`-tier
   * ProjectMembership on this Project — see
   * TimeEntriesService.resolveManualEntryTarget. */
  @IsOptional()
  @IsUUID()
  membershipId?: string;
}
