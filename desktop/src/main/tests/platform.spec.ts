import { describe, expect, it } from 'vitest';
import { toDevicePlatform } from '../platform';

describe('toDevicePlatform', () => {
  it('maps win32 to windows', () => {
    expect(toDevicePlatform('win32')).toBe('windows');
  });

  it('maps darwin to macos', () => {
    expect(toDevicePlatform('darwin')).toBe('macos');
  });

  it('maps linux to linux', () => {
    expect(toDevicePlatform('linux')).toBe('linux');
  });

  it('throws for an unsupported platform', () => {
    expect(() => toDevicePlatform('aix')).toThrow('Unsupported desktop platform: aix');
  });
});
