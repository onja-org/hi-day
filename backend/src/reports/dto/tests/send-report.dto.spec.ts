import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendReportDto } from '../send-report.dto';

const valid = {
  emails: ['a@example.com'],
  subject: 'Weekly report',
  message: 'Here you go',
  fileType: 'csv',
  filename: 'time-and-activity.csv',
  contentBase64: Buffer.from('a,b').toString('base64'),
};

async function propertiesWithErrors(body: object): Promise<string[]> {
  const errors = await validate(plainToInstance(SendReportDto, body));
  return errors.map((error) => error.property);
}

describe('SendReportDto', () => {
  it('accepts a complete request', async () => {
    expect(await propertiesWithErrors(valid)).toEqual([]);
  });

  it('accepts a request without a message', async () => {
    const withoutMessage: Partial<typeof valid> = { ...valid };
    delete withoutMessage.message;
    expect(await propertiesWithErrors(withoutMessage)).toEqual([]);
  });

  it('rejects an empty recipient list', async () => {
    expect(await propertiesWithErrors({ ...valid, emails: [] })).toContain(
      'emails',
    );
  });

  it('rejects more than ten recipients', async () => {
    const emails = Array.from({ length: 11 }, (_, i) => `u${i}@example.com`);
    expect(await propertiesWithErrors({ ...valid, emails })).toContain(
      'emails',
    );
  });

  it('rejects a malformed recipient', async () => {
    expect(
      await propertiesWithErrors({ ...valid, emails: ['nope'] }),
    ).toContain('emails');
  });

  it('rejects a blank subject', async () => {
    expect(await propertiesWithErrors({ ...valid, subject: '' })).toContain(
      'subject',
    );
  });

  it('rejects an unsupported file type', async () => {
    expect(await propertiesWithErrors({ ...valid, fileType: 'exe' })).toContain(
      'fileType',
    );
  });

  it('rejects a filename with path characters or the wrong extension', async () => {
    expect(
      await propertiesWithErrors({ ...valid, filename: '../etc/passwd.csv' }),
    ).toContain('filename');
    expect(
      await propertiesWithErrors({ ...valid, filename: 'report.exe' }),
    ).toContain('filename');
  });

  it('rejects content that is not base64', async () => {
    expect(
      await propertiesWithErrors({ ...valid, contentBase64: 'not base64!!' }),
    ).toContain('contentBase64');
  });
});
