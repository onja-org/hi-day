import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVITY_PERIOD_MS,
  SEGMENTS_PER_PERIOD,
  SEGMENT_DURATION_MS,
  computeActivePercentage,
  resolveActivityPeriodMs,
  segmentIndexForOffset,
} from '../activity-sample';

describe('segmentIndexForOffset', () => {
  it('maps an offset of 0 to segment 0', () => {
    expect(segmentIndexForOffset(0)).toBe(0);
  });

  it('maps an offset within the first 10s to segment 0', () => {
    expect(segmentIndexForOffset(SEGMENT_DURATION_MS - 1)).toBe(0);
  });

  it('maps an offset exactly at a segment boundary to the next segment', () => {
    expect(segmentIndexForOffset(SEGMENT_DURATION_MS)).toBe(1);
    expect(segmentIndexForOffset(SEGMENT_DURATION_MS * 5)).toBe(5);
  });

  it('clamps an offset past the period end to the last segment, rather than indexing out of range', () => {
    expect(
      segmentIndexForOffset(SEGMENT_DURATION_MS * SEGMENTS_PER_PERIOD + 5_000),
    ).toBe(SEGMENTS_PER_PERIOD - 1);
  });

  it('clamps a negative offset (clock skew) to segment 0', () => {
    expect(segmentIndexForOffset(-500)).toBe(0);
  });

  it('scales segment duration to a custom period, keeping 60 segments total', () => {
    const oneMinute = 60_000;
    const segmentDuration = oneMinute / SEGMENTS_PER_PERIOD; // 1s
    expect(segmentIndexForOffset(0, oneMinute)).toBe(0);
    expect(segmentIndexForOffset(segmentDuration, oneMinute)).toBe(1);
    expect(segmentIndexForOffset(oneMinute + 5_000, oneMinute)).toBe(
      SEGMENTS_PER_PERIOD - 1,
    );
  });
});

describe('resolveActivityPeriodMs', () => {
  it('defaults to the 10-minute period when unset', () => {
    expect(resolveActivityPeriodMs({})).toBe(DEFAULT_ACTIVITY_PERIOD_MS);
  });

  it('uses DESKTOP_ACTIVITY_PERIOD_MS when set to a valid positive number', () => {
    expect(resolveActivityPeriodMs({ DESKTOP_ACTIVITY_PERIOD_MS: '60000' })).toBe(
      60_000,
    );
  });

  it('falls back to the default for a non-numeric or non-positive value', () => {
    expect(
      resolveActivityPeriodMs({ DESKTOP_ACTIVITY_PERIOD_MS: 'not-a-number' }),
    ).toBe(DEFAULT_ACTIVITY_PERIOD_MS);
    expect(resolveActivityPeriodMs({ DESKTOP_ACTIVITY_PERIOD_MS: '0' })).toBe(
      DEFAULT_ACTIVITY_PERIOD_MS,
    );
    expect(resolveActivityPeriodMs({ DESKTOP_ACTIVITY_PERIOD_MS: '-5' })).toBe(
      DEFAULT_ACTIVITY_PERIOD_MS,
    );
  });
});

describe('computeActivePercentage', () => {
  it('is 0 when no segment saw any input, matching Hubstaff\'s own "no input the whole period" case', () => {
    expect(computeActivePercentage(new Set())).toBe(0);
  });

  it('is 100 when every one of the 60 segments saw input', () => {
    const all = new Set(Array.from({ length: SEGMENTS_PER_PERIOD }, (_, i) => i));
    expect(computeActivePercentage(all)).toBe(100);
  });

  it('matches Hubstaff\'s own worked example: 8 of 60 segments (80s of 600s) is ~13%', () => {
    const segments = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(computeActivePercentage(segments)).toBe(13);
  });

  it('rounds to the nearest whole percent', () => {
    // 30/60 = 50% exactly; 1/60 ≈ 1.67%, rounds to 2%.
    expect(
      computeActivePercentage(
        new Set(Array.from({ length: 30 }, (_, i) => i)),
      ),
    ).toBe(50);
    expect(computeActivePercentage(new Set([0]))).toBe(2);
  });

  it('counts each segment index only once, no matter how many inputs landed in it', () => {
    const segments = new Set<number>();
    segments.add(3);
    segments.add(3);
    segments.add(3);
    expect(computeActivePercentage(segments)).toBe(2); // 1/60 rounded
  });
});
