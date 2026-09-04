export type IdleHandling = 'off' | 'flag' | 'auto_subtract';

export const IDLE_HANDLING_VALUES: IdleHandling[] = [
  'off',
  'flag',
  'auto_subtract',
];

export interface IdlePolicy {
  handling: IdleHandling;
  thresholdMinutes: number;
}

/**
 * Applied whenever an Organisation hasn't explicitly set an idle policy
 * (including every org created before this existed) — `flag` rather than
 * `auto_subtract` is the deliberately less invasive default: the epic's own
 * risk notes call out that a false positive ("watching a video is not idle
 * work") silently cutting someone's tracked time is exactly the kind of
 * thing that erodes trust in the product, so silence isn't the default
 * behaviour, only something an org opts into.
 */
export const DEFAULT_IDLE_POLICY: IdlePolicy = {
  handling: 'flag',
  thresholdMinutes: 5,
};
