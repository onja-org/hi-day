import type { Metadata } from "next";
import localFont from "next/font/local";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingDownload } from "@/components/landing/LandingDownload";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingIndustries } from "@/components/landing/LandingIndustries";
import { LandingTools } from "@/components/landing/LandingTools";
import { LandingTransparency } from "@/components/landing/LandingTransparency";
import { isAuthenticated } from "@/lib/isAuthenticated";

// The Hi Day brand faces, self-hosted (latin subset) like Roboto in the root
// layout. Only the landing page uses them — the app keeps Roboto.
const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-Variable.woff2",
  variable: "--font-bricolage",
  weight: "400 800",
  display: "swap",
});
const figtree = localFont({
  src: "./fonts/Figtree-Variable.woff2",
  variable: "--font-figtree",
  weight: "400 800",
  display: "swap",
});
const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-jetbrains-mono",
  weight: "500 700",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute: the landing page's title already leads with the product name.
  title: { absolute: "Hi Day — Time tracking that says hi, not gotcha" },
  description:
    "Track time, projects and activity in the desktop app and on the web. Your team sees exactly what managers see, so nobody wonders what's being counted.",
};

export default async function Home() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <div
      className={clsx(
        bricolage.variable,
        figtree.variable,
        jetbrainsMono.variable,
        "min-h-full bg-chalk font-brand text-ink",
      )}
    >
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingTransparency />
        <LandingTools />
        <LandingIndustries />
        <LandingDownload />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
