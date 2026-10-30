"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "@phosphor-icons/react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** "wide" fits content like a table that the default width would squash. */
  size?: "default" | "wide";
};

export function Modal({ title, onClose, children, size = "default" }: ModalProps) {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  /**
   * Everything inside that can take focus, in the order Tab would visit it.
   * Recomputed per keypress rather than cached: a dialog's contents change —
   * a form becomes a success message, a button appears — and a stale list
   * would trap focus on an element no longer there.
   */
  function focusable(): HTMLElement[] {
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    return [...(nodes ?? [])].filter(
      (node) => node.offsetParent !== null || node === document.activeElement,
    );
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Only the topmost dialog responds, so Escape in a modal opened from
      // another modal doesn't dismiss both.
      const dialogs = document.querySelectorAll('[role="dialog"]');
      const isTopmost = dialogs[dialogs.length - 1] === dialogRef.current;
      if (!isTopmost) return;

      if (event.key === "Escape") {
        onClose();
        return;
      }

      // Tab wraps inside the dialog. Without this, tabbing past the last
      // control lands on the page behind — which a screen reader then reads
      // as though the dialog were not there.
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  /**
   * Focus moves in on open and back to whatever opened it on close.
   *
   * Returning it matters as much as taking it: without this, closing a
   * dialog leaves focus on `<body>`, and the next Tab starts from the top of
   * the page rather than from the button the person just pressed.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // After the mount paint, so the first field exists to receive it.
    const frame = requestAnimationFrame(() => {
      const [firstField] = focusable();
      firstField?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      opener?.focus?.();
    };
    // Once per dialog: re-running would steal focus mid-typing.
  }, []);

  // Rendered via a portal straight into document.body: a transformed
  // ancestor (e.g. FadeIn's translate-y classes, applied as the first div
  // inside <main>) would otherwise become the containing block for this
  // `fixed` overlay, capping it to that ancestor's box instead of the full
  // viewport.
  return createPortal(
    <div
      className={clsx(
        "fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-primary-dark/50 p-4 transition-opacity duration-200",
        visible && "opacity-100",
        !visible && "opacity-0",
      )}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
        className={clsx(
          "flex max-h-full w-full cursor-auto flex-col gap-6 overflow-y-auto rounded-brand border-3 border-ink bg-white p-6 shadow-hard transition-all duration-200",
          size === "default" && "max-w-lg",
          size === "wide" && "max-w-2xl",
          visible && "scale-100 opacity-100",
          !visible && "scale-95 opacity-0",
        )}
      >
        {/* Pinned so a dialog taller than the viewport keeps its title and
            close button in view while the body scrolls. The negative top
            margin and matching padding let it cover the dialog's own p-6
            gutter instead of leaving a gap that content scrolls through. */}
        <div className="sticky top-0 z-10 -mt-6 flex items-center justify-between bg-white pt-6 pb-2">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-primary-dark"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            /* "Close dialog", not "Close": a dialog's own body may carry a
               Close button of its own, and two controls with the same
               accessible name in one dialog is a guess for anybody
               navigating by name. */
            aria-label="Close dialog"
            className="cursor-pointer rounded-full p-1 text-primary-dark transition-colors duration-150 hover:bg-cream"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
