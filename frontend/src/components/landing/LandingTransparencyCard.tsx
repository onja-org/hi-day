import type { Icon } from "@phosphor-icons/react";
import clsx from "clsx";

type LandingTransparencyCardProps = {
  icon: Icon;
  tone: "volt" | "mint" | "bubble";
  title: string;
  items: string[];
};

export function LandingTransparencyCard({ icon: CardIcon, tone, title, items }: LandingTransparencyCardProps) {
  return (
    <div className="flex flex-col gap-3.5 rounded-brand-lg border-4 border-ink bg-chalk p-7 shadow-hard-lg">
      <span
        className={clsx(
          "flex size-14 items-center justify-center rounded-2xl border-3 border-ink",
          tone === "volt" && "bg-volt text-chalk",
          tone === "mint" && "bg-mint text-ink",
          tone === "bubble" && "bg-bubble text-ink",
        )}
      >
        <CardIcon size={28} aria-hidden="true" />
      </span>
      <h3 className="text-2xl font-extrabold">{title}</h3>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
