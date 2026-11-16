/**
 * How much keyboard and mouse input a stretch of tracked time saw — counts
 * only, never which keys, what was typed or where the mouse was. `null`
 * wherever they're used means "not available" (Linux on Wayland, macOS
 * without the permission, a hook blocked by antivirus, an older desktop
 * app), never 0.
 */
export type InputCounts = {
  keystrokes: number;
  mouseClicks: number;
  /** Distance the pointer travelled, in screen pixels. */
  mouseMovement: number;
};
