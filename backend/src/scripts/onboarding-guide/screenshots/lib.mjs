// Shared helpers for the Getting Started guide screenshots.
//
// Local only. Needs: the frontend (localhost:3000) and backend running, the
// onboarding-guide seed loaded, `psql` on the PATH, and Google Chrome
// installed (Playwright drives it). See ../PROMPTS.md for the run order.
//
// Screenshots go to GUIDE_SCREENSHOT_DIR, or backend/guide-screenshots/
// (gitignored). GUIDE_APP_URL overrides the frontend address.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const BASE = process.env.GUIDE_APP_URL ?? 'http://localhost:3000';
export const PASSWORD = 'Brightline2026!';
/** Creates `dir` if needed and returns it with a trailing slash. */
function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir.endsWith('/') ? dir : `${dir}/`;
}

// backend/, four levels up from this file.
const BACKEND = fileURLToPath(new URL('../../../../', import.meta.url));
export const OUT = ensureDir(process.env.GUIDE_SCREENSHOT_DIR ?? join(BACKEND, 'guide-screenshots'));
/** Made-up screens for 07e, rendered by fake-screens.mjs. */
export const FAKE_SCREENS = ensureDir(join(OUT, 'fake-screens'));
const BACKEND_ENV = join(BACKEND, '.env');

export const PEOPLE = {
  nadia: 'nadia@brightline.example',
  tiana: 'tiana@brightline.example',
  lucas: 'lucas@brightline.example',
  hery: 'hery@brightline.example',
  sofia: 'sofia@brightline.example',
  clara: 'clara@lumohealth.example',
};

/** Runs one SQL query against the local database and returns the first value. */
export function sql(query) {
  const line = readFileSync(BACKEND_ENV, 'utf8')
    .split('\n')
    .find((row) => row.startsWith('DATABASE_URL='));
  const url = line
    .slice('DATABASE_URL='.length)
    .replace(/^"|"$/g, '')
    .replace(/\?schema=public$/, '');
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('Not a local database.');
  return execFileSync('psql', [url, '-At', '-c', query], { encoding: 'utf8' }).trim();
}

export async function openBrowser() {
  return chromium.launch({ channel: 'chrome', headless: true });
}

/**
 * A fresh, logged-out browser window at the guide's fixed size, with the
 * Next.js development badge hidden (customers never see it).
 * `keepDesktopCard` leaves the "Get the desktop app" card alone (01c only).
 */
export async function newPage(browser, { keepDesktopCard = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    timezoneId: 'Indian/Antananarivo',
    locale: 'en-GB',
  });
  await context.addInitScript(() => {
    const style = () => {
      const tag = document.createElement('style');
      tag.textContent =
        'nextjs-portal { display: none !important; }';
      document.documentElement.appendChild(tag);
    };
    if (document.documentElement) style();
    else document.addEventListener('DOMContentLoaded', style);
  });
  const page = await context.newPage();
  page.keepDesktopCard = keepDesktopCard;
  return page;
}

export async function settle(page) {
  await page.waitForLoadState('networkidle');
  if (!page.keepDesktopCard) {
    const dismiss = page.getByLabel('Desktop app').getByRole('button', { name: 'Dismiss' });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  }
  await page.waitForTimeout(600);
}

export async function login(page, who) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email address').fill(PEOPLE[who]);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  await settle(page);
}

/**
 * Saves the visible window. `full` grows the window to the page's height
 * first, so the sidebar runs the whole way down instead of leaving a grey
 * gap (a plain full-page screenshot does).
 */
export async function shot(page, name, { full = false } = {}) {
  await settle(page);
  if (full) {
    const height = await page.evaluate(() =>
      Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    );
    await page.setViewportSize({ width: 1440, height: Math.max(900, Math.min(height, 2400)) });
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${OUT}${name}.png` });
  if (full) await page.setViewportSize({ width: 1440, height: 900 });
  console.log(`saved ${name}.png`);
}
