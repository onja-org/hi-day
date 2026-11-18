// Phase B: web screenshots on the seeded org (steps 2–4 and 6–8).
// Run after `pnpm --filter backend seed:onboarding-guide`.
// Usage: node phaseB.mjs            (all shots)
//        node phaseB.mjs 04a 07g    (only these)
import { BASE, OUT, login, newPage, openBrowser, shot, sql } from './lib.mjs';

const ORG = sql(`select id from organisations where name = 'Brightline Studio'`);
const PUBLIC = sql(`select "publicId" from organisations where id = '${ORG}'`);
const membership = (email) =>
  sql(`select m.id from memberships m join users u on u.id = m."userId"
       where u.email = '${email}' and m."organisationId" = '${ORG}'`);
const project = (name) =>
  sql(`select id from projects where "organisationId" = '${ORG}' and name = '${name}'`);
const team = (name) =>
  sql(`select id from teams where "organisationId" = '${ORG}' and name = '${name}'`);

const O = `${BASE}/organisations/${PUBLIC}`;
const HARBOUR = project('Harbour Café: Website redesign');
const LUMO = project('Lumo Health: Patient app UI');
const DESIGN = team('Design');
const LUCAS = membership('lucas@brightline.example');
const SOFIA = membership('sofia@brightline.example');
const HERY = membership('hery@brightline.example');

const SHOTS = [
  // Step 2: tracking settings (admin)
  { id: '02a-activity-settings', who: 'nadia', go: `${O}/settings/tracking/activity`, full: true },
  { id: '02b-screenshot-settings', who: 'nadia', go: `${O}/settings/tracking/screenshots`, full: true },
  {
    id: '02c-idle-timeout', who: 'nadia', go: `${O}/settings/tracking/time`,
    act: async (page) => page.getByText('Idle timeout', { exact: true }).first().click(),
  },
  {
    id: '02c-keep-idle-time', who: 'nadia', go: `${O}/settings/tracking/time`,
    act: async (page) => page.getByText('Keep idle time', { exact: true }).first().click(),
  },
  { id: '02d-timesheet-settings', who: 'nadia', go: `${O}/settings/tracking/timesheets`, full: true },
  // Step 3: teams, projects, tasks
  { id: '03a-teams', who: 'nadia', go: `${O}/teams` },
  { id: '03b-project-page', who: 'nadia', go: `${O}/projects/${HARBOUR}`, full: true },
  { id: '03c-tasks-board', who: 'nadia', go: `${O}/tasks?view=kanban&project=${HARBOUR}` },
  // Step 4: invites and roles
  {
    id: '04a-invite-people', who: 'nadia', go: `${O}/members`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Add members' }).click();
      await page.getByLabel('Emails').fill('maya@brightline.example, tom@brightline.example');
    },
  },
  {
    id: '04b-invite-links', who: 'nadia', go: `${O}/members`,
    act: async (page) => {
      await page.getByText(/^Invite links/i).first().click();
      const existing = page.getByText('Autumn intake');
      if (!(await existing.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: 'Create link' }).click();
        await page.getByPlaceholder('e.g. Autumn intake').fill('Autumn intake');
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        await existing.waitFor();
      }
    },
  },
  { id: '04c-members', who: 'nadia', go: `${O}/members` },
  { id: '04d-project-viewer', who: 'nadia', go: `${O}/projects/${LUMO}`, full: true },
  { id: '04e-team-manager', who: 'nadia', go: `${O}/teams/${DESIGN}` },
  // Step 6: tracking time
  {
    id: '06a-web-timer-project-picked', who: 'nadia', go: `${BASE}/dashboard/${PUBLIC}/me`,
    act: async (page) => {
      await page.getByRole('button', { name: /Open (running )?timer/ }).click();
      // A native list: it can't be shown open in a screenshot, so pick one.
      await page.locator('select:visible').first().selectOption({ label: 'Brightline: Brand refresh' });
    },
  },
  {
    id: '06b-web-timer-running', who: 'hery', go: `${BASE}/dashboard/${PUBLIC}/me`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Open running timer' }).click();
    },
  },
  {
    id: '06d-add-time', who: 'hery', go: `${O}/time_entries`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Add time' }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('From', { exact: true }).fill('08:00');
      await dialog.getByLabel('To', { exact: true }).fill('09:15');
      await dialog.locator('select').filter({ hasText: 'Harbour Café' }).first()
        .selectOption({ label: 'Harbour Café: Website redesign' });
      const reason = dialog.locator('select').filter({ hasText: 'Forgot to start timer' });
      if (await reason.count()) await reason.first().selectOption({ label: 'Forgot to start timer' });
      await dialog.getByText('Add time', { exact: true }).first().click();
    },
  },
  // Step 7: where the time went
  { id: '07a-dashboard-member', who: 'lucas', go: `${BASE}/dashboard/${PUBLIC}/me` },
  { id: '07b-dashboard-all', who: 'nadia', go: `${BASE}/dashboard/${PUBLIC}/all` },
  { id: '07c-dashboard-manager', who: 'tiana', go: `${BASE}/dashboard/${PUBLIC}/all` },
  {
    id: '07d-timesheets-weekly', who: 'lucas', go: `${O}/time_entries`,
    act: async (page) => page.getByRole('tab', { name: 'Weekly' }).click(),
  },
  { id: '07f-all-reports', who: 'nadia', go: `${O}/reports/all` },
  {
    id: '07g-report-export', who: 'nadia', go: `${O}/reports/time-and-activity`,
    act: async (page) => {
      await page.getByRole('tab', { name: 'All' }).click();
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: 'Export' }).click();
    },
  },
  // Step 8: insights
  { id: '08a-work-time-classification', who: 'nadia', go: `${O}/settings/tracking/work-time-classification` },
  { id: '08b-timeline', who: 'nadia', go: `${O}/insights/timeline?member=${SOFIA}` },
  { id: '08c-performance-manager', who: 'tiana', go: `${O}/insights/performance?member=${LUCAS}`, full: true },
  { id: '08d-performance-member', who: 'lucas', go: `${O}/insights/performance`, full: true },
  { id: '08e-unusual-activity', who: 'nadia', go: `${O}/insights/unusual-activity?member=${LUCAS}`, full: true },
  { id: '08f-highlights', who: 'nadia', go: `${O}/insights/highlights?member=${HERY}`, full: true },
  // Step 9: what a project viewer sees (Clara, the client contact).
  { id: '09a-viewer-project', who: 'clara', go: `${O}/projects/${LUMO}`, full: true },
];

const only = process.argv.slice(2);
const browser = await openBrowser();
const pages = {};
const failed = [];
for (const item of SHOTS) {
  if (only.length > 0 && !only.some((prefix) => item.id.startsWith(prefix))) continue;
  try {
    if (!pages[item.who]) {
      pages[item.who] = await newPage(browser);
      await login(pages[item.who], item.who);
    }
    const page = pages[item.who];
    if (item.height) await page.setViewportSize({ width: 1440, height: item.height });
    await page.goto(item.go);
    await page.waitForLoadState('networkidle');
    if (item.act) await item.act(page);
    await shot(page, item.id, { full: Boolean(item.full) });
    await page.keyboard.press('Escape').catch(() => {});
    if (item.height) await page.setViewportSize({ width: 1440, height: 900 });
  } catch (error) {
    failed.push(`${item.id}: ${error.message.split('\n')[0]}`);
    await pages[item.who]?.screenshot({ path: `${OUT}_fail-${item.id}.png` }).catch(() => {});
    console.log(error.message.split('\n').slice(0, 4).join(' | '));
    console.log(`FAILED ${item.id}`);
  }
}
await browser.close();
if (failed.length > 0) console.log(`\n${failed.length} failed:\n${failed.join('\n')}`);
