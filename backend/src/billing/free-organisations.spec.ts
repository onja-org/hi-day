import { parseFreeOrganisationIds } from './free-organisations';

describe('parseFreeOrganisationIds', () => {
  it('is empty when the variable is unset or blank', () => {
    expect(parseFreeOrganisationIds(undefined).size).toBe(0);
    expect(parseFreeOrganisationIds('').size).toBe(0);
  });

  it('reads one id, and several separated by commas', () => {
    expect([...parseFreeOrganisationIds('100018')]).toEqual([100018]);
    expect([...parseFreeOrganisationIds('100018,100042')]).toEqual([
      100018, 100042,
    ]);
  });

  it('tolerates the spacing someone editing config will actually use', () => {
    expect([...parseFreeOrganisationIds(' 100018 , 100042 ')]).toEqual([
      100018, 100042,
    ]);
  });

  it('drops a malformed entry rather than refusing to boot', () => {
    expect([...parseFreeOrganisationIds('100018,oops,,-5,0')]).toEqual([
      100018,
    ]);
  });
});
