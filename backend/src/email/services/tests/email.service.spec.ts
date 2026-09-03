import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../email.service';

const sendMock = jest
  .fn()
  .mockResolvedValue({ data: { id: 'email-id' }, error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    sendMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              ({
                RESEND_API_KEY: 're_test_key',
                EMAIL_SENDER: 'noreply@example.com',
                FRONTEND_URL: 'http://localhost:3000',
              })[key],
          },
        },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('sends a set-password email with a link containing the token', async () => {
    await service.sendSetPasswordEmail('owner@acme.test', 'the-token');

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@acme.test',
        html: expect.stringContaining(
          'http://localhost:3000/set-password?token=the-token',
        ) as string,
      }),
    );
  });

  it('sends an invitation email with a link containing the token and org name', async () => {
    await service.sendInvitationEmail(
      'invitee@acme.test',
      'the-token',
      'Acme Inc',
    );

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@acme.test',
        subject: expect.stringContaining('Acme Inc') as string,
        html: expect.stringContaining(
          'http://localhost:3000/accept-invitation?token=the-token',
        ) as string,
      }),
    );
  });

  it('sends a duplicate-registration notice with a link to sign in', async () => {
    await service.sendDuplicateRegistrationNotice('owner@acme.test');

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@acme.test',
        subject: expect.stringMatching(/tried to register/i) as string,
        html: expect.stringContaining('http://localhost:3000/login') as string,
      }),
    );
  });

  it('logs, but does not throw, when Resend returns an error', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'invalid_api_key', message: 'Invalid API key' },
    });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.sendSetPasswordEmail('owner@acme.test', 'the-token'),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid API key') as string,
    );
    errorSpy.mockRestore();
  });
});
