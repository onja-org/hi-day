import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMembershipDto } from '../update-membership.dto';

async function errorsFor(payload: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(UpdateMembershipDto, payload);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('UpdateMembershipDto work time limits', () => {
  it('accepts null, which is "no limit"', async () => {
    await expect(
      errorsFor({ dailyLimitHours: null, weeklyLimitHours: null }),
    ).resolves.toEqual([]);
  });

  it('accepts a real ceiling', async () => {
    await expect(errorsFor({ dailyLimitHours: 7.5 })).resolves.toEqual([]);
  });

  it('rejects a limit that rounds to zero in the column', async () => {
    // numeric(5,2) stores 0.001 as 0.00, which would forbid tracking
    // outright rather than cap it.
    await expect(errorsFor({ dailyLimitHours: 0.001 })).resolves.toEqual([
      'dailyLimitHours',
    ]);
    await expect(errorsFor({ weeklyLimitHours: 0 })).resolves.toEqual([
      'weeklyLimitHours',
    ]);
  });
});
