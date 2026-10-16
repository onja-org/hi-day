/**
 * A plain mapping, so the per-platform branching is testable: no single
 * Electron API covers all three. Windows badges the taskbar button,
 * macOS the dock, and Linux has only the tray.
 */
export interface RecordingIndicator {
  /** Mirrors the app's own timer button. */
  trayIcon: "icon-idle.png" | "icon-recording.png";
  tooltip: string;
  /** Windows only; null clears it. */
  overlayIcon: "icon-recording.png" | null;
  /** macOS only; empty clears it. */
  dockBadge: string;
}

export function recordingIndicatorFor(
  platform: NodeJS.Platform,
  isRecording: boolean,
): RecordingIndicator {
  return {
    trayIcon: isRecording ? "icon-recording.png" : "icon-idle.png",
    tooltip: isRecording ? "Hi Day — tracking" : "Hi Day — not tracking",
    overlayIcon:
      platform === "win32" && isRecording ? "icon-recording.png" : null,
    dockBadge: platform === "darwin" && isRecording ? "●" : "",
  };
}
