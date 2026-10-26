"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DownloadSimple, SignOut, UserCircle } from "@phosphor-icons/react";
import { useMyProfile } from "@/hooks/useMyProfile";
import { logout } from "@/lib/logout";
import { Spinner } from "./Spinner";

export function UserMenu() {
  const router = useRouter();
  const profileQuery = useMyProfile();
  const avatarUrl = profileQuery.data?.avatarUrl ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    setLoggingOut(true);
    await logout();
    router.push("/");
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Account menu"
        aria-expanded={menuOpen}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary text-white transition-colors duration-150 hover:bg-primary/90 border-2 border-ink font-bold"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserCircle size={24} aria-hidden="true" />
        )}
      </button>

      {menuOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 flex w-48 flex-col gap-1 rounded-brand-sm border-2 border-ink bg-white p-2 shadow-hard-sm">
          <Link
            href="/account/edit"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="rounded-md px-3 py-2 text-left text-slate-900 transition-colors duration-150 hover:bg-cream"
          >
            Account
          </Link>
          <Link
            href="/download"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-slate-900 transition-colors duration-150 hover:bg-cream"
          >
            <DownloadSimple size={18} aria-hidden="true" />
            Desktop app
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? (
              <Spinner className="text-primary-dark" />
            ) : (
              <SignOut size={18} aria-hidden="true" />
            )}
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
