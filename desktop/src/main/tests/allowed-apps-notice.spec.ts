import { describe, expect, it } from 'vitest';
import { allowedAppsNotice } from '../allowed-apps-notice';

describe('allowedAppsNotice', () => {
  it('says nothing while this agent may track', () => {
    expect(allowedAppsNotice('all')).toBeNull();
    expect(allowedAppsNotice('desktop_only')).toBeNull();
  });

  it('explains the stop when tracking moved to mobile', () => {
    expect(allowedAppsNotice('mobile_only')).toContain('mobile app');
  });
});
