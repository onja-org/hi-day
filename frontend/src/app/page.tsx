import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    <div className="min-h-full bg-chalk font-brand text-ink">
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
