import { AccountEditForm } from "@/components/AccountEditForm";
import { SignOutEverywhereButton } from "@/components/SignOutEverywhereButton";

export default function AccountEditPage() {
  return (
    <main className="container flex flex-col gap-8 py-8">
      <h1 className="animate-fade-in-up text-2xl font-semibold text-primary-dark">
        Your account
      </h1>

      <div className="animate-fade-in-up-delay flex flex-col gap-8">
        <AccountEditForm />
        <SignOutEverywhereButton />
      </div>
    </main>
  );
}
