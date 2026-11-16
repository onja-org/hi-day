import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActivitySampleItemDto } from '../activity-sample-item.dto';

const SAMPLE = {
  activePercentage: 75,
  periodStart: '2026-11-10T09:00:00.000Z',
  periodEnd: '2026-11-10T09:10:00.000Z',
};

async function errorsFor(payload: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(
    plainToInstance(ActivitySampleItemDto, payload),
  );
  return errors.map((error) => error.property);
}

describe('ActivitySampleItemDto input counts', () => {
  it('accepts a sample from an agent that predates counting', async () => {
    await expect(errorsFor(SAMPLE)).resolves.toEqual([]);
  });

  it('accepts counts, and null for counts the agent could not collect', async () => {
    await expect(
      errorsFor({
        ...SAMPLE,
        keystrokes: 412,
        mouseClicks: 37,
        mouseMovement: 18400,
      }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor({
        ...SAMPLE,
        keystrokes: null,
        mouseClicks: null,
        mouseMovement: null,
      }),
    ).resolves.toEqual([]);
  });

  it('rejects negative or fractional counts', async () => {
    await expect(
      errorsFor({
        ...SAMPLE,
        keystrokes: -1,
        mouseClicks: 1.5,
        mouseMovement: 10,
      }),
    ).resolves.toEqual(['keystrokes', 'mouseClicks']);
  });
});
