import { generateSlug } from './slug.util';

describe('generateSlug', () => {
  it('kebab-cases the name and appends a random suffix', () => {
    const slug = generateSlug('Acme Inc.');

    expect(slug).toMatch(/^acme-inc-[0-9a-f]{8}$/);
  });

  it('produces a different suffix on each call, even for the same name', () => {
    expect(generateSlug('Acme Inc.')).not.toEqual(generateSlug('Acme Inc.'));
  });

  it('falls back to "org" when the name has no alphanumeric characters', () => {
    const slug = generateSlug('!!!');

    expect(slug).toMatch(/^org-[0-9a-f]{8}$/);
  });
});
