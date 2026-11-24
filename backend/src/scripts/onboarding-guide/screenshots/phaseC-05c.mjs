// 05c: "Log in to the desktop app" for a made-up computer, so no real
// machine name shows. Adds a temporary sign-in request, takes the shot,
// then deletes the request.
import { createHash } from 'node:crypto';
import { BASE, login, newPage, openBrowser, shot, sql } from './lib.mjs';

const code = 'onboarding-guide-demo-code';
const hash = createHash('sha256').update(code).digest('hex');
sql(`delete from device_pairing_requests where "codeHash" = '${hash}'`);
sql(`insert into device_pairing_requests ("codeHash", "deviceFingerprint", platform, "osVersion", hostname, "appVersion", "expiresAt")
     values ('${hash}', 'onboarding-guide-demo', 'macos', '15.1', 'lucas-macbook', '0.4.3', now() + interval '10 minutes')`);
const browser = await openBrowser();
try {
  const page = await newPage(browser);
  await login(page, 'lucas');
  await page.goto(`${BASE}/link-device?code=${code}`);
  await page.getByRole('button', { name: 'Log in' }).waitFor();
  await shot(page, '05c-link-desktop-app');
} finally {
  await browser.close();
  sql(`delete from device_pairing_requests where "codeHash" = '${hash}'`);
  console.log('temporary sign-in request removed');
}
