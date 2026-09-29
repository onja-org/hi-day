import clsx from "clsx";
import Link from "next/link";
import type { NavLink } from "@/types/navigation";

type SidebarNavLinkProps = {
  link: NavLink;
  active: boolean;
  /** "rail" collapses to an icon below lg; "drawer" always shows the label. */
  variant: "rail" | "drawer";
  /** A child of an expanded group — indented, and without its icon wherever the label shows. */
  nested?: boolean;
  onNavigate?: () => void;
};

export function SidebarNavLink({
  link,
  active,
  variant,
  nested = false,
  onNavigate,
}: SidebarNavLinkProps) {
  const isRail = variant === "rail";

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-label={isRail ? link.label : undefined}
      title={isRail ? link.label : undefined}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-3 rounded-r-md border-l-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
        isRail && "justify-center lg:justify-start lg:pl-4",
        isRail && nested && "lg:pl-12",
        !isRail && nested && "pl-12",
        active && "border-primary bg-white text-primary",
        !active &&
          "border-transparent text-slate-900 hover:border-primary/30 hover:bg-white hover:text-primary-dark",
      )}
    >
      <link.icon
        size={20}
        aria-hidden="true"
        className={clsx(nested && isRail && "lg:hidden", nested && !isRail && "hidden")}
      />
      <span className={clsx(isRail && "hidden lg:inline")}>{link.label}</span>
    </Link>
  );
}
