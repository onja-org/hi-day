import { describe, expect, it } from 'vitest';
import { recordingIndicatorFor } from '../recording-indicator';

describe('recordingIndicatorFor', () => {
  it('swaps the tray icon and tooltip on every platform', () => {
    for (const platform of ['win32', 'darwin', 'linux'] as const) {
      expect(recordingIndicatorFor(platform, true).trayIcon).toBe(
        'icon-recording.png',
      );
      expect(recordingIndicatorFor(platform, false).trayIcon).toBe(
        'icon-idle.png',
      );
      expect(recordingIndicatorFor(platform, true).tooltip).toContain(
        'tracking',
      );
    }
  });

  it('badges the taskbar button only on Windows, and only while recording', () => {
    expect(recordingIndicatorFor('win32', true).overlayIcon).toBe(
      'icon-recording.png',
    );
    expect(recordingIndicatorFor('win32', false).overlayIcon).toBeNull();
    expect(recordingIndicatorFor('linux', true).overlayIcon).toBeNull();
  });

  it('badges the dock only on macOS, and clears it when stopped', () => {
    expect(recordingIndicatorFor('darwin', true).dockBadge).toBe('●');
    expect(recordingIndicatorFor('darwin', false).dockBadge).toBe('');
    expect(recordingIndicatorFor('win32', true).dockBadge).toBe('');
  });
});
