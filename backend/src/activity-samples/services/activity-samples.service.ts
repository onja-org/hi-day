import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { OrganisationsService } from '../../organisations/services/organisations.service';
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
    private readonly organisationsService: OrganisationsService,
  ) {}

  /**
   * Stores a batch from one Device, attributed to whoever is signed in on it
   * *now* — never to anything on the Device row, which on a shared machine
   * reflects whoever logged in last (see CONTEXT.md's Device entry).
   *
   * Re-checks "Record activity" server-side like
   * `AppEventsService.recordBatch` does for Track apps & URLs — the promise
   * has to hold for a stale or offline-cached agent too.
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

    // Silently, same as app events: an agent told "off" has nothing to fix
    // by retrying. What it measured while recording was still on is kept
    // though — the part-period it sends at the switch, an offline queue —
    // and only what began after the switch is dropped, which is all a
    // stale agent can add.
    const { activityTrackingEnabled } =
      await this.organisationsService.getCaptureSettings(
        organisationId,
        userId,
      );
    const offSince = membership.activityTrackingOffSince;
    const accepted = activityTrackingEnabled
      ? samples
      : offSince
        ? samples.filter((sample) => new Date(sample.periodStart) < offSince)
        : [];
    if (accepted.length === 0) {
      return;
    }

    await this.activitySamples.save(
      accepted.map((sample) =>
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
