let resetEmailSent = false;

export function markResetEmailSent(): void {
  resetEmailSent = true;
}

export function consumeResetEmailSent(): boolean {
  const value = resetEmailSent;
  resetEmailSent = false;
  return value;
}
