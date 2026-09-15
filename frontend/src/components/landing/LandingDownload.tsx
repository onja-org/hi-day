import type { Icon } from "@phosphor-icons/react";
import { AppleLogo, LinuxLogo, WindowsLogo } from "@phosphor-icons/react/dist/ssr";
import { ScrollReveal } from "../ScrollReveal";

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
    downloads: [{ label: "Download for Windows", fileName: "workforce-monitor-win-x64.exe" }],
  },
  {
    icon: AppleLogo,
    name: "macOS",
    detail: "Apple silicon and Intel",
    downloads: [
      { label: "Apple Silicon (M1/M2/M3)", fileName: "workforce-monitor-mac-arm64.dmg" },
      { label: "Intel", fileName: "workforce-monitor-mac-x64.dmg" },
    ],
  },
  {
    icon: LinuxLogo,
    name: "Linux",
    detail: "Ubuntu, Pop!_OS, and most Debian-based distros",
    // .deb first, deliberately: double-clicking it opens the distro's software
    // installer and Just Works. An AppImage arrives from the browser without the
    // executable bit set, so double-clicking it silently does nothing until the
    // user chmod +x's it — a dead end for anyone who doesn't already know
    // that, hence the note below.
    downloads: [
      { label: "Download .deb package", fileName: "workforce-monitor-linux-amd64.deb" },
      { label: "AppImage (portable)", fileName: "workforce-monitor-linux-x86_64.AppImage" },
    ],
    note: "Using the AppImage? Mark it executable first — right-click it, choose Properties, and tick “Allow executing file as program” (or run chmod +x on it).",
  },
];

export function LandingDownload() {
  return (
    <section id="download" className="bg-cream py-20 lg:py-28">
      <div className="container">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold text-primary-dark sm:text-4xl">
            Get the desktop app
          </h2>
          <p className="mt-4 text-lg text-slate-900">
            Sign in from the app to link your device to your account.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {PLATFORMS.map((platform) => (
            <ScrollReveal key={platform.name}>
              <div className="flex h-full flex-col items-center gap-4 rounded-xl border border-primary-dark/10 bg-white p-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-cream text-primary-dark">
                  <platform.icon size={24} aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold text-primary-dark">
                  {platform.name}
                </h3>
                <p className="text-sm text-slate-900">{platform.detail}</p>

                <div className="mt-2 flex w-full flex-col gap-2">
                  {platform.downloads.map((download, index) => (
                    <a
                      key={download.fileName}
                      href={`${RELEASE_DOWNLOAD_BASE}/${download.fileName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        index === 0
                          ? "cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary/90"
                          : "cursor-pointer rounded-md border border-primary-dark/20 px-4 py-2 text-sm font-medium text-primary-dark transition-colors duration-150 hover:bg-cream"
                      }
                    >
                      {download.label}
                    </a>
                  ))}
                </div>

                {platform.note ? (
                  <p className="mt-1 text-xs text-slate-900/70">{platform.note}</p>
                ) : null}
              </div>
            </ScrollReveal>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-900/70">
          Installers aren&apos;t code-signed yet, so your OS will show a warning
          the first time you open one — on macOS, right-click the app and
          choose Open; on Windows, click &quot;More info&quot; then &quot;Run
          anyway&quot; on the SmartScreen prompt.
        </p>
      </div>
    </section>
  );
}
