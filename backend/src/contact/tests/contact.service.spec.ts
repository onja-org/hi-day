import { ContactService } from '../services/contact.service';

function serviceFor({
  noRecipient = false,
  sendThrows = false,
}: { noRecipient?: boolean; sendThrows?: boolean } = {}) {
  // A flag rather than `recipient: undefined`: a destructuring default
  // treats undefined as absent and would quietly hand back the real address.
  const recipient = noRecipient ? undefined : 'owner@example.com';
  const sendContactMessage = jest.fn(() =>
    sendThrows
      ? Promise.reject(new Error('resend is down'))
      : Promise.resolve(),
  );
  /** The arguments it was called with. `jest.fn()` with no parameters types
   * its recorded calls as `[]`, so reading them needs this. */
  const callArgs = () =>
    sendContactMessage.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
  const service = new ContactService(
    { get: () => recipient } as never,
    { sendContactMessage } as never,
  );
  return { service, sendContactMessage, callArgs };
}

const MESSAGE = {
  email: 'someone@acme.test',
  website: 'acme.com',
  phone: ' +44 20 7946 0100 ',
  message: '  We are forty people and want to talk about seats.  ',
};

describe('sending a contact message', () => {
  it('sends it, trimmed, with the website normalised', async () => {
    const { service, callArgs } = serviceFor();

    await expect(service.send(MESSAGE)).resolves.toEqual({ kind: 'sent' });

    const [to, body] = callArgs();
    expect(to).toBe('owner@example.com');
    expect(body).toMatchObject({
      email: 'someone@acme.test',
      // The protocol the person did not type.
      website: 'https://acme.com',
      phone: '+44 20 7946 0100',
      message: 'We are forty people and want to talk about seats.',
    });
    expect(body.sentAt).toBeInstanceOf(Date);
  });

  it('records an absent phone as nothing, not an empty string', async () => {
    const { service, callArgs } = serviceFor();

    await service.send({ ...MESSAGE, phone: '   ' });

    const [, body] = callArgs();
    expect(body.phone).toBeNull();
  });
});

describe('what it refuses', () => {
  it('reports field errors rather than sending', async () => {
    const { service, sendContactMessage } = serviceFor();

    const result = await service.send({ ...MESSAGE, email: 'nope' });

    expect(result).toMatchObject({ kind: 'invalid' });
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  /**
   * A bot told "invalid" learns which field is the trap and leaves it empty
   * next time. One told "sent" has no reason to come back.
   */
  it('accepts a honeypot submission and silently drops it', async () => {
    const { service, sendContactMessage } = serviceFor();

    const result = await service.send({ ...MESSAGE, company: 'Acme Ltd' });

    expect(result).toEqual({ kind: 'ignored' });
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  // Checked before the rules, so a bot cannot tell the trap apart from a
  // validation failure by the shape of the answer.
  it('drops a honeypot submission even when the rest is invalid', async () => {
    const { service } = serviceFor();

    await expect(
      service.send({ email: '', website: '', message: '', company: 'x' }),
    ).resolves.toEqual({ kind: 'ignored' });
  });
});

describe('when it cannot send', () => {
  // Refused per request and logged, rather than thrown at boot: a missing
  // address must not take down an install that never uses this form.
  it('fails loudly where no recipient is configured', async () => {
    const { service, sendContactMessage } = serviceFor({ noRecipient: true });

    await expect(service.send(MESSAGE)).resolves.toEqual({ kind: 'failed' });
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  // The person is told to try again rather than told it worked.
  it('fails when the provider refuses it', async () => {
    const { service } = serviceFor({ sendThrows: true });

    await expect(service.send(MESSAGE)).resolves.toEqual({ kind: 'failed' });
  });
});
