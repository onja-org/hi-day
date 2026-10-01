import { describe, expect, it } from 'vitest';
import {
  ActivitySampler,
  PERIOD_MS,
  SEGMENT_MS,
} from '../activity-sampler';
import type { ActivitySample } from '../activity-sampler';

describe('ActivitySampler', () => {
  function makeSampler(idleSecondsPerTick: number[]) {
    const samples: ActivitySample[] = [];
    let clock = Date.parse('2026-09-08T09:00:00.000Z');
    let tick = 0;

    const sampler = new ActivitySampler(
      (sample) => {
        samples.push(sample);
      },
      {
        readIdleSeconds: () =>
          Promise.resolve(idleSecondsPerTick[tick++] ?? 0),
        now: () => clock,
      },
    );

    async function advance(ticks: number): Promise<void> {
      for (let i = 0; i < ticks; i += 1) {
        await sampler.tick();
        clock += SEGMENT_MS;
      }
    }

    return { sampler, samples, advance };
  }

  const SEGMENTS = PERIOD_MS / SEGMENT_MS;

  it('emits nothing until a period closes', async () => {
    const { samples, advance } = makeSampler((Array(SEGMENTS) as number[]).fill(0));

    await advance(SEGMENTS - 1);

    expect(samples).toEqual([]);
  });

  it('reports 100% when every segment saw input', async () => {
    const { samples, advance } = makeSampler((Array(SEGMENTS) as number[]).fill(0));

    await advance(SEGMENTS);

    expect(samples).toHaveLength(1);
    expect(samples[0].activePercentage).toBe(100);
  });

  // The whole method in one line: a segment is active when the last input
  // landed inside it, which is what an idle reading below the segment
  // length means.
  it('counts a segment inactive when idle exceeds the segment length', async () => {
    const idle: number[] = (Array(SEGMENTS) as number[]).fill(0);
    for (let i = 0; i < SEGMENTS / 2; i += 1) idle[i] = 30;
    const { samples, advance } = makeSampler(idle);

    await advance(SEGMENTS);

    expect(samples[0].activePercentage).toBe(50);
  });

  it('spans exactly one period', async () => {
    const { samples, advance } = makeSampler((Array(SEGMENTS) as number[]).fill(0));

    await advance(SEGMENTS);

    const { periodStart, periodEnd } = samples[0];
    expect(Date.parse(periodEnd) - Date.parse(periodStart)).toBe(PERIOD_MS);
  });

  it('starts a fresh period after emitting', async () => {
    const { samples, advance } = makeSampler((Array(SEGMENTS * 2) as number[]).fill(0));

    await advance(SEGMENTS * 2);

    expect(samples).toHaveLength(2);
    expect(samples[1].periodStart).toBe(samples[0].periodEnd);
  });

  // Scaling a half-finished period up to sixty segments would report a
  // busier ten minutes than actually happened.
  it('flushes a partial period without scaling it up', async () => {
    const { sampler, samples, advance } = makeSampler(
      (Array(SEGMENTS) as number[]).fill(0),
    );

    await advance(SEGMENTS / 2);
    await sampler.flush();

    expect(samples).toHaveLength(1);
    expect(samples[0].activePercentage).toBe(50);
  });

  it('flushes nothing when no segment was seen', async () => {
    const { sampler, samples } = makeSampler([]);

    await sampler.flush();

    expect(samples).toEqual([]);
  });
});
