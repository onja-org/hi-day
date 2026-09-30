"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";

type PasswordInputProps = {
  name: string;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  pattern?: string;
  title?: string;
  disabled?: boolean;
};

export function PasswordInput({
  name,
  autoComplete,
  required,
  minLength,
  pattern,
  title,
  disabled,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative flex items-center">
      <input
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        pattern={pattern}
        title={title}
        disabled={disabled}
        className="w-full rounded-md border border-input-border bg-white pl-3 h-11 pr-10 text-slate-900 transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-3 flex cursor-pointer items-center text-icon transition-transform duration-150 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        {visible ? (
          <EyeSlash size={20} aria-hidden="true" />
        ) : (
          <Eye size={20} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
