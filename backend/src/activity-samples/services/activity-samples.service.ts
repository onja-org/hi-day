import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { ActivitySampleItemDto } from '../dto/activity-sample-item.dto';

/** Ingest only — see docs/adr/0013-.... Activity level is read directly by `ScreenshotsService`, not via a summary endpoint here. */
@Injectable()
export class ActivitySamplesService {
  constructor(
    @InjectRepository(ActivitySample)
    private readonly activitySamples: Repository<ActivitySample>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
  ) {}

  async recordBatch(
    organisationId: string,
    userId: string,
    deviceId: string,
    samples: ActivitySampleItemDto[],
  ): Promise<void> {
    const membership = await this.getActiveMembership(organisationId, userId);

    const rows = samples.map((sample) =>
      this.activitySamples.create({
        organisationId,
        membershipId: membership.id,
        deviceId,
        activePercentage: sample.activePercentage,
        periodStart: new Date(sample.periodStart),
        periodEnd: new Date(sample.periodEnd),
      }),
    );

    await this.activitySamples.save(rows);
  }

  private async getActiveMembership(
    organisationId: string,
    userId: string,
  ): Promise<Membership> {
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }
    return membership;
  }
}
