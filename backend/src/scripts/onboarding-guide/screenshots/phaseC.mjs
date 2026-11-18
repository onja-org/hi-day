// Phase C (scripted part): download page and Devices, while a real desktop
// app is paired and running as Lucas.
import { BASE, login, newPage, openBrowser, shot, sql } from './lib.mjs';

const PUBLIC = sql(`select "publicId" from organisations where name = 'Brightline Studio'`);
const browser = await openBrowser();
const page = await newPage(browser);
await login(page, 'nadia');
await page.goto(`${BASE}/download`);
await shot(page, '05a-download-page', { full: true });
await page.goto(`${BASE}/organisations/${PUBLIC}/devices`);
await shot(page, '05e-devices');
await browser.close();
