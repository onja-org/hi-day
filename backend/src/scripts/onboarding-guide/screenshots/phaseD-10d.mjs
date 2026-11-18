// 10d only, on an org that has already paid: the "all seats in use" box.
import { BASE, login, newPage, openBrowser, shot, sql } from './lib.mjs';

const PUBLIC = sql(`select "publicId" from organisations where name = 'Brightline Studio'`);
const browser = await openBrowser();
const page = await newPage(browser);
await login(page, 'nadia');
await page.goto(`${BASE}/organisations/${PUBLIC}/members`);
await page.getByRole('button', { name: 'Add members' }).click();
const emails = page.getByLabel('Emails');
await emails.evaluate((element) => element.setAttribute('spellcheck', 'false'));
await emails.fill('maya@brightline.example');
await page.getByText('I understand my bill will change').waitFor({ timeout: 15000 });
await page.getByRole('heading', { name: 'Invite people' }).click();
await shot(page, '10d-seats-full-notice');
await browser.close();
