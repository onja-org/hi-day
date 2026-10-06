type OwnerAccountWarningProps = {
  /** Null while the status is loading, or for anyone but the owner. */
  ownerKeepsAccount: boolean | null;
};

/** Tells the owner a permanent deletion also erases their own login. */
export function OwnerAccountWarning({
  ownerKeepsAccount,
}: OwnerAccountWarningProps) {
  if (ownerKeepsAccount !== false) return null;

  return (
    <p className="text-xs font-medium text-error">
      Your own user account is deleted too, because you don&rsquo;t belong to
      any other organisation. You&rsquo;ll be signed out straight away.
    </p>
  );
}
