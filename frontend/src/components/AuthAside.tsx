import clsx from "clsx";

interface AuthAsideProps {
  title?: string;
  description?: string;
  variant?: "dark" | "cream";
}

export function AuthAside({
  title,
  description,
  variant = "dark",
}: AuthAsideProps) {
  return (
    <aside
      className={clsx(
        "relative hidden shrink-0 flex-col justify-center gap-4 overflow-hidden px-12 py-16 lg:flex flex-1",
        variant === "dark" && "bg-primary-dark text-white",
        variant === "cream" && "bg-cream text-primary-dark",
      )}
    >
      <div
        aria-hidden="true"
        className={clsx(
          "animate-float-slow absolute -top-20 -right-16 h-72 w-72 rounded-full blur-3xl",
          variant === "dark" && "bg-primary/30",
          variant === "cream" && "bg-primary/15",
        )}
      />
      <div
        aria-hidden="true"
        className={clsx(
          "animate-float absolute -bottom-24 -left-10 h-80 w-80 rounded-full blur-3xl",
          variant === "dark" && "bg-secondary/30",
          variant === "cream" && "bg-secondary/15",
        )}
      />

      {title && (
        <div className="animate-fade-in-up-delay max-w-88 mx-auto relative">
          <h2 className="text-3xl font-semibold">{title}</h2>
          {description && (
            <p
              className={clsx(
                variant === "dark" && "text-white/80",
                variant === "cream" && "text-primary-dark/70",
              )}
            >
              {description}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
