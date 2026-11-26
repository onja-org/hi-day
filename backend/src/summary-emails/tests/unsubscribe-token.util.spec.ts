import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../unsubscribe-token.util';

const target = {
  membershipId: '3f1c2a8e-5b7d-4c9a-8e2f-1a2b3c4d5e6f',
  kind: 'team-daily' as const,
};

describe('unsubscribe tokens', () => {
  it('round-trips', () => {
    const token = createUnsubscribeToken(target, 'secret');
    expect(verifyUnsubscribeToken(token, 'secret')).toEqual(target);
  });

  it('rejects a token signed with another secret', () => {
    const token = createUnsubscribeToken(target, 'secret');
    expect(verifyUnsubscribeToken(token, 'other')).toBeNull();
  });

  it('rejects a token whose target was changed', () => {
    const token = createUnsubscribeToken(target, 'secret');
    const tampered = token.replace('team-daily', 'personal-daily');
    expect(verifyUnsubscribeToken(tampered, 'secret')).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyUnsubscribeToken('', 'secret')).toBeNull();
    expect(verifyUnsubscribeToken('a.b.c', 'secret')).toBeNull();
    expect(
      verifyUnsubscribeToken(`${target.membershipId}.bogus.xyz`, 'secret'),
    ).toBeNull();
  });
});
