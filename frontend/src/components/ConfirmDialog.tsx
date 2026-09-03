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
      <p className="text-slate-900">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-md px-4 py-2 text-sm font-medium text-slate-900 hover:bg-cream"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className={clsx(
            "cursor-pointer rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50",
            isDangerous ? "bg-error" : "bg-primary-dark",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
