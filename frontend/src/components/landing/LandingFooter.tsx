import Image from "next/image";
import Link from "next/link";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "What's tracked", href: "#monitoring" },
      { label: "Who it's for", href: "#industries" },
    ],
  },
  { heading: "Download", links: [{ label: "Desktop app", href: "#download" }] },
  {
    heading: "Account",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Get started", href: "/signup" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-ink text-chalk">
      <div className="mx-auto flex max-w-300 flex-col gap-12 px-6 pt-16 pb-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Image src="/brand/hiday-wordmark-chalk.svg" alt="Hi Day" width={84} height={35} />
            <span className="text-ink-soft">Make it a good day.</span>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-2">
              <span className="text-xs font-extrabold tracking-widest text-ink-soft uppercase">{column.heading}</span>
              {column.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="hover:text-sun focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt-light"
                >
                  {link.label}
                </Link>
              ))}
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
