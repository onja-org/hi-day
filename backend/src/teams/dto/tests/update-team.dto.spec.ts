import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTeamDto } from '../update-team.dto';

describe('UpdateTeamDto', () => {
  it('accepts a non-empty name', async () => {
    const dto = plainToInstance(UpdateTeamDto, { name: 'Engineering' });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty name', async () => {
    const dto = plainToInstance(UpdateTeamDto, { name: '' });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });
});
