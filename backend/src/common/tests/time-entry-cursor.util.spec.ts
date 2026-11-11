import {
  decodeTimeEntryCursor,
  encodeTimeEntryCursor,
} from '../time-entry-cursor.util';

describe('time entry cursor', () => {
  it('round-trips a startedAt and id', () => {
    const cursor = {
      startedAt: new Date('2026-03-01T08:15:00.000Z'),
      id: '0b7c2f5e-1d1a-4a39-9a51-2a8b1f0c9d11',
    };

    expect(decodeTimeEntryCursor(encodeTimeEntryCursor(cursor))).toEqual(
      cursor,
    );
  });

  it.each([
    '',
    'nonsense',
    '_abc',
    '2026-03-01T08:15:00.000Z_',
    'notadate_abc',
  ])('rejects %p', (raw) => {
    expect(decodeTimeEntryCursor(raw)).toBeNull();
  });
});
