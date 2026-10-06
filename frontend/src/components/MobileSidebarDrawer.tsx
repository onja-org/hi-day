"use client";

import { X } from "@phosphor-icons/react";
import type { NavEntry } from "@/types/navigation";
import { SidebarNavEntries } from "./SidebarNavEntries";

type MobileSidebarDrawerProps = {
  entries: NavEntry[];
  pathname: string;
  organisationName: string;
  onClose: () => void;
};

export function MobileSidebarDrawer({
  entries,
  pathname,
  organisationName,
  onClose,
}: MobileSidebarDrawerProps) {
  return (
    <div className="fixed inset-0 z-40 sm:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-primary-dark/50"
      />

      <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar shadow-lg">
        <div className="flex items-center justify-between border-b border-primary-dark/10 px-4 py-4">
          <span className="text-lg font-semibold text-primary-dark">
            {organisationName}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="cursor-pointer text-primary-dark"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-1 py-4">
          <SidebarNavEntries
            entries={entries}
            pathname={pathname}
            variant="drawer"
            onNavigate={onClose}
          />
        </div>
      </div>
    </div>
  );
}
