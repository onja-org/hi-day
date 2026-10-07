import Image from "next/image";
import Link from "next/link";

type Section = {
  href: string;
  label: string;
};

// Anchors into the landing page's sections below — each also works as a
// standalone, shareable URL (e.g. .../#download) since Header is only ever
// rendered on the landing page.
const SECTIONS: Section[] = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#roles", label: "Roles" },
  { href: "#download", label: "Download" },
];

export function Header() {
  return (
    <header className="container flex items-center justify-between py-4">
      <Image src="/brand/hiday-lockup.svg" alt="Hi Day" width={126} height={36} priority />

      <nav aria-label="Page sections" className="hidden gap-6 md:flex">
        {SECTIONS.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="cursor-pointer text-sm font-medium text-slate-900 transition-colors duration-150 hover:text-primary-dark"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="cursor-pointer rounded-md border border-primary px-4 py-2 text-primary transition-colors duration-150 hover:bg-primary/10"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="cursor-pointer rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90"
        >
          Sign up
        </Link>
      </div>
    </header>
  );
}
