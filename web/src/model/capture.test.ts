import { describe, expect, it } from 'vitest';
import { captureWindow, describeTrigger, samplesNeeded, validateSettings, type CaptureSettings } from './capture';

const base: CaptureSettings = {
  gpios: [0, 1, 2, 3],
  sampleRateHz: 10_000,
  durationNs: 2e9,
  preTriggerNs: 200e6,
  trigger: { type: 'edge', gpio: 0, edge: 'rising' },
};

describe('capture model', () => {
  it('computes the window and the samples per input', () => {
    expect(captureWindow(base)).toEqual({ preNs: 200e6, postNs: 2e9 });
    expect(samplesNeeded(base)).toBe(22_000);
  });

  it('accepts settings an 8-input 24 MS/s analyzer can do', () => {
    expect(validateSettings(base)).toEqual([]);
  });

  it('rejects more than 8 inputs or more than 24 MS/s', () => {
    expect(validateSettings({ ...base, gpios: [0, 1, 2, 3, 4, 5, 6, 7, 8] })).toHaveLength(1);
    expect(validateSettings({ ...base, sampleRateHz: 100_000_000 })).toHaveLength(1);
  });

  it('rejects a trigger on a pin that is not recorded', () => {
    expect(validateSettings({ ...base, trigger: { type: 'edge', gpio: 7, edge: 'rising' } })).toHaveLength(1);
    expect(
      validateSettings({ ...base, trigger: { type: 'pattern', levels: [{ gpio: 0, level: 1 }, { gpio: 9, level: 1 }] } }),
    ).toHaveLength(1);
  });

  it('describes triggers in plain words', () => {
    expect(describeTrigger({ type: 'edge', gpio: 17, edge: 'falling' })).toBe('Falling edge on GP17 (CS)');
    expect(describeTrigger({ type: 'pattern', levels: [{ gpio: 8, level: 1 }, { gpio: 9, level: 0 }] })).toBe(
      'GP8 high and GP9 low',
    );
  });
});
