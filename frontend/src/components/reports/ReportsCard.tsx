"use client";

import Link from "next/link";
import { StarIcon } from "@phosphor-icons/react";
import clsx from "clsx";

type ReportsCardProps = {
  title: string;
  description: string;
  href: string;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  badge?: string;
  featured?: boolean;
};

export function ReportsCard({
  title,
  description,
  href,
  isFavourite,
  onToggleFavourite,
  badge,
  featured = false,
}: ReportsCardProps) {
  return (
    <article
      className={clsx(
        "relative flex h-full flex-col gap-2 rounded-lg border p-4 transition-colors focus-within:border-primary hover:border-primary",
        featured && "border-transparent bg-primary/10",
        !featured && "border-input-border bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary-dark">
          <Link
            href={href}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {title}
          </Link>
          {badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onToggleFavourite}
          aria-pressed={isFavourite}
          aria-label={
            isFavourite
              ? `Remove ${title} from favourites`
              : `Add ${title} to favourites`
          }
          className="relative z-10 shrink-0 cursor-pointer rounded-md p-0.5 hover:bg-primary/10"
        >
          <StarIcon
            size={16}
            aria-hidden="true"
            weight={isFavourite ? "fill" : "regular"}
            className={clsx(
              isFavourite && "text-primary",
              !isFavourite && "text-icon",
            )}
          />
        </button>
      </div>
      <p className="text-xs text-slate-900/70">{description}</p>
    </article>
  );
}
