import { findBehaviourChanges, PeriodFigures } from '../behaviour-change.util';

const figures = (overrides: Partial<PeriodFigures> = {}): PeriodFigures => ({
  coreWorkShare: null,
  activityPercentage: null,
  focusSeconds: null,
  ...overrides,
});

describe('findBehaviourChanges', () => {
  it('notes a metric that moved 15% or more from the average of the earlier periods', () => {
    const changes = findBehaviourChanges(figures({ coreWorkShare: 0.4 }), [
      figures({ coreWorkShare: 0.5 }),
      figures({ coreWorkShare: 0.6 }),
      figures({ coreWorkShare: 0.4 }),
    ]);

    expect(changes).toEqual([
      {
        metric: 'core_work',
        direction: 'lower',
        changePercent: 20,
        current: 0.4,
        average: 0.5,
      },
    ]);
  });

  it('says nothing about a move under 15%', () => {
    const changes = findBehaviourChanges(figures({ activityPercentage: 57 }), [
      figures({ activityPercentage: 50 }),
    ]);

    expect(changes).toEqual([]);
  });

  it('notes a move of exactly 15%, up as well as down', () => {
    const changes = findBehaviourChanges(figures({ focusSeconds: 4600 }), [
      figures({ focusSeconds: 4000 }),
    ]);

    expect(changes).toEqual([
      expect.objectContaining({
        metric: 'focus_time',
        direction: 'higher',
        changePercent: 15,
      }),
    ]);
  });

  it('averages only the earlier periods that measured the metric', () => {
    const changes = findBehaviourChanges(figures({ activityPercentage: 60 }), [
      figures({ activityPercentage: 40 }),
      figures(),
      figures(),
    ]);

    expect(changes).toEqual([
      expect.objectContaining({ changePercent: 50, average: 40 }),
    ]);
  });

  it('says nothing when the earlier periods measured nothing, so a new member gets no notes', () => {
    const changes = findBehaviourChanges(
      figures({ coreWorkShare: 0.9, activityPercentage: 80, focusSeconds: 1 }),
      [figures(), figures(), figures()],
    );

    expect(changes).toEqual([]);
  });

  it('says nothing about a metric the current period did not measure', () => {
    const changes = findBehaviourChanges(figures(), [
      figures({ coreWorkShare: 0.5, activityPercentage: 50, focusSeconds: 60 }),
    ]);

    expect(changes).toEqual([]);
  });

  it('says nothing when the average is zero, since no percentage of it can be given', () => {
    const changes = findBehaviourChanges(figures({ focusSeconds: 3600 }), [
      figures({ focusSeconds: 0 }),
    ]);

    expect(changes).toEqual([]);
  });

  it('notes a drop to zero as 100% lower', () => {
    const changes = findBehaviourChanges(figures({ focusSeconds: 0 }), [
      figures({ focusSeconds: 3600 }),
    ]);

    expect(changes).toEqual([
      expect.objectContaining({ direction: 'lower', changePercent: 100 }),
    ]);
  });

  it('checks each metric on its own, in a fixed order', () => {
    const changes = findBehaviourChanges(
      figures({
        coreWorkShare: 0.5,
        activityPercentage: 30,
        focusSeconds: 900,
      }),
      [
        figures({
          coreWorkShare: 0.5,
          activityPercentage: 60,
          focusSeconds: 600,
        }),
      ],
    );

    expect(changes.map((change) => change.metric)).toEqual([
      'activity',
      'focus_time',
    ]);
  });
});
