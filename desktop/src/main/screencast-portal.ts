import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import dbus from 'dbus-next';
import { pngToJpeg } from './screenshot-portal';

const PORTAL_BUS_NAME = 'org.freedesktop.portal.Desktop';
const PORTAL_PATH = '/org/freedesktop/portal/desktop';
const SCREENCAST_IFACE = 'org.freedesktop.portal.ScreenCast';
const REQUEST_IFACE = 'org.freedesktop.portal.Request';
const SESSION_IFACE = 'org.freedesktop.portal.Session';
const PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties';
const DBUS_IFACE = 'org.freedesktop.DBus';

/** `persist_mode` and `restore_token` arrived in version 4 of the interface. */
const MIN_SCREENCAST_VERSION = 4;
const SOURCE_TYPE_MONITOR = 1;
/** Persist "until explicitly revoked", not just for this app run. */
const PERSIST_MODE_PERMANENT = 2;

/** Covers a person reading and clicking through the one-time picker. */
const INTERACTIVE_RESPONSE_TIMEOUT_MS = 60_000;
/**
 * A valid restore token answers in well under a second. When the portal
 * rejects the token (a monitor unplugged, the grant revoked) it shows the
 * picker instead, and on a periodic tick nobody asked for that — so a
 * silent call that hasn't answered by now has its request closed, which
 * takes the picker down with it.
 */
const SILENT_RESPONSE_TIMEOUT_MS = 3_000;
/** Plain method-call steps (CreateSession, SelectSources) never show UI. */
const STEP_RESPONSE_TIMEOUT_MS = 10_000;
const FRAME_GRAB_TIMEOUT_MS = 10_000;

export type ScreenCastOutcome =
  /** `restoreToken` is null when the person declined to have it remembered. */
  | { kind: 'captured'; buffer: Buffer; restoreToken: string | null }
  /** The person dismissed the picker. */
  | { kind: 'cancelled' }
  /** The restore token no longer works; it must not be used again. */
  | { kind: 'token-rejected' }
  /** No ScreenCast portal, or one too old to remember a grant. */
  | { kind: 'unavailable' }
  /**
   * Anything else. A session that got as far as starting still hands out a
   * fresh token (tokens are single-use), so it's carried here to be kept.
   */
  | { kind: 'failed'; restoreToken?: string | null };

type PortalResponse = { code: number; results: Record<string, { value?: unknown }> };

/**
 * Captures one frame through the xdg-desktop-portal ScreenCast interface,
 * not the Screenshot one (screenshot-portal.ts). On GNOME the Screenshot
 * portal always goes through GNOME Shell's screenshot service with its
 * flash turned on, which plays the camera-shutter sound and flashes the
 * screen on every tick — and it offers no option to turn either off.
 * ScreenCast does neither: GNOME only shows its screen-sharing indicator in
 * the top bar for the second the session is open.
 *
 * - `restoreToken` null: shows the portal's picker (only ever from an
 *   explicit "Grant Access" click) and asks for the choice to be remembered.
 * - `restoreToken` set: reuses that remembered choice with no picker. Every
 *   call hands back a token to store in place of the old one — GNOME returns
 *   the same one, but the interface permits a backend to rotate it.
 *
 * Not `desktopCapturer`: under Wayland that also goes through ScreenCast,
 * but Chromium never keeps a restore token, so it shows the picker on every
 * call (see screenshot-sampler.ts's Wayland guard).
 *
 * The frame itself comes out of PipeWire via GStreamer's `pipewiresrc`
 * (see `grabFrame`), so it needs `gst-launch-1.0` and the PipeWire
 * GStreamer plugin on the machine — `canGrabScreenCastFrames()` checks for
 * both, and callers keep the Screenshot portal as the fallback.
 */
export async function captureScreenViaScreenCast(
  restoreToken: string | null,
): Promise<ScreenCastOutcome> {
  const interactive = restoreToken === null;
  const bus = dbus.sessionBus();
  const responses = new PortalResponses(bus);
  let sessionHandle: string | null = null;
  try {
    await responses.subscribe();

    if ((await screenCastVersion(bus)) < MIN_SCREENCAST_VERSION) {
      return { kind: 'unavailable' };
    }

    const created = await responses.request(
      portalCall('CreateSession', 'a{sv}', [
        {
          handle_token: new dbus.Variant('s', token()),
          session_handle_token: new dbus.Variant('s', token()),
        },
      ]),
      STEP_RESPONSE_TIMEOUT_MS,
    );
    if (!created || created.code !== 0) return { kind: 'failed' };
    sessionHandle = (created.results.session_handle?.value as string) ?? null;
    if (!sessionHandle) return { kind: 'failed' };

    const selectOptions: Record<string, dbus.Variant> = {
      handle_token: new dbus.Variant('s', token()),
      types: new dbus.Variant('u', SOURCE_TYPE_MONITOR),
      multiple: new dbus.Variant('b', false),
      persist_mode: new dbus.Variant('u', PERSIST_MODE_PERMANENT),
    };
    if (restoreToken) {
      selectOptions.restore_token = new dbus.Variant('s', restoreToken);
    }
    const selected = await responses.request(
      portalCall('SelectSources', 'oa{sv}', [sessionHandle, selectOptions]),
      STEP_RESPONSE_TIMEOUT_MS,
    );
    if (!selected || selected.code !== 0) return { kind: 'failed' };

    const started = await responses.request(
      portalCall('Start', 'osa{sv}', [
        sessionHandle,
        '',
        { handle_token: new dbus.Variant('s', token()) },
      ]),
      interactive ? INTERACTIVE_RESPONSE_TIMEOUT_MS : SILENT_RESPONSE_TIMEOUT_MS,
    );
    if (!started || started.code !== 0) {
      if (!interactive) return { kind: 'token-rejected' };
      // 1 is the person dismissing the picker; a timeout is treated the same.
      return !started || started.code === 1
        ? { kind: 'cancelled' }
        : { kind: 'failed' };
    }

    const newToken = (started.results.restore_token?.value as string) ?? null;
    const streams = (started.results.streams?.value ?? []) as [number, unknown][];
    const nodeId = streams[0]?.[0];
    if (typeof nodeId !== 'number') {
      return { kind: 'failed', restoreToken: newToken };
    }

    const buffer = await grabFrame(nodeId);
    if (!buffer) return { kind: 'failed', restoreToken: newToken };
    return { kind: 'captured', buffer, restoreToken: newToken };
  } catch {
    return { kind: 'failed' };
  } finally {
    if (sessionHandle) {
      await bus
        .call(
          new dbus.Message({
            destination: PORTAL_BUS_NAME,
            path: sessionHandle,
            interface: SESSION_IFACE,
            member: 'Close',
          }),
        )
        .catch(() => {});
    }
    responses.dispose();
    bus.disconnect();
  }
}

let frameGrabberAvailable: Promise<boolean> | null = null;

/**
 * Whether `gst-launch-1.0` and the PipeWire GStreamer plugin are installed.
 * Checked once per run: without them a ScreenCast session would open (and
 * show GNOME's sharing indicator) only to produce nothing.
 */
export function canGrabScreenCastFrames(): Promise<boolean> {
  frameGrabberAvailable ??= run('gst-inspect-1.0', ['--exists', 'pipewiresrc'], 5_000);
  return frameGrabberAvailable;
}

let silentCaptureAvailable: Promise<boolean> | null = null;

/**
 * Whether the silent path is possible here at all — frame grabber installed
 * *and* a portal new enough to remember a grant. Asked once; neither can
 * change while the app runs. Distinct from "has a grant": main.ts needs to
 * know whether asking is even worth it before letting the noisy grant stand.
 */
export function isSilentScreenCastAvailable(): Promise<boolean> {
  silentCaptureAvailable ??= (async () => {
    if (!(await canGrabScreenCastFrames())) return false;
    const bus = dbus.sessionBus();
    try {
      return (await screenCastVersion(bus)) >= MIN_SCREENCAST_VERSION;
    } catch {
      return false;
    } finally {
      bus.disconnect();
    }
  })();
  return silentCaptureAvailable;
}

/**
 * Pulls a single frame off the PipeWire node the portal just opened. The
 * node is reached by id rather than through the portal's own PipeWire fd:
 * this app isn't sandboxed, so PipeWire already lets it see the node, and
 * it avoids D-Bus fd passing, which dbus-next only supports through an
 * optional native module. `pngenc` sends end-of-stream after its first
 * frame (its `snapshot` default), so the pipeline stops by itself.
 */
async function grabFrame(nodeId: number): Promise<Buffer | null> {
  const dir = await mkdtemp(join(tmpdir(), 'hiday-screencast-'));
  const file = join(dir, 'frame.png');
  try {
    const ok = await run(
      'gst-launch-1.0',
      [
        '-q',
        'pipewiresrc',
        `path=${nodeId}`,
        'always-copy=true',
        '!',
        'videoconvert',
        '!',
        'pngenc',
        'snapshot=true',
        '!',
        'filesink',
        `location=${file}`,
      ],
      FRAME_GRAB_TIMEOUT_MS,
    );
    if (!ok) return null;
    return pngToJpeg(await readFile(file));
  } catch {
    return null;
  } finally {
    void rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Resolves true on exit code 0; false on any failure, missing binary or timeout. */
function run(command: string, args: string[], timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(false);
    }, timeoutMs);
    child.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

async function screenCastVersion(bus: dbus.MessageBus): Promise<number> {
  try {
    const reply = await bus.call(
      new dbus.Message({
        destination: PORTAL_BUS_NAME,
        path: PORTAL_PATH,
        interface: PROPERTIES_IFACE,
        member: 'Get',
        signature: 'ss',
        body: [SCREENCAST_IFACE, 'version'],
      }),
    );
    const [variant] = (reply?.body ?? []) as [{ value?: unknown }?];
    return typeof variant?.value === 'number' ? variant.value : 0;
  } catch {
    return 0;
  }
}

function portalCall(member: string, signature: string, body: unknown[]): dbus.Message {
  return new dbus.Message({
    destination: PORTAL_BUS_NAME,
    path: PORTAL_PATH,
    interface: SCREENCAST_IFACE,
    member,
    signature,
    body,
  });
}

function token(): string {
  return `hiday_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Every portal method returns a Request object path at once and answers
 * later with a `Response` signal on it. CreateSession and SelectSources can
 * answer before the reply carrying that path has even been read, so this
 * subscribes to every Response up front and keeps the ones nobody is
 * waiting for yet — not one `AddMatch` per path after the fact, which
 * would miss an early answer.
 */
class PortalResponses {
  private readonly arrived = new Map<string, PortalResponse>();
  private readonly waiting = new Map<string, (response: PortalResponse) => void>();
  private readonly onMessage = (message: dbus.Message): void => {
    if (
      message.type !== dbus.MessageType.SIGNAL ||
      message.interface !== REQUEST_IFACE ||
      message.member !== 'Response' ||
      !message.path
    ) {
      return;
    }
    const [code, results] = (message.body ?? []) as [
      number,
      Record<string, { value?: unknown }>?,
    ];
    const response = { code, results: results ?? {} };
    const resolve = this.waiting.get(message.path);
    if (resolve) resolve(response);
    else this.arrived.set(message.path, response);
  };

  constructor(private readonly bus: dbus.MessageBus) {
    bus.on('message', this.onMessage);
  }

  async subscribe(): Promise<void> {
    await this.bus.call(
      new dbus.Message({
        destination: DBUS_IFACE,
        path: '/org/freedesktop/DBus',
        interface: DBUS_IFACE,
        member: 'AddMatch',
        signature: 's',
        body: [`type='signal',interface='${REQUEST_IFACE}',member='Response'`],
      }),
    );
  }

  /**
   * Null on timeout — after closing the request, which dismisses any
   * dialog the portal had put up for it.
   */
  async request(call: dbus.Message, timeoutMs: number): Promise<PortalResponse | null> {
    const reply = await this.bus.call(call);
    const [requestPath] = (reply?.body ?? []) as [string?];
    if (!requestPath) return null;

    const early = this.arrived.get(requestPath);
    if (early) {
      this.arrived.delete(requestPath);
      return early;
    }

    const response = await new Promise<PortalResponse | null>((resolve) => {
      const timer = setTimeout(() => {
        this.waiting.delete(requestPath);
        resolve(null);
      }, timeoutMs);
      this.waiting.set(requestPath, (r) => {
        clearTimeout(timer);
        this.waiting.delete(requestPath);
        resolve(r);
      });
    });
    if (!response) {
      await this.bus
        .call(
          new dbus.Message({
            destination: PORTAL_BUS_NAME,
            path: requestPath,
            interface: REQUEST_IFACE,
            member: 'Close',
          }),
        )
        .catch(() => {});
    }
    return response;
  }

  dispose(): void {
    this.bus.removeListener('message', this.onMessage);
  }
}
