import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { ActivitySampleItemDto } from '../dto/activity-sample-item.dto';

/**
 * Ingest-only, like the AppEvent pipeline it mirrors. Reading happens in
 * `TimeEntriesService`, which averages the samples covering each entry —
 * there is no raw-sample read API.
 */
@Injectable()
export class ActivitySamplesService {
  constructor(
    @InjectRepository(ActivitySample)
    private readonly activitySamples: Repository<ActivitySample>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
  ) {}

  /**
   * Stores a batch from one Device, attributed to whoever is signed in on it
   * *now* — never to anything on the Device row, which on a shared machine
   * reflects whoever logged in last (see CONTEXT.md's Device entry).
   */
  async recordBatch(
    organisationId: string,
    userId: string,
    deviceId: string,
    samples: ActivitySampleItemDto[],
  ): Promise<void> {
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }

    await this.activitySamples.save(
      samples.map((sample) =>
        this.activitySamples.create({
          organisationId,
          membershipId: membership.id,
          deviceId,
          activePercentage: sample.activePercentage,
          periodStart: new Date(sample.periodStart),
          periodEnd: new Date(sample.periodEnd),
        }),
      ),
    );
  }
}
