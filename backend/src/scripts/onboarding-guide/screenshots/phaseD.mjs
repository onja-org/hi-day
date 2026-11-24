// Phase D: billing. Run last: paying (Stripe test mode, card 4242…) moves
// the org off its trial. Re-run the seed to get the trial back.
import { BASE, login, newPage, openBrowser, shot, sql } from './lib.mjs';

const PUBLIC = sql(`select "publicId" from organisations where name = 'HiD''Art'`);
const O = `${BASE}/organisations/${PUBLIC}`;
const browser = await openBrowser();
const page = await newPage(browser);
await login(page, 'nadia');

await page.goto(`${O}/settings/billing/subscription`);
await page.getByRole('button', { name: 'Add payment' }).last().waitFor();
await shot(page, '10a-subscription-trial', { full: true });

// The Add payment button on the page (the banner has one too).
await page.locator('main').getByRole('button', { name: 'Add payment' }).last().click();
const dialog = page.getByRole('dialog');
await dialog.getByLabel('Cardholder name').fill('Nadia Rakoto');
const stripe = (title) => page.frameLocator(`iframe[title*="${title}"]`).first();
await stripe('card number').locator('input[name="cardnumber"]').fill('4242 4242 4242 4242');
await stripe('expiration date').locator('input[name="exp-date"]').fill('12 / 30');
await stripe('CVC').locator('input[name="cvc"]').fill('123');
await dialog.getByRole('heading', { name: 'Card details' }).click();
await shot(page, '10b-add-payment');

await dialog.getByRole('button', { name: 'Confirm payment' }).click();
await page.getByText('Payment confirmed').waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await page.reload();
await page.getByText('Payment method').first().waitFor({ timeout: 30000 });
await shot(page, '10c-subscription-paid', { full: true });

await page.goto(`${O}/members`);
await page.getByRole('button', { name: 'Add members' }).click();
await page.getByLabel('Emails').fill('maya@hid.example');
await page.getByText('I understand my bill will change').waitFor({ timeout: 15000 });
await shot(page, '10d-seats-full-notice');

await browser.close();
