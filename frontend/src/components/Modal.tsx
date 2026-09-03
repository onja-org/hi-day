"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "@phosphor-icons/react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ title, onClose, children }: ModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
        className={clsx(
          "flex max-h-full w-full max-w-lg cursor-auto flex-col gap-6 overflow-y-auto rounded-lg bg-white p-6 transition-all duration-200",
          visible && "scale-100 opacity-100",
          !visible && "scale-95 opacity-0",
        )}
      >
        <div className="flex items-center justify-between">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-primary-dark"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
