import { randomBytes } from 'crypto';

export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  const suffix = randomBytes(4).toString('hex');

  return `${base || 'org'}-${suffix}`;
}
