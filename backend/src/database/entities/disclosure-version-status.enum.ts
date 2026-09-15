/**
 * `draft` rows are freely mutable and never seen by anyone but the editing
 * admin — publishing snapshots a draft's text into a new, immutable
 * `published` row (see DisclosureVersion's own doc comment). Only
 * `published` rows are ever resolved for consent/display purposes.
 */
export enum DisclosureVersionStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}
