import Image from "next/image";
import Link from "next/link";
import { LandingButtonLink } from "./LandingButtonLink";

// Anchors into the landing page's own sections.
const SECTIONS = [
  { href: "#features", label: "Features" },
  { href: "#monitoring", label: "What's tracked" },
  { href: "#industries", label: "Who it's for" },
  { href: "#download", label: "Download" },
];

export function LandingHeader() {
  return (
    <header className="border-b-3 border-ink bg-chalk">
      <div className="mx-auto flex max-w-300 flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          aria-label="Hi Day home"
          className="flex items-center gap-2.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt"
        >
          <Image src="/brand/hiday-mark-sun.svg" alt="" width={36} height={36} preload />
          <Image src="/brand/hiday-wordmark-ink.svg" alt="" width={77} height={32} preload />
        </Link>

        <nav aria-label="Page sections" className="hidden flex-wrap gap-x-6 gap-y-1 font-bold md:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="hover:text-volt focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-2 py-2.5 font-bold hover:text-volt focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt"
          >
            Log in
          </Link>
          <LandingButtonLink href="/signup" size="md">
            Get started
          </LandingButtonLink>
        </div>
      </div>
    </header>
  );
}
