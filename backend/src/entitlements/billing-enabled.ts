/**
 * Whether this installation bills anyone at all.
 *
 * Hi Day is one codebase and one build: the self-hosted product and Hi Day
 * Cloud are the same artifact, and this flag is the only difference between
 * them. That is deliberate — a self-hosted install that is the same binary
 * Cloud runs is one whose billing-off path is exercised by every test run,
 * rather than a fork that drifts.
 *
 * **Off by default**, so a fresh clone with an empty `.env` is already a
 * correct self-hosted install: the pricing page promises "free, forever, any
 * team size", and a promise that needs configuring to hold is not kept. An
 * install only ever bills because somebody deliberately turned it on.
 *
 * Read from the environment rather than the database because it describes
 * the deployment, not a tenant: there is no sense in which one Organisation
 * on an install could be billed and another not — that is what
 * `BILLING_FREE_ORGANISATION_IDS` is for, one scope down.
 */
export const BILLING_ENABLED_VAR = 'BILLING_ENABLED';

/**
 * Only the exact string `true` enables billing. Anything else — unset, empty,
 * `1`, `yes`, a typo — reads as off.
 *
 * Deliberately not the usual permissive truthiness: the two mistakes are not
 * symmetric. Reading a malformed value as *off* costs a Cloud deploy a
 * restart with a corrected variable, which its own smoke test catches. Reading
 * one as *on* shows a self-hoster a trial countdown and a paywall for a
 * product we told them was free forever, and nothing in their install would
 * flag it as wrong.
 */
export function parseBillingEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/**
 * The flag, read early enough to decide whether the billing controllers are
 * registered at all.
 *
 * Nest's `ConfigService` is the usual way in, and the services use it — but
 * module registration happens while `app.module.ts` is still being imported,
 * which is *before* `ConfigModule.forRoot()` has run and loaded `.env`. So
 * `process.env` alone is not enough: a deployment setting
 * `BILLING_ENABLED=true` in `backend/.env` — the way both READMEs tell you to
 * — would start Stripe and then 404 every billing route, because the
 * controllers had already been skipped by the time the file was read.
 *
 * Hence the explicit load. `dotenv` is what `@nestjs/config` uses underneath
 * and reads the same default path, so this sees exactly what `ConfigService`
 * will see a moment later and the two cannot disagree.
 *
 * It does **not** overwrite variables already in the environment, so the
 * usual precedence holds: a real environment variable (Docker, CI, the
 * shell) still beats the file.
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

/**
 * Loads `.env` into `process.env` once, tolerating a missing file — the
 * normal case in production, where the environment is set directly.
 */
function loadEnvFile(): void {
  if (envFileLoaded) return;
  envFileLoaded = true;
  try {
    // Required lazily so importing this module costs nothing for the callers
    // that only want `parseBillingEnabled`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('dotenv') as { config: (o?: object) => unknown };
    dotenv.config({ quiet: true });
  } catch {
    // No dotenv, no file, or an unreadable one: the environment is then the
    // only source, and an absent flag correctly reads as billing off.
  }
}
