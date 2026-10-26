import { DesktopDownloadCards } from "@/components/DesktopDownloadCards";

export function LandingDownload() {
  return (
    <section id="download" className="border-b-3 border-ink bg-chalk">
      <div className="mx-auto flex max-w-300 flex-col gap-10 px-6 py-24">
        <div className="flex max-w-190 flex-col gap-3">
          <span className="text-xs font-extrabold tracking-widest text-ink-muted uppercase">Desktop app</span>
          <h2 className="font-display text-heading font-extrabold tracking-heading">Get the desktop app.</h2>
          <p className="text-lg text-ink-muted">Sign in from the app to link your device to your account.</p>
        </div>

        <DesktopDownloadCards />
      </div>
    </section>
  );
}
