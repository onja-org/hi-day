export const BILLING_ENABLED_VAR = 'BILLING_ENABLED';

/**
 * Only the exact string "true" enables billing. Anything else reads as off,
 * because showing a self-hoster a paywall is worse than a Cloud deploy
 * needing a restart.
 */
export function parseBillingEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/**
 * Read before `ConfigModule` has loaded `.env`, because module registration
 * decides whether the billing controllers exist at all — so the file has to
 * be loaded here too, or a flag set only in `.env` would start Stripe and
 * then 404 every billing route.
 */
export function isBillingEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env === process.env && !(BILLING_ENABLED_VAR in env)) {
    loadEnvFile();
  }
  return parseBillingEnabled(env[BILLING_ENABLED_VAR]);
}

let envFileLoaded = false;

function loadEnvFile(): void {
  if (envFileLoaded) return;
  envFileLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('dotenv') as { config: (o?: object) => unknown };
    // Does not overwrite what is already set, so a real environment
    // variable still beats the file.
    dotenv.config({ quiet: true });
  } catch {
    // No file, or unreadable: the environment is then the only source.
  }
}
