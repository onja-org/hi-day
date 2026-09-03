import type { Icon } from "@phosphor-icons/react";
import { AppleLogo, LinuxLogo, WindowsLogo } from "@phosphor-icons/react/dist/ssr";
import { ScrollReveal } from "../ScrollReveal";

type Platform = {
  icon: Icon;
  name: string;
  detail: string;
};

const PLATFORMS: Platform[] = [
  { icon: WindowsLogo, name: "Windows", detail: "Windows 10 and later" },
  { icon: AppleLogo, name: "macOS", detail: "Apple silicon and Intel" },
  {
    icon: LinuxLogo,
    name: "Linux",
    detail: "Ubuntu, Pop!_OS, and most Debian-based distros",
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
            Installers for every platform are on the way.
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
                <span
                  aria-disabled="true"
                  className="mt-2 cursor-not-allowed rounded-md border border-primary-dark/20 px-4 py-2 text-sm font-medium text-slate-900/60"
                >
                  Coming soon
                </span>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
