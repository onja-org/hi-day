import type { Metadata } from "next";
import { DesktopDownloadCards } from "@/components/DesktopDownloadCards";

export const metadata: Metadata = {
  title: "Download the desktop app",
};

// The marketing site's download section (/pricing#download) redirects
// signed-in visitors to their dashboard, so this is where they get the
// installers without logging out first.
export default function DownloadPage() {
  return (
    <main className="container flex flex-col gap-8 py-8">
      <div className="animate-fade-in-up flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-primary-dark">
          Download the desktop app
        </h1>
        <p className="text-ink-muted">
          Sign in from the app to link your device to your account.
        </p>
      </div>

      <div className="animate-fade-in-up-delay flex flex-col gap-8">
        <DesktopDownloadCards />
      </div>
    </main>
  );
}
