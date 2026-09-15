import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { DeviceAuthenticatedRequest } from '../../devices/device-session.guard';
import { DisclosureService } from '../services/disclosure.service';

const CONSENT_REQUIRED_MESSAGE =
  'This device has not consented to the current disclosure text — capture is blocked until it does.';

/**
 * Chained after DeviceSessionGuard (which populates
 * request.deviceId/organisationId/userId), and applied per-route only to
 * the three capture-ingest endpoints on DeviceTrackingController
 * (app-events, activity-samples, screenshots/upload-url) — see
 * docs/adr/0014-.... This is the actual enforcement; the desktop agent's
 * own consent screen is UX built on top of it, not a substitute for it.
 */
@Injectable()
export class DeviceConsentGuard implements CanActivate {
  constructor(private readonly disclosureService: DisclosureService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<DeviceAuthenticatedRequest>();

    const membership = await this.disclosureService.resolveActiveMembership(
      request.organisationId,
      request.userId,
    );

    const satisfied = await this.disclosureService.isCaptureConsentSatisfied(
      request.organisationId,
      membership.disclosureRegion,
      request.deviceId,
    );

    if (!satisfied) {
      throw new ForbiddenException(CONSENT_REQUIRED_MESSAGE);
    }

    return true;
  }
}
