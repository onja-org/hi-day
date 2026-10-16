import { GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { GITHUB_ORG_URL } from "@/lib/marketingLinks";

export function LandingOpenSource() {
  return (
    <section id="open-source" className="border-b-3 border-ink bg-ink text-chalk">
      <div className="mx-auto flex max-w-300 flex-wrap items-center justify-between gap-8 px-6 py-18">
        <div className="flex max-w-155 flex-col gap-3">
          <span className="self-start rounded-full border-3 border-ink bg-sun px-3.5 py-1.5 text-xs font-extrabold tracking-widest text-ink uppercase">
            Open source
          </span>
          <h2 className="font-display text-heading font-extrabold tracking-heading">Run it yourself, free.</h2>
          <p className="text-lg text-ink-soft">
            Hi Day is open source. Host it on your own servers at no cost, and anyone (your team, IT
            people or funders) can check exactly what it records.
          </p>
        </div>
        <a
          href={GITHUB_ORG_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-14.5 items-center gap-2 rounded-brand-sm border-3 border-ink bg-sun px-7 text-lg font-extrabold text-ink shadow-hard transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt-light"
        >
          <GithubLogoIcon size={22} weight="fill" aria-hidden="true" />
          Star on GitHub
        </a>
      </div>
    </section>
  );
}
