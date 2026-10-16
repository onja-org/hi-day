import Image from "next/image";
import Link from "next/link";
import { GITHUB_ORG_URL } from "@/lib/marketingLinks";

type FooterLink = { label: string; href: string; external?: boolean };

/** Shared across the marketing pages; `current` fixes up the section
 * anchors so they still resolve from the pricing page. */
export function LandingFooter({ current = "home" }: { current?: "home" | "pricing" }) {
  const landing = current === "home" ? "" : "/";
  const columns: { heading: string; links: FooterLink[] }[] = [
    {
      heading: "Product",
      links: [
        { label: "Features", href: `${landing}#features` },
        { label: "What's tracked", href: `${landing}#monitoring` },
        { label: "Who it's for", href: `${landing}#industries` },
        { label: "Pricing", href: "/pricing" },
      ],
    },
    {
      heading: "Download",
      links: [
        { label: "Desktop app", href: current === "pricing" ? "#download" : "/pricing#download" },
        { label: "GitHub", href: GITHUB_ORG_URL, external: true },
      ],
    },
    {
      heading: "Account",
      links: [
        { label: "Log in", href: "/login" },
        { label: "Get started", href: "/signup" },
      ],
    },
  ];

  return (
    <footer className="bg-ink text-chalk">
      <div className="mx-auto flex max-w-300 flex-col gap-12 px-6 pt-16 pb-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Image src="/brand/hiday-wordmark-chalk.svg" alt="Hi Day" width={84} height={35} />
            <span className="text-ink-soft">Make it a good day.</span>
          </div>
          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-2">
              <span className="text-xs font-extrabold tracking-widest text-ink-soft uppercase">{column.heading}</span>
              {column.links.map((link) =>
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-sun focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt-light"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="hover:text-sun focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt-light"
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          ))}
        </div>
        <p className="border-t-2 border-ink-raised pt-6 text-sm text-ink-soft">
          © {new Date().getFullYear()} Hi Day. Every hour, kindly counted.
        </p>
      </div>
    </footer>
  );
}
