import { BILLING_ENABLED_VAR } from '../billing-enabled';

/**
 * Whether the Billing API exists at all.
 *
 * "No billing UI" is not met by a hidden menu entry — the routes would
 * still answer a typed URL or a script. So `BillingModule` is not imported
 * when billing is off, and these read Nest's own module metadata to prove
 * it rather than trusting the frontend not to call anything.
 *
 * `isolateModules` is what lets each case see a different flag: the
 * decision is made once, while `app.module.ts` is being imported, because
 * Nest builds the module graph before the container exists.
 */
function appImportsWith(billingEnabled: string): string[] {
  const previous = process.env[BILLING_ENABLED_VAR];
  // Always set, never deleted — an absent variable makes the flag fall back
  // to reading `.env` from disk, and a developer who happens to have
  // billing on locally would then get a different result from CI. Empty
  // string is the "nobody configured this" case either way.
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
    if (previous === undefined) {
      delete process.env[BILLING_ENABLED_VAR];
    } else {
      process.env[BILLING_ENABLED_VAR] = previous;
    }
  }
  return names;
}

describe('the Billing API surface', () => {
  // The default: a fresh self-hosted install, nothing configured.
  it('is not loaded with billing off', () => {
    expect(appImportsWith('')).not.toContain('BillingModule');
  });

  it('is not loaded for an explicit false', () => {
    expect(appImportsWith('false')).not.toContain('BillingModule');
  });

  // Anything that is not exactly "true" reads as off, so a typo in a Cloud
  // deploy hides billing rather than showing a self-hoster a paywall.
  it('is not loaded for a value that only looks affirmative', () => {
    expect(appImportsWith('1')).not.toContain('BillingModule');
    expect(appImportsWith('yes')).not.toContain('BillingModule');
  });

  it('is loaded with billing on', () => {
    expect(appImportsWith('true')).toContain('BillingModule');
  });

  /**
   * Entitlements is always there — it is what answers "do we bill?", and
   * the self-hosted shape needs it just as much as Cloud does.
   */
  it('always loads entitlements, either way', () => {
    expect(appImportsWith('')).toContain('EntitlementsModule');
    expect(appImportsWith('true')).toContain('EntitlementsModule');
  });
});

/**
 * Nest keys dynamic modules on object identity. `app`, `organisations` and
 * `members` all import this one, so a fresh object per call would register
 * three separate modules and build three separate `Entitlements` — three
 * answers to a question that must have one.
 */
describe('registering entitlements more than once', () => {
  it('hands every importer the same module', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EntitlementsModule } = require('../entitlements.module') as {
      EntitlementsModule: {
        register: () => object;
        resetForTests: () => void;
      };
    };

    expect(EntitlementsModule.register()).toBe(EntitlementsModule.register());
  });
});
