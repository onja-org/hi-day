// Phase A: sign up as Nadia on an empty database → 01a, 01b, 01c.
// Run after `pnpm --filter backend seed:onboarding-guide --clean`.
import { BASE, PASSWORD, newPage, openBrowser, shot, sql } from './lib.mjs';

const browser = await openBrowser();
const page = await newPage(browser, { keepDesktopCard: true });

await page.goto(`${BASE}/signup`);
await page.getByLabel('First name').fill('Nadia');
await page.getByLabel('Last name').fill('Rakoto');
await page.getByLabel('Email address').fill('nadia@brightline.example');
await page.getByLabel('Company name').fill('Brightline Studio');
await page.getByLabel('Address', { exact: true }).fill('12 Rue des Jacarandas, Antananarivo 101, Madagascar');
await page.getByLabel('Website (optional)').fill('https://brightline.example');
await page.getByLabel('I agree to the Terms of Service and Privacy Policy').check();
await page.getByRole('button', { name: 'Create account' }).click();
await page.getByText('Verify your email').first().waitFor({ timeout: 20000 });
await shot(page, '01a-verify-your-email');

const token = sql(
  `select "emailVerificationToken" from users where email = 'nadia@brightline.example'`,
);
if (!token) throw new Error('No verification token found.');
await page.goto(`${BASE}/set-password?token=${encodeURIComponent(token)}`);
await page.locator('input[name="password"]').fill(PASSWORD);
await shot(page, '01b-set-your-password');

await page.getByRole('button', { name: 'Set password' }).click();
await page.waitForURL(/dashboard/, { timeout: 20000 });
await page.getByLabel('Desktop app').waitFor({ timeout: 15000 });
await shot(page, '01c-empty-dashboard');

await browser.close();
