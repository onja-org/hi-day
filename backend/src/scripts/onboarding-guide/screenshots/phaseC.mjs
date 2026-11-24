// Phase C (scripted part): download page and Devices, while a real desktop
// app is paired and running as Lucas.
//
// 05e shows Lucas's paired app as a made-up MacBook, so the real machine's
// system details and tracking status never show: the page's device list is rewritten in the
// browser only (nothing in the database changes, and the real app stays
// signed in). His older seeded device is left out, so he appears once.
import { BASE, login, newPage, openBrowser, shot, sql } from './lib.mjs';

const PUBLIC = sql(`select "publicId" from organisations where name = 'HiD''Art'`);
const LUCAS = 'lucas@hid.example';
const MADE_UP_DEVICE = {
  platform: 'macos',
  osVersion: '15.1',
  hostname: 'lucas-macbook',
  appVersion: '0.4.3',
  displaySession: null,
  // A real machine reports its own tracking problems (e.g. a Linux browser
  // started without website tracking); the made-up one records normally.
  appCaptureStatus: 'ok',
  appCaptureDetail: null,
  urlCaptureStatus: 'ok',
  urlCaptureDetail: null,
};

const browser = await openBrowser();
const page = await newPage(browser);
await login(page, 'nadia');
await page.goto(`${BASE}/download`);
await shot(page, '05a-download-page', { full: true });

await page.route(/\/api\/backend\/organisations\/[^/]+\/devices$/, async (route) => {
  const response = await route.fetch();
  const devices = await response.json();
  const paired = devices.find((d) => d.userEmail === LUCAS && d.status === 'active');
  if (!paired) throw new Error('Pair a desktop app as Lucas first (see ../PROMPTS.md).');
  const shown = devices
    .filter((d) => d.userEmail !== LUCAS || d === paired)
    .map((d) => (d === paired ? { ...d, ...MADE_UP_DEVICE } : d));
  await route.fulfill({ response, json: shown });
});
await page.goto(`${BASE}/organisations/${PUBLIC}/devices`);
await shot(page, '05e-devices');
await browser.close();
