import { describe, expect, it } from 'vitest';
import { captureWindow, describeTrigger, modeFor, validateSettings, type CaptureSettings } from './analyzer';

const base: CaptureSettings = {
  channels: [1, 2, 3, 4],
  sampleRateHz: 10_000,
  preSamples: 2000,
  postSamples: 20000,
  trigger: { type: 'edge', channel: 1, edge: 'rising' },
};

describe('analyzer model', () => {
  it('picks the channel mode from the highest channel', () => {
    expect(modeFor([1, 8]).maxChannel).toBe(8);
    expect(modeFor([9]).maxChannel).toBe(16);
    expect(modeFor([1, 24]).maxChannel).toBe(24);
  });

  it('computes the capture window', () => {
    expect(captureWindow(base)).toEqual({ preNs: 200e6, postNs: 2e9 });
  });

  it('accepts valid settings', () => {
    expect(validateSettings(base)).toEqual([]);
  });

  it('rejects too many samples for the channel mode', () => {
    const issues = validateSettings({ ...base, channels: [9, 10], trigger: { type: 'edge', channel: 9, edge: 'rising' }, postSamples: 100000 });
    expect(issues.length).toBe(1);
    expect(issues[0]).toMatch(/65533/);
  });

  it('rejects a trigger on a disabled channel', () => {
    expect(validateSettings({ ...base, trigger: { type: 'edge', channel: 7, edge: 'rising' } })).toHaveLength(1);
  });

  it('limits pattern triggers to channels 1-16', () => {
    const s: CaptureSettings = { ...base, channels: [16, 17], trigger: { type: 'pattern', firstChannel: 16, pattern: '11' } };
    expect(validateSettings(s).some((i) => i.includes('1 to 16'))).toBe(true);
  });

  it('describes triggers in app terms', () => {
    expect(describeTrigger({ type: 'pattern', firstChannel: 9, pattern: '11' })).toBe(
      'Pattern trigger, first channel 9, pattern "11" (channels 9 to 10)',
    );
  });
});
