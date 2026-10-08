"use client";

import clsx from "clsx";
import { Modal } from "./Modal";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  isDangerous?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  isDangerous,
  isPending,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onClose}>
      {/* pre-line so a caller can pass a multi-line message (e.g. one line
          per field being changed) without needing its own dialog. */}
      <p className="whitespace-pre-line text-slate-900">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-sm font-semibold text-slate-900 hover:bg-cream"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className={clsx(
            "cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50",
            isDangerous && "bg-error",
            !isDangerous && "bg-primary-dark",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
