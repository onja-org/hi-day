import { readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dbus from 'dbus-next';
import { nativeImage } from 'electron';

const PORTAL_BUS_NAME = 'org.freedesktop.portal.Desktop';
const PORTAL_PATH = '/org/freedesktop/portal/desktop';
const SCREENSHOT_IFACE = 'org.freedesktop.portal.Screenshot';
const REQUEST_IFACE = 'org.freedesktop.portal.Request';
const DBUS_IFACE = 'org.freedesktop.DBus';

// Matches screenshot-sampler.ts's own captureScreen() — keeps uploads small
// without visibly degrading legibility, and, more importantly here, keeps
// every capture source uploading the same format: the backend's presigned
// PUT always sends `Content-Type: image/jpeg` (api-client.ts), but the
// portal itself always writes PNG.
const SCREENSHOT_JPEG_QUALITY = 70;

// Generous enough to cover the one-time interactive grant dialog (a person
// noticing and clicking through it), not just the silent per-tick path.
const PORTAL_RESPONSE_TIMEOUT_MS = 30_000;

/**
 * Calls the xdg-desktop-portal Screenshot interface directly over D-Bus —
 * Electron's `desktopCapturer` never exposes this portal, only ScreenCast
 * (see screenshot-sampler.ts's Wayland guard for why that one is never used
 * for periodic capture). Unlike ScreenCast, there's no live stream/session
 * to cancel out from under here — just one request/response — so this
 * doesn't share ScreenCast's crash-on-cancel failure mode.
 *
 * `interactive: false` reuses whatever grant an earlier `interactive: true`
 * call already obtained (backed by the portal's own permission store) and
 * returns silently — verified live against a real GNOME/Wayland session: a
 * fresh `interactive: false` call captured a new screenshot with no dialog
 * at all, immediately after one prior `interactive: true` call had been
 * approved once. `screenshot-sampler.ts` only ever calls this with
 * `interactive: false` from its periodic tick; `interactive: true` is only
 * ever triggered by an explicit "Grant Access" click, same rule the
 * existing macOS Screen Recording prompt already follows.
 *
 * Returns null on any failure (denied, timed out, no portal running, a
 * compositor that doesn't remember the grant) — the same "nothing to
 * report" contract `captureScreen` (X11/macOS, in screenshot-sampler.ts)
 * already has.
 */
export async function captureScreenViaPortal(
  interactive: boolean,
): Promise<Buffer | null> {
  const bus = dbus.sessionBus();
  try {
    const callReply = await bus.call(
      new dbus.Message({
        destination: PORTAL_BUS_NAME,
        path: PORTAL_PATH,
        interface: SCREENSHOT_IFACE,
        member: 'Screenshot',
        signature: 'sa{sv}',
        body: ['', { interactive: new dbus.Variant('b', interactive) }],
      }),
    );
    const [requestPath] = (callReply?.body ?? []) as [string?];
    if (!requestPath) return null;

    const uri = await waitForScreenshotUri(bus, requestPath);
    if (!uri) return null;

    return await readAndDeletePortalFile(uri);
  } catch {
    return null;
  } finally {
    bus.disconnect();
  }
}

/**
 * The `Screenshot` call only returns a `Request` object path — the actual
 * result arrives as a `Response` signal on that object once the person
 * responds to the dialog (or, non-interactively, once the portal decides).
 * `AddMatch` is required first: like AT-SPI2 (see resolvers/linux/atspi.ts),
 * this connection receives no signals at all until it explicitly subscribes.
 */
function waitForScreenshotUri(
  bus: dbus.MessageBus,
  requestPath: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => finish(null), PORTAL_RESPONSE_TIMEOUT_MS);

    function finish(value: string | null): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      bus.removeListener('message', onMessage);
      resolve(value);
    }

    function onMessage(message: dbus.Message): void {
      if (
        message.type !== dbus.MessageType.SIGNAL ||
        message.interface !== REQUEST_IFACE ||
        message.member !== 'Response' ||
        message.path !== requestPath
      ) {
        return;
      }
      const [code, results] = (message.body ?? []) as [
        number,
        Record<string, { value?: unknown }>?,
      ];
      finish(code === 0 ? ((results?.uri?.value as string) ?? null) : null);
    }

    bus.on('message', onMessage);

    void bus
      .call(
        new dbus.Message({
          destination: DBUS_IFACE,
          path: '/org/freedesktop/DBus',
          interface: DBUS_IFACE,
          member: 'AddMatch',
          signature: 's',
          body: [
            `type='signal',interface='${REQUEST_IFACE}',member='Response',path='${requestPath}'`,
          ],
        }),
      )
      .catch(() => finish(null));
  });
}

/**
 * The portal writes the capture to a real file (under the caller's own
 * `~/Pictures` on GNOME, verified live) rather than handing back bytes
 * directly, and expects the caller to clean it up — it isn't a temp file
 * the portal removes itself. Always a PNG (verified live) regardless of
 * `interactive`, so it's re-encoded to JPEG here — see
 * `SCREENSHOT_JPEG_QUALITY`'s comment for why that matters.
 */
async function readAndDeletePortalFile(uri: string): Promise<Buffer | null> {
  if (!uri.startsWith('file://')) return null;
  try {
    const path = fileURLToPath(uri);
    const pngBuffer = await readFile(path);
    void unlink(path).catch(() => {});

    const image = nativeImage.createFromBuffer(pngBuffer);
    if (image.isEmpty()) return null;
    return image.toJPEG(SCREENSHOT_JPEG_QUALITY);
  } catch {
    return null;
  }
}
