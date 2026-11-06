import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListScreenshotsDto } from '../list-screenshots.dto';

/** Query strings arrive as strings, exactly as Nest hands them over. */
async function parse(query: Record<string, string>) {
  const dto = plainToInstance(ListScreenshotsDto, query);
  const errors = await validate(dto);
  return { dto, invalid: errors.map((error) => error.property) };
}

describe('ListScreenshotsDto', () => {
  it('accepts no query at all', async () => {
    await expect(parse({})).resolves.toMatchObject({ invalid: [] });
  });

  it('turns page and pageSize into numbers', async () => {
    const { dto, invalid } = await parse({
      date: '2026-09-08',
      projectId: 'project-1',
      page: '2',
      pageSize: '8',
    });

    expect(invalid).toEqual([]);
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(8);
  });

  it('rejects a page that is not a positive whole number', async () => {
    for (const page of ['0', '-1', '1.5', 'abc']) {
      await expect(parse({ page })).resolves.toMatchObject({
        invalid: ['page'],
      });
    }
  });

  // Each item costs a signed URL and an image download, so a client can't
  // ask for the whole day in one page.
  it('rejects a page size outside 1–48', async () => {
    for (const pageSize of ['0', '49', 'abc']) {
      await expect(parse({ pageSize })).resolves.toMatchObject({
        invalid: ['pageSize'],
      });
    }
    await expect(parse({ pageSize: '48' })).resolves.toMatchObject({
      invalid: [],
    });
  });

  it('accepts oldest-first or newest-first, and nothing else', async () => {
    await expect(parse({ order: 'oldest' })).resolves.toMatchObject({
      invalid: [],
    });
    await expect(parse({ order: 'newest' })).resolves.toMatchObject({
      invalid: [],
    });
    await expect(parse({ order: 'random' })).resolves.toMatchObject({
      invalid: ['order'],
    });
  });
});
