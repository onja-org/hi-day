/** The text of the downloadable recovery-codes file. */
export function recoveryCodesFile(codes: string[], email: string): string {
  return [
    `Hi Day recovery codes for ${email}`,
    "",
    "Each code works once. Use one to log in if you lose your phone.",
    "Keep them somewhere safe, like a password manager.",
    "",
    ...codes,
    "",
  ].join("\n");
}
