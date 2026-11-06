import { BILLING_ENABLED_VAR } from '../billing-enabled';

/**
 * "No billing UI" is not met by a hidden menu entry, so `BillingModule` is
 * not imported at all when billing is off. Read from Nest's own metadata
 * rather than trusting the frontend not to call anything.
 */
function appImportsWith(billingEnabled: string): string[] {
  const previous = process.env[BILLING_ENABLED_VAR];
  // Always set, never deleted: an absent value falls back to reading .env
  // from disk, so a developer's own config would change the result.
  process.env[BILLING_ENABLED_VAR] = billingEnabled;

  let names: string[] = [];
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AppModule } = require('../../app.module') as {
        AppModule: object;
      };
      const imported =
        (Reflect.getMetadata('imports', AppModule) as
          { name?: string; module?: { name: string } }[] | undefined) ?? [];
      names = imported.map(
        (entry) => entry?.module?.name ?? entry?.name ?? 'anonymous',
      );
    });
  } finally {
    if (previous === undefined) delete process.env[BILLING_ENABLED_VAR];
    else process.env[BILLING_ENABLED_VAR] = previous;
  }
  return names;
}

describe('the Billing API surface', () => {
  it('is not loaded with billing off', () => {
    expect(appImportsWith('')).not.toContain('BillingModule');
  });

  it('is loaded with billing on', () => {
    expect(appImportsWith('true')).toContain('BillingModule');
  });

  it('always loads entitlements, either way', () => {
    expect(appImportsWith('')).toContain('EntitlementsModule');
    expect(appImportsWith('true')).toContain('EntitlementsModule');
  });

  /** Nest keys dynamic modules on identity, so a fresh object per call would
   * build a separate `Entitlements` for each of the three importers. */
  it('hands every importer the same module', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EntitlementsModule } = require('../entitlements.module') as {
      EntitlementsModule: { register: () => object };
    };

    expect(EntitlementsModule.register()).toBe(EntitlementsModule.register());
  });
});
