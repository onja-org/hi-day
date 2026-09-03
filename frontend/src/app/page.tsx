import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingRoles } from "@/components/landing/LandingRoles";
import { isAuthenticated } from "@/lib/isAuthenticated";

export const metadata: Metadata = {
  title: "Workforce Monitoring — Time & activity tracking for your team",
  description:
    "Timesheets, activity, teams, and role-based permissions in one dashboard. Set up your organisation and invite your team in minutes.",
};

export default async function Home() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <>
      <Header />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingRoles />
        <LandingCta />
      </main>
      <LandingFooter />
    </>
  );
}
