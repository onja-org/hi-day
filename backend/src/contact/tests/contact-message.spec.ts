import {
  isValidWebsite,
  looksAutomated,
  MESSAGE_MAX_LENGTH,
  MESSAGE_MIN_LENGTH,
  normaliseWebsite,
  validateContactMessage,
} from '../contact-message';

function input(overrides: Record<string, unknown> = {}) {
  return {
    email: 'someone@acme.test',
    website: 'acme.com',
    phone: '',
    message: 'We are a team of forty and want to know about seats.',
    ...overrides,
  };
}

describe('normaliseWebsite', () => {
  it('adds https where no protocol was typed', () => {
    expect(normaliseWebsite('acme.com')).toBe('https://acme.com');
    expect(normaliseWebsite('  acme.com/pricing  ')).toBe(
      'https://acme.com/pricing',
    );
  });

  // Rewriting http:// would be a claim about their server, not ours.
  it('leaves a protocol somebody typed alone', () => {
    expect(normaliseWebsite('http://acme.com')).toBe('http://acme.com');
    expect(normaliseWebsite('https://acme.com')).toBe('https://acme.com');
  });

  it('leaves an empty value empty rather than inventing a host', () => {
    expect(normaliseWebsite('')).toBe('');
    expect(normaliseWebsite('   ')).toBe('');
  });
});

describe('isValidWebsite', () => {
  it('accepts a real host', () => {
    expect(isValidWebsite('https://acme.com')).toBe(true);
    expect(isValidWebsite('https://sub.acme.co.uk/path?q=1')).toBe(true);
  });

  // Fine in a browser, not somewhere a company's website lives.
  it('refuses a host with no dot', () => {
    expect(isValidWebsite('https://localhost')).toBe(false);
  });

  it('refuses a protocol that is not web', () => {
    expect(isValidWebsite('ftp://acme.com')).toBe(false);
    expect(isValidWebsite('javascript:alert(1)')).toBe(false);
  });

  it('refuses nonsense', () => {
    expect(isValidWebsite('https://')).toBe(false);
    expect(isValidWebsite('https://.com')).toBe(false);
    expect(isValidWebsite('not a url')).toBe(false);
  });
});

describe('validateContactMessage', () => {
  it('accepts a filled-in form', () => {
    expect(validateContactMessage(input())).toEqual({});
  });

  it('requires an email, and a plausible one', () => {
    expect(validateContactMessage(input({ email: '' })).email).toMatch(
      /Enter your/,
    );
    expect(validateContactMessage(input({ email: 'nope' })).email).toMatch(
      /valid/,
    );
    expect(validateContactMessage(input({ email: 'a@b' })).email).toMatch(
      /valid/,
    );
  });

  it('requires a website, and validates it after the protocol is added', () => {
    expect(validateContactMessage(input({ website: '' })).website).toMatch(
      /Enter your/,
    );
    expect(
      validateContactMessage(input({ website: 'localhost' })).website,
    ).toMatch(/valid/);
    // The point of normalising: this is accepted without a protocol.
    expect(
      validateContactMessage(input({ website: 'acme.com' })).website,
    ).toBeUndefined();
  });

  describe('the phone, which is optional', () => {
    it('accepts it being absent', () => {
      expect(
        validateContactMessage(input({ phone: '' })).phone,
      ).toBeUndefined();
      expect(
        validateContactMessage(input({ phone: undefined })).phone,
      ).toBeUndefined();
    });

    it('accepts the characters a phone number is written with', () => {
      expect(
        validateContactMessage(input({ phone: '+44 (0)20 7946 0100' })).phone,
      ).toBeUndefined();
    });

    it('refuses anything that could be an address or a sentence', () => {
      expect(validateContactMessage(input({ phone: 'call me' })).phone).toMatch(
        /digits/,
      );
      expect(validateContactMessage(input({ phone: 'a@b.com' })).phone).toMatch(
        /digits/,
      );
    });

    it('holds it between seven and twenty characters', () => {
      expect(validateContactMessage(input({ phone: '12345' })).phone).toMatch(
        /between/,
      );
      expect(
        validateContactMessage(input({ phone: '1'.repeat(21) })).phone,
      ).toMatch(/between/);
    });
  });

  describe('the message', () => {
    it('wants at least ten characters of it', () => {
      expect(validateContactMessage(input({ message: 'hi' })).message).toMatch(
        /at least 10/,
      );
      expect(
        validateContactMessage(
          input({ message: 'a'.repeat(MESSAGE_MIN_LENGTH) }),
        ).message,
      ).toBeUndefined();
    });

    it('stops at two thousand', () => {
      expect(
        validateContactMessage(
          input({ message: 'a'.repeat(MESSAGE_MAX_LENGTH) }),
        ).message,
      ).toBeUndefined();
      expect(
        validateContactMessage(
          input({ message: 'a'.repeat(MESSAGE_MAX_LENGTH + 1) }),
        ).message,
      ).toMatch(/under 2000/);
    });

    // Whitespace is not a message.
    it('does not count spaces towards the minimum', () => {
      expect(
        validateContactMessage(input({ message: '          ' })).message,
      ).toMatch(/at least/);
    });
  });

  it('reports every bad field at once, not the first', () => {
    const errors = validateContactMessage({
      email: 'nope',
      website: '',
      phone: 'call me',
      message: 'hi',
    });
    expect(Object.keys(errors).sort()).toEqual([
      'email',
      'message',
      'phone',
      'website',
    ]);
  });
});

describe('looksAutomated', () => {
  // A real person never sees the field, so anything in it is a bot.
  it('catches a filled honeypot', () => {
    expect(looksAutomated(input({ company: 'Acme' }))).toBe(true);
  });

  it('leaves a person alone', () => {
    expect(looksAutomated(input())).toBe(false);
    expect(looksAutomated(input({ company: '' }))).toBe(false);
    expect(looksAutomated(input({ company: '   ' }))).toBe(false);
  });
});
