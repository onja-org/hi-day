import { LandingButtonLink } from "./LandingButtonLink";

export function LandingCta() {
  return (
    <section className="relative overflow-hidden border-b-3 border-ink bg-volt text-chalk">
      <div
        aria-hidden="true"
        className="absolute right-6 bottom-0 hidden h-45 w-90 rounded-t-full border-4 border-b-0 border-ink bg-sun md:block lg:right-24"
      />
      <div className="relative mx-auto flex max-w-300 flex-col items-start gap-6 px-6 pt-26 pb-30">
        <h2 className="max-w-190 font-display text-closing font-extrabold tracking-tighter">
          Say hi to your best week.
        </h2>
        <p className="max-w-xl text-lg">Set up in minutes. Invite your team, pick what&apos;s tracked and you&apos;re off.</p>
        <div className="flex flex-wrap gap-3.5">
          <LandingButtonLink href="/signup">Get started</LandingButtonLink>
          <LandingButtonLink href="/login" tone="chalk">
            Log in
          </LandingButtonLink>
        </div>
      </div>
    </section>
  );
}
