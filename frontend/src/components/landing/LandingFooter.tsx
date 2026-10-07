import Image from "next/image";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-primary-dark/10 bg-white py-10">
      <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
        <Image src="/brand/hiday-lockup.svg" alt="Hi Day" width={98} height={28} />
        <nav className="flex items-center gap-6 text-sm text-slate-900">
          <a href="#features" className="cursor-pointer hover:text-primary">
            Features
          </a>
          <Link href="/login" className="cursor-pointer hover:text-primary">
            Log in
          </Link>
          <Link href="/signup" className="cursor-pointer hover:text-primary">
            Sign up
          </Link>
        </nav>
        <span className="text-sm text-slate-900/60">
          © {new Date().getFullYear()} Hi Day
        </span>
      </div>
    </footer>
  );
}
