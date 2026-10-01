import { SetMetadata } from '@nestjs/common';

export const ALLOW_SUSPENDED_ORGANISATION_KEY = 'allowSuspendedOrganisation';

/**
 * Lets a route through RoleGuard even while the organisation is suspended
 * pending deletion. Only the routes the owner needs to see the state and
 * restore the account should carry this.
 */
export const AllowSuspendedOrganisation = () =>
  SetMetadata(ALLOW_SUSPENDED_ORGANISATION_KEY, true);
