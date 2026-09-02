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
        "hidden shrink-0 flex-col justify-center gap-4 px-12 py-16 lg:flex flex-1",
        variant === "dark" && "bg-primary-dark text-white",
        variant === "cream" && "bg-cream text-primary-dark",
      )}
    >
      {title && (
        <div className="max-w-88 mx-auto">
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
