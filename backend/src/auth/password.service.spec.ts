import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password and verifies the same password against it', async () => {
    const hash = await service.hash('a-very-long-password-123');

    expect(hash).not.toEqual('a-very-long-password-123');
    await expect(
      service.verify(hash, 'a-very-long-password-123'),
    ).resolves.toBe(true);
  });

  it('rejects an incorrect password against a valid hash', async () => {
    const hash = await service.hash('a-very-long-password-123');

    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });
});
