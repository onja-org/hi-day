import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestInviteLinkJoinDto } from '../request-invite-link-join.dto';

describe('RequestInviteLinkJoinDto', () => {
  it('trims and lowercases the email, and it still validates', async () => {
    const dto = plainToInstance(RequestInviteLinkJoinDto, {
      email: '  Jane@Corp.COM ',
    });

    expect(dto.email).toBe('jane@corp.com');
    await expect(validate(dto)).resolves.toEqual([]);
  });
});
