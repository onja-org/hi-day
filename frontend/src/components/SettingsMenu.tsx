"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gear, SignOut, UserCircle } from "@phosphor-icons/react";
import { logout } from "@/lib/logout";
import { Modal } from "./Modal";
import { OrganisationSettingsForm } from "./OrganisationSettingsForm";
import { RequireRole } from "./RequireRole";
import { Spinner } from "./Spinner";

export function SettingsMenu() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
    <div ref={menuRef} className="fixed bottom-4 left-4">
      {menuOpen && (
        <div className="mb-2 flex flex-col gap-1 rounded-md border border-primary-dark/20 bg-white p-2 shadow-lg transition-all duration-150">
          <button
            type="button"
            onClick={() => {
              setProfileOpen(true);
              setMenuOpen(false);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-slate-900 transition-colors duration-150 hover:bg-cream"
          >
            <UserCircle size={18} aria-hidden="true" />
            Update profile
          </button>
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

      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Settings"
        aria-expanded={menuOpen}
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-primary-dark text-white shadow-lg transition-all duration-150 hover:scale-105 hover:bg-primary-dark/90 active:scale-95"
      >
        <Gear size={24} aria-hidden="true" />
      </button>

      {profileOpen && (
        <Modal title="Update profile" onClose={() => setProfileOpen(false)}>
          <RequireRole role="admin">
            <OrganisationSettingsForm onSuccess={() => setProfileOpen(false)} />
          </RequireRole>
        </Modal>
      )}
    </div>
  );
}
