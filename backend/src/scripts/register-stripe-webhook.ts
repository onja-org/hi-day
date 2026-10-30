import Stripe from 'stripe';
import { HANDLED_STRIPE_EVENTS } from '../billing/services/stripe-webhook.service';

/**
 * Registers this deployment's webhook endpoint with Stripe, so nobody has to
 * click through the dashboard to set one up.
 *
 *   pnpm --filter backend stripe:register-webhook -- --url https://api.example.com/billing/webhook
 *   pnpm --filter backend stripe:register-webhook -- --url … --dry-run
 *
 * Run **once per environment**, by hand, by whoever deploys. Deliberately
 * not done at boot: the app would then need an API key that can rewrite its
 * own webhook configuration, every deploy could mutate production Stripe
 * state, and instances starting together would race to create the same
 * endpoint.
 *
 * Idempotent — it matches on the URL and leaves an existing endpoint alone,
 * so re-running is safe and tells you what is already there.
 *
 * Two things it does that a dashboard click does not:
 *
 * - Subscribes to exactly `HANDLED_STRIPE_EVENTS`, read from the handler
 *   itself, so the subscription cannot fall behind the code.
 * - Pins `api_version` to the version this app's own SDK speaks. An endpoint
 *   created in the dashboard inherits whatever the account default happens
 *   to be that day, and a newer default can reshape payloads the handler
 *   reads — `invoice.parent.subscription_details` and the item-level
 *   `current_period_end` both moved in recent versions.
 *
 * The signing secret is printed **once**. Stripe returns it only at
 * creation and never again, so it has to be copied into the environment's
 * `STRIPE_WEBHOOK_SECRET` there and then.
 */

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requireHttps(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`\`--url\` is not a URL: ${url}`);
  }
  // Stripe refuses plain HTTP, and localhost is unreachable from Stripe at
  // all — that is what `stripe listen` is for (see backend/README.md).
  if (parsed.protocol !== 'https:') {
    throw new Error(`\`--url\` must be https, got ${parsed.protocol}//`);
  }
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(parsed.hostname)) {
    throw new Error(
      'Stripe cannot reach localhost. Use `stripe listen` for local development.',
    );
  }
}

async function main(): Promise<void> {
  const url = argument('url');
  if (!url) {
    throw new Error(
      'Pass the endpoint, e.g. --url https://api.example.com/billing/webhook',
    );
  }
  requireHttps(url);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set.');
  }

  const dryRun = process.argv.includes('--dry-run');
  const stripe = new Stripe(secretKey);
  const events = [...HANDLED_STRIPE_EVENTS];
  const live = secretKey.startsWith('sk_live_');

  console.log(`Stripe account : ${live ? 'LIVE' : 'test mode'}`);
  console.log(`Endpoint       : ${url}`);
  console.log(`API version    : ${Stripe.API_VERSION}`);
  console.log(`Events (${events.length})     : ${events.join(', ')}`);

  // Paged, because an account near the endpoint limit would otherwise look
  // empty past the first page and get a duplicate created.
  let existing: Stripe.WebhookEndpoint | undefined;
  for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
    if (endpoint.url === url) {
      existing = endpoint;
      break;
    }
  }

  if (existing) {
    const same =
      [...existing.enabled_events].sort().join() === [...events].sort().join();
    console.log(`\nAlready registered as ${existing.id} (${existing.status}).`);
    if (same) {
      console.log('Its events match the handler. Nothing to do.');
    } else {
      console.log('Its events do NOT match the handler:');
      console.log(`  registered: ${existing.enabled_events.join(', ')}`);
      if (dryRun) {
        console.log('\n--dry-run: leaving it alone.');
        return;
      }
      await stripe.webhookEndpoints.update(existing.id, {
        enabled_events: events,
      });
      console.log('\nUpdated its events to match.');
    }
    // Never reprinted: Stripe returns the secret at creation only. If it has
    // been lost, roll it in the dashboard rather than creating a second
    // endpoint — two endpoints means every event is delivered twice.
    console.log(
      'Its signing secret cannot be read back. If you no longer have it, roll it in the Stripe dashboard.',
    );
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run: would create this endpoint. Nothing sent.');
    return;
  }

  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: events,
    api_version: Stripe.API_VERSION,
    description: 'Hi Day billing',
  });

  console.log(`\nCreated ${created.id}.`);
  console.log('\nCopy this into the environment as STRIPE_WEBHOOK_SECRET.');
  console.log('Stripe will not show it again:\n');
  console.log(`  STRIPE_WEBHOOK_SECRET=${created.secret ?? '(not returned)'}`);
  console.log('\nThen restart the backend so it picks the secret up.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
