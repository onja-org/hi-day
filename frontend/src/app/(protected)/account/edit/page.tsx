import { AccountEditForm } from "@/components/AccountEditForm";

export default function AccountEditPage() {
  return (
    <main className="container flex flex-col gap-10 py-8">
      <h1 className="text-2xl font-semibold text-primary-dark">
        Your account
      </h1>

      <AccountEditForm />

      <section className="flex w-full max-w-lg flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">
          Profile picture
        </h2>
        <input
          type="file"
          accept="image/*"
          disabled
          className="text-slate-900 opacity-70"
        />
        <span className="text-sm text-slate-900">Coming soon.</span>
      </section>

      <section className="flex w-full max-w-lg flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">
          Delete account
        </h2>
        <p className="text-slate-900">
          Permanently delete your account and remove your access to every
          organisation you belong to. This cannot be undone.
        </p>
        <button
          type="button"
          disabled
          className="cursor-not-allowed self-start rounded-md border border-error px-4 py-2 text-error opacity-50"
        >
          Delete account
        </button>
        <span className="text-sm text-slate-900">Coming soon.</span>
      </section>
    </main>
  );
}
