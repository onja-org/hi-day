import { describe, expect, it } from 'vitest';
import { PERMISSION_COPY, SETTINGS_DEEP_LINKS, type SettingsPane } from '../permission-copy';

const PANES: SettingsPane[] = ['automation', 'accessibility', 'screenRecording'];

describe('permission-copy', () => {
  it('has a deep link and copy entry for every settings pane', () => {
    for (const pane of PANES) {
      expect(SETTINGS_DEEP_LINKS[pane]).toMatch(/^x-apple\.systempreferences:/);
      expect(PERMISSION_COPY[pane].title.length).toBeGreaterThan(0);
      expect(PERMISSION_COPY[pane].unlocks.length).toBeGreaterThan(0);
    }
  });

  it('copy never mentions raw API/entitlement names', () => {
    const forbidden = ['AXIsProcessTrusted', 'NSAppleEventsUsageDescription', 'TCC', 'entitlement'];
    for (const pane of PANES) {
      const text = `${PERMISSION_COPY[pane].title} ${PERMISSION_COPY[pane].unlocks} ${PERMISSION_COPY[pane].deniedGuidance}`;
      for (const term of forbidden) {
        expect(text).not.toContain(term);
      }
    }
  });
});
