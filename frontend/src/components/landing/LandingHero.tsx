import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { LandingDashboardPreview } from "./LandingDashboardPreview";
import { ScrollReveal } from "../ScrollReveal";

export function LandingHero() {
  return (
    <section id="hero" className="relative overflow-hidden bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl motion-safe:animate-float"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-secondary/20 blur-3xl motion-safe:animate-float-slow"
      />

      <div className="container relative grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-cream px-4 py-1.5 text-sm font-medium text-primary-dark">
            <Sparkle size={16} aria-hidden="true" />
            Built for growing teams
          </span>

          <h1 className="text-4xl font-semibold text-balance text-primary-dark sm:text-5xl lg:text-6xl">
            Know where every hour goes, without the guesswork.
          </h1>

          <p className="max-w-xl text-lg text-slate-900">
            Workforce Monitoring brings timesheets, activity, teams, and
            permissions into one dashboard — so admins and managers always
            know how their organisation is spending its time.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="cursor-pointer rounded-md bg-primary px-6 py-3 font-medium text-white transition-colors duration-150 hover:bg-primary/90"
            >
              Get started free
            </Link>
            <a
              href="#how-it-works"
              className="cursor-pointer rounded-md border border-primary-dark/20 px-6 py-3 font-medium text-primary-dark transition-colors duration-150 hover:bg-cream"
            >
              See how it works
            </a>
          </div>

          <p className="text-sm text-slate-900/60">
            No credit card required · Set up your organisation in minutes
          </p>
        </div>

        <ScrollReveal>
          <LandingDashboardPreview />
        </ScrollReveal>
      </div>
    </section>
  );
}
