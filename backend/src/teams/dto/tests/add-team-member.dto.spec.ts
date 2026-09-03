import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddTeamMemberDto } from '../add-team-member.dto';

describe('AddTeamMemberDto', () => {
  it('accepts a membershipId with no isManager', async () => {
    const dto = plainToInstance(AddTeamMemberDto, {
      membershipId: '2b8b5b3a-9d0e-4a3a-8a3a-3b3a9d0e4a3a',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a membershipId with isManager', async () => {
    const dto = plainToInstance(AddTeamMemberDto, {
      membershipId: '2b8b5b3a-9d0e-4a3a-8a3a-3b3a9d0e4a3a',
      isManager: true,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-uuid membershipId', async () => {
    const dto = plainToInstance(AddTeamMemberDto, {
      membershipId: 'not-a-uuid',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'membershipId')).toBe(
      true,
    );
  });

  it('rejects a non-boolean isManager', async () => {
    const dto = plainToInstance(AddTeamMemberDto, {
      membershipId: '2b8b5b3a-9d0e-4a3a-8a3a-3b3a9d0e4a3a',
      isManager: 'yes',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'isManager')).toBe(true);
  });
});
