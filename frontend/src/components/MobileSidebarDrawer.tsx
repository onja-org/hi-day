"use client";

import type { Icon } from "@phosphor-icons/react";
import { X } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";

type NavItem = {
  label: string;
  href: string;
  icon: Icon;
};

type MobileSidebarDrawerProps = {
  items: NavItem[];
  pathname: string;
  organisationName: string;
  onClose: () => void;
};

export function MobileSidebarDrawer({
  items,
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
        <div className="flex items-center justify-between px-4 py-4">
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

        <div className="flex flex-col gap-1 px-3">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-900 transition-colors duration-150 hover:bg-white hover:text-primary-dark",
                  isActive &&
                    "bg-sidebar-active text-primary hover:bg-sidebar-active hover:text-primary",
                )}
              >
                <item.icon size={20} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
