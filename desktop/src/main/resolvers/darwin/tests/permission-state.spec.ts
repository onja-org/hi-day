import { describe, expect, it } from 'vitest';
import { PermissionStateMachine } from '../permission-state';

describe('PermissionStateMachine', () => {
  it('starts every automation target and accessibility as unknown, screen recording as not-required', () => {
    const machine = new PermissionStateMachine();
    const snapshot = machine.get();
    expect(snapshot.automation).toEqual({
      'system-events': 'unknown',
      chrome: 'unknown',
      edge: 'unknown',
      brave: 'unknown',
      opera: 'unknown',
      vivaldi: 'unknown',
      safari: 'unknown',
    });
    expect(snapshot.accessibility).toBe('unknown');
    expect(snapshot.screenRecording).toBe('not-required');
  });

  it('observing a consent-denied outcome marks that target denied, others untouched', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('chrome', 'consent-denied');
    const snapshot = machine.get();
    expect(snapshot.automation.chrome).toBe('denied');
    expect(snapshot.automation.safari).toBe('unknown');
  });

  it('observing any non-consent-denied outcome marks that target granted', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('safari', null); // success
    machine.observeAppleEventsOutcome('chrome', 'no-window'); // reached the target, just nothing to read
    expect(machine.get().automation.safari).toBe('granted');
    expect(machine.get().automation.chrome).toBe('granted');
  });

  it('a later denied observation can downgrade a previously granted target', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('chrome', null);
    expect(machine.get().automation.chrome).toBe('granted');
    machine.observeAppleEventsOutcome('chrome', 'consent-denied');
    expect(machine.get().automation.chrome).toBe('denied');
  });

  it('setAccessibility/setScreenRecording update their own gate only', () => {
    const machine = new PermissionStateMachine();
    machine.setAccessibility('granted');
    expect(machine.get().accessibility).toBe('granted');
    expect(machine.get().automation.chrome).toBe('unknown');
  });

  it('resetAll reverts every gate to unknown, including previously denied ones, except not-required', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('chrome', 'consent-denied');
    machine.observeAppleEventsOutcome('safari', null);
    machine.setAccessibility('granted');

    machine.resetAll();

    const snapshot = machine.get();
    expect(snapshot.automation.chrome).toBe('unknown');
    expect(snapshot.automation.safari).toBe('unknown');
    expect(snapshot.accessibility).toBe('unknown');
    expect(snapshot.screenRecording).toBe('not-required'); // never touched by resetAll
  });

  it('accepts partial initial state without clobbering the rest', () => {
    const machine = new PermissionStateMachine({ accessibility: 'granted' });
    expect(machine.get().accessibility).toBe('granted');
    expect(machine.get().automation.chrome).toBe('unknown');
  });
});
