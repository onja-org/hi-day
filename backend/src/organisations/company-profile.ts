export type Industry =
  | 'software_it'
  | 'consulting'
  | 'marketing_advertising'
  | 'design'
  | 'finance'
  | 'healthcare'
  | 'education'
  | 'construction'
  | 'legal'
  | 'retail'
  | 'manufacturing'
  | 'non_profit'
  | 'government'
  | 'media'
  | 'other';

export const INDUSTRY_VALUES: readonly Industry[] = [
  'software_it',
  'consulting',
  'marketing_advertising',
  'design',
  'finance',
  'healthcare',
  'education',
  'construction',
  'legal',
  'retail',
  'manufacturing',
  'non_profit',
  'government',
  'media',
  'other',
];

/** Which day a week begins on wherever the product groups time by week. */
export type WeekStart = 'sunday' | 'monday';

export const WEEK_START_VALUES: readonly WeekStart[] = ['sunday', 'monday'];

/**
 * Monday, because the frontend was already hardcoded to it while the
 * dashboard services were independently hardcoded to Sunday — this settles
 * that split in favour of the convention more of the UI followed.
 */
export const DEFAULT_WEEK_START: WeekStart = 'monday';

/** The only check made: no country is stored, so no format to validate. */
export const TAX_ID_MAX_LENGTH = 64;
