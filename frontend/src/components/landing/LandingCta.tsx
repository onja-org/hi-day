import Link from "next/link";
import { ScrollReveal } from "../ScrollReveal";

export function LandingCta() {
  return (
    <section
      id="get-started"
      className="relative overflow-hidden bg-primary-dark py-20 lg:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 right-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl motion-safe:animate-float"
      />

      <div className="container relative">
        <ScrollReveal className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">
            Ready to see where the hours go?
          </h2>
          <p className="text-lg text-white/80">
            Set up your organisation, invite your team, and get visibility
            into time and activity today.
          </p>
          <Link
            href="/signup"
            className="cursor-pointer rounded-md bg-white px-6 py-3 font-medium text-primary-dark transition-colors duration-150 hover:bg-cream"
          >
            Get started free
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
