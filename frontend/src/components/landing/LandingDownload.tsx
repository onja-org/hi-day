import type { Icon } from "@phosphor-icons/react";
import { AppleLogo, LinuxLogo, WindowsLogo } from "@phosphor-icons/react/dist/ssr";
import clsx from "clsx";

// Points at the separate *public* releases repo, not this app's (private)
// source repo — GitHub never serves release assets from a private repo to
// unauthenticated users, so public download links have to live somewhere
// public. See .github/workflows/desktop-build.yml's publish job.
//
// electron-builder's artifactName (desktop/electron-builder.yml) is
// deliberately version-free, so releases/latest/download/<filename>
// always resolves to the newest release's matching asset — no landing
// page change needed when a new version ships.
const RELEASE_DOWNLOAD_BASE =
  "https://github.com/onja-org/workfoce-monitoring-app-releases/releases/latest/download";

type Download = {
  label: string;
  fileName: string;
};

type Platform = {
  icon: Icon;
  name: string;
  detail: string;
  downloads: Download[];
  /** Rendered under the buttons, for per-platform install gotchas. */
  note?: string;
};

const PLATFORMS: Platform[] = [
  {
    icon: WindowsLogo,
    name: "Windows",
    detail: "Windows 10 and later",
    downloads: [{ label: "Download for Windows", fileName: "hiday-win-x64.exe" }],
  },
  {
    icon: AppleLogo,
    name: "macOS",
    detail: "Apple silicon and Intel",
    downloads: [
      { label: "Apple Silicon (M1/M2/M3)", fileName: "hiday-mac-arm64.dmg" },
      { label: "Intel", fileName: "hiday-mac-x64.dmg" },
    ],
  },
  {
    icon: LinuxLogo,
    name: "Linux",
    detail: "Ubuntu, Pop!_OS, and most Debian-based distros",
    // Neither Linux artifact is double-clickable on a stock modern Ubuntu, so
    // both get spelled out. Ubuntu 23.04+ removed local .deb installation from
    // App Center and ships no gdebi, leaving File Roller as the registered
    // handler — double-clicking a .deb opens it as an *archive*. An AppImage
    // arrives from the browser without its executable bit, so double-clicking
    // that does nothing at all. .deb stays first because `apt install` also
    // resolves the runtime deps and wires up the launcher.
    downloads: [
      { label: "Download .deb package", fileName: "hiday-linux-amd64.deb" },
      { label: "AppImage (portable)", fileName: "hiday-linux-x86_64.AppImage" },
    ],
    note: "Install the .deb with: sudo apt install ./hiday-linux-amd64.deb — double-clicking it opens the archive manager, not an installer. For the AppImage, mark it executable first: chmod +x hiday-linux-x86_64.AppImage",
  },
];

export function LandingDownload() {
  return (
    <section id="download" className="border-b-3 border-ink bg-chalk">
      <div className="mx-auto flex max-w-300 flex-col gap-10 px-6 py-24">
        <div className="flex max-w-190 flex-col gap-3">
          <span className="text-xs font-extrabold tracking-widest text-ink-muted uppercase">Desktop app</span>
          <h2 className="font-display text-heading font-extrabold tracking-heading">Get the desktop app.</h2>
          <p className="text-lg text-ink-muted">Sign in from the app to link your device to your account.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLATFORMS.map((platform) => (
            <div
              key={platform.name}
              className="flex flex-col gap-4 rounded-brand-lg border-4 border-ink bg-white p-7 shadow-hard-lg"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl border-3 border-ink bg-sun">
                <platform.icon size={28} aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-extrabold">{platform.name}</h3>
                <p className="text-ink-muted">{platform.detail}</p>
              </div>
              <div className="mt-auto flex flex-col gap-2.5">
                {platform.downloads.map((download, index) => (
                  <a
                    key={download.fileName}
                    href={`${RELEASE_DOWNLOAD_BASE}/${download.fileName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      "flex h-12 items-center justify-center rounded-brand-sm border-3 border-ink px-4 font-extrabold shadow-hard-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt",
                      index === 0 && "bg-sun",
                      index > 0 && "bg-white",
                    )}
                  >
                    {download.label}
                  </a>
                ))}
              </div>
              {platform.note && <p className="text-xs text-ink-muted">{platform.note}</p>}
            </div>
          ))}
        </div>

        <p className="max-w-190 text-sm text-ink-muted">
          Installers aren&apos;t code-signed yet, so your OS will show a warning the first time you open
          one. On macOS, right-click the app and choose Open; on Windows, click &quot;More info&quot; then
          &quot;Run anyway&quot; on the SmartScreen prompt.
        </p>
      </div>
    </section>
  );
}
