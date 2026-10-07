import { EyeIcon, ProhibitIcon, UsersIcon } from "@phosphor-icons/react/dist/ssr";
import { LandingTransparencyCard } from "./LandingTransparencyCard";

// Matches the product's defaults: app/website tracking and activity level
// are on but only while the timer runs, screenshots are off until an admin
// enables them, and idle time is flagged rather than removed (see
// backend/src/organisations/capture-settings.ts and idle-policy.ts).
export function LandingTransparency() {
  return (
    <section id="monitoring" className="border-b-3 border-ink bg-sun">
      <div className="mx-auto flex max-w-300 flex-col gap-10 px-6 py-24">
        <div className="flex max-w-190 flex-col gap-3">
          <span className="text-xs font-extrabold tracking-widest uppercase">Straight talk</span>
          <h2 className="font-display text-heading font-extrabold tracking-heading">
            Yes, it&apos;s monitoring. Here&apos;s exactly how much.
          </h2>
          <p className="text-lg">
            We know monitoring isn&apos;t everyone&apos;s favourite topic, but we also know it helps.
            Hi Day gives managers what they need without getting in people&apos;s way. This is
            what&apos;s recorded, what isn&apos;t, and who gets to see it.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <LandingTransparencyCard
            icon={EyeIcon}
            tone="volt"
            title="What's recorded"
            items={[
              "Time on the timer",
              "Which apps and websites are in use, while the timer runs",
              "How active each stretch of time was, never what you type",
              "Screenshots, only if your team switches them on",
            ]}
          />
          <LandingTransparencyCard
            icon={ProhibitIcon}
            tone="mint"
            title="What isn't"
            items={["Anything while the timer is off", "The words you type", "Your camera or microphone"]}
          />
          <LandingTransparencyCard
            icon={UsersIcon}
            tone="bubble"
            title="Who sees it"
            items={[
              "You see everything recorded about you",
              "Your manager sees the same, no more",
              "Pause any time; idle time is flagged, not deleted",
              "Admins can publish a plain-language notice the app shows you",
            ]}
          />
        </div>
      </div>
    </section>
  );
}
