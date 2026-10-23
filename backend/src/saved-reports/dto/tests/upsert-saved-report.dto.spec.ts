import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertSavedReportDto } from '../upsert-saved-report.dto';

const UUID = '2b8b5b3a-9d0e-4a3a-8a3a-3b3a9d0e4a3a';

const settings = {
  datePreset: 'last_7_days',
  days: { from: '2026-09-28', to: '2026-10-04' },
  scope: 'me',
  grouping: 'day',
  filters: { memberIds: [], teamIds: [], projectIds: [UUID] },
};

const schedule = {
  emails: ['a@example.com'],
  message: 'hi',
  fileType: 'pdf',
  dateRange: 'last_week',
  frequency: 'weekly',
  hour: 9,
  days: [1, 3],
};

async function isValid(body: object): Promise<boolean> {
  const errors = await validate(plainToInstance(UpsertSavedReportDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.length === 0;
}

describe('UpsertSavedReportDto', () => {
  const base = { name: 'Weekly', settings };

  it('accepts a report without a schedule', async () => {
    expect(await isValid(base)).toBe(true);
    expect(await isValid({ ...base, schedule: null })).toBe(true);
  });

  it('accepts a scheduled report', async () => {
    expect(await isValid({ ...base, schedule })).toBe(true);
  });

  it('accepts "This week" as a saved preset and as a schedule range', async () => {
    expect(
      await isValid({
        ...base,
        settings: { ...settings, datePreset: 'this_week' },
      }),
    ).toBe(true);
    expect(
      await isValid({
        ...base,
        schedule: { ...schedule, dateRange: 'this_week' },
      }),
    ).toBe(true);
  });

  it('still accepts "Last 7 days", so existing reports keep their range', async () => {
    expect(
      await isValid({
        ...base,
        schedule: { ...schedule, dateRange: 'last_7_days' },
      }),
    ).toBe(true);
  });

  it('accepts a fixed custom range (no preset)', async () => {
    expect(
      await isValid({ ...base, settings: { ...settings, datePreset: null } }),
    ).toBe(true);
  });

  it('rejects a blank name', async () => {
    expect(await isValid({ ...base, name: '' })).toBe(false);
  });

  it('rejects an unknown preset, scope or grouping', async () => {
    for (const bad of [
      { datePreset: 'next_year' },
      { scope: 'everyone' },
      { grouping: 'client' },
    ]) {
      expect(
        await isValid({ ...base, settings: { ...settings, ...bad } }),
      ).toBe(false);
    }
  });

  it('rejects malformed days and non-uuid filter ids', async () => {
    expect(
      await isValid({
        ...base,
        settings: { ...settings, days: { from: 'Sep 28', to: '2026-10-04' } },
      }),
    ).toBe(false);
    expect(
      await isValid({
        ...base,
        settings: {
          ...settings,
          filters: { ...settings.filters, memberIds: ['nope'] },
        },
      }),
    ).toBe(false);
  });

  it('rejects a bad schedule', async () => {
    const bads = [
      { emails: [] },
      { emails: ['nope'] },
      { emails: Array.from({ length: 11 }, (_, i) => `u${i}@example.com`) },
      { fileType: 'exe' },
      { dateRange: 'someday' },
      { frequency: 'hourly' },
      { hour: 24 },
      { hour: -1 },
      { days: [] },
      { days: [7] },
      { days: [1, 1] },
    ];
    for (const bad of bads) {
      expect(
        await isValid({ ...base, schedule: { ...schedule, ...bad } }),
      ).toBe(false);
    }
  });

  it('rejects unexpected properties', async () => {
    expect(await isValid({ ...base, organisationId: 'x' })).toBe(false);
  });
});
