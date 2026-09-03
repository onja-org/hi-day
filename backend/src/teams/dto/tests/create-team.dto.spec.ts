import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTeamDto } from '../create-team.dto';

describe('CreateTeamDto', () => {
  it('accepts a non-empty name', async () => {
    const dto = plainToInstance(CreateTeamDto, { name: 'Engineering' });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty name', async () => {
    const dto = plainToInstance(CreateTeamDto, { name: '' });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('rejects a missing name', async () => {
    const dto = plainToInstance(CreateTeamDto, {});

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });
});
