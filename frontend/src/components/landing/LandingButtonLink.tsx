import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "next/link";

type LandingButtonLinkProps = {
  href: string;
  children: ReactNode;
  /** Sun for the main action; white/chalk for the secondary one beside it. */
  tone?: "sun" | "white" | "chalk";
  size?: "md" | "lg";
};

/** The brand's chunky button: ink outline and a hard offset shadow. */
export function LandingButtonLink({ href, children, tone = "sun", size = "lg" }: LandingButtonLinkProps) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center border-3 border-ink font-extrabold text-ink transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt",
        size === "lg" && "h-14.5 rounded-brand-sm px-7 text-lg shadow-hard",
        size === "md" && "h-11.5 rounded-brand-sm px-5 text-base shadow-hard-sm",
        tone === "sun" && "bg-sun",
        tone === "white" && "bg-white",
        tone === "chalk" && "bg-chalk",
      )}
    >
      {children}
    </Link>
  );
}
