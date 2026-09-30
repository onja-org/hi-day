"use client";

import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { createAccount } from "@/lib/createAccount";
import { parseSignUpFormData } from "@/lib/parseSignUpFormData";
import { CheckboxField } from "@/components/ui/form/CheckboxField";
import { TextField } from "@/components/ui/form/TextField";
import { SignUpSuccess } from "@/components/SignUpSuccess";
import { Spinner } from "@/components/Spinner";
import Link from "next/link";

export function SignUpForm() {
  const mutation = useMutation({ mutationFn: createAccount });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = parseSignUpFormData(new FormData(event.currentTarget));
    mutation.mutate(input);
  }

  if (mutation.data?.ok && mutation.variables) {
    return <SignUpSuccess email={mutation.variables.email} />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-4xl mx-auto md:px-20 lg:px-0 flex-col gap-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
        />

        <TextField
          label="Last name"
          name="lastName"
          type="text"
          autoComplete="family-name"
          required
        />
      </div>

      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
      />

      <TextField
        label="Company name"
        name="companyName"
        type="text"
        autoComplete="organization"
        required
      />

      <TextField
        label="Address"
        name="address"
        type="text"
        autoComplete="street-address"
        required
      />

      <TextField
        label="Website (optional)"
        name="website"
        type="text"
        autoComplete="url"
        placeholder="https://example.com"
      />

      <CheckboxField
        label="I agree to the Terms of Service and Privacy Policy"
        name="agreeToTerms"
        required
        className="items-start text-sm"
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 h-11 text-white transition-all duration-150 hover:scale-105 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {mutation.isPending && <Spinner />}
        {mutation.isPending ? "Creating your account…" : "Create account"}
      </button>

      <p className="text-slate-900">
        Already have an account?{" "}
        <Link
          href="/login"
          className="cursor-pointer underline text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-dark hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
