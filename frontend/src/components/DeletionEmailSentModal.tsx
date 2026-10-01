import { Modal } from "./Modal";

type DeletionEmailSentModalProps = {
  ownerEmail: string | null;
  onClose: () => void;
};

export function DeletionEmailSentModal({
  ownerEmail,
  onClose,
}: DeletionEmailSentModalProps) {
  return (
    <Modal title="Check your email" onClose={onClose}>
      <p className="text-slate-900">
        We sent a confirmation link to {ownerEmail ?? "your email"}. Nothing is
        deleted until you open it and confirm.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-md bg-primary-dark px-4 h-11 text-white"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
