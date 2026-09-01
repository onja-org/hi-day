import Link from "next/link";

export function Header() {
  return (
    <header className="container flex items-center justify-between py-4">
      <span className="text-lg font-semibold text-primary-dark">
        Workforce Monitoring
      </span>
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
