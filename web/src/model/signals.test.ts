import { describe, expect, it } from 'vitest';
import {
  idealTrace,
  levelAt,
  periodNs,
  sampledTrace,
  segmentTimeline,
  signalByGpio,
  signals,
} from './signals';

describe('signals.json', () => {
  it('has the ten default signals on GP0-GP9', () => {
    expect(signals.map((s) => s.gpio)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('periods match the actual frequency', () => {
    for (const s of signals) {
      expect(periodNs(s)).toBeCloseTo(1e9 / s.actualHz, 3);
    }
  });
});

describe('levelAt', () => {
  const sq = signalByGpio(3); // 1 kHz, 50%

  it('starts high at t = 0 and repeats', () => {
    expect(levelAt(sq, 0)).toBe(1);
    expect(levelAt(sq, 499_999)).toBe(1);
    expect(levelAt(sq, 500_000)).toBe(0);
    expect(levelAt(sq, 1_000_000)).toBe(1);
  });

  it('handles negative time (pre-trigger)', () => {
    expect(levelAt(sq, -1)).toBe(0);
    expect(levelAt(sq, -600_000)).toBe(1);
  });
});

describe('idealTrace', () => {
  it('lists every edge in the window', () => {
    const tr = idealTrace(signalByGpio(3), -100_000, 2_100_000);
    expect(tr.startLevel).toBe(0);
    expect(tr.edges.map((e) => e.t)).toEqual([0, 500_000, 1_000_000, 1_500_000, 2_000_000]);
    expect(tr.edges.map((e) => e.level)).toEqual([1, 0, 1, 0, 1]);
    expect(tr.dense).toBe(false);
  });

  it('flags windows with too many edges as dense', () => {
    const tr = idealTrace(signalByGpio(5), 0, 1e9, 100); // 100 kHz for 1 s
    expect(tr.dense).toBe(true);
    expect(tr.edges.length).toBe(100);
  });

  it('merges pattern segments with the same level', () => {
    const tr = idealTrace(signalByGpio(9), -1, 1_000_001);
    // 7 high segments per 1 ms frame: 7 rising and 7 falling edges, plus the next frame's start.
    expect(tr.edges.filter((e) => e.level === 1).length).toBe(8);
    expect(tr.edges.filter((e) => e.level === 0).length).toBe(7);
  });
});

describe('sampledTrace', () => {
  const sig = signalByGpio(5); // 100 kHz

  it('looks right when sampling well above the signal', () => {
    const tr = sampledTrace(sig, 0, 100_000, 10e6); // 10 periods at 10 MS/s
    expect(tr.edges.length).toBe(19);
  });

  it('aliases to 50 kHz when sampled at 150 kS/s', () => {
    const tr = sampledTrace(sig, 0, 1_000_000, 150e3); // 1 ms
    const rising = tr.edges.filter((e) => e.level === 1).length;
    // A real 100 kHz signal has 100 rising edges per ms; aliased it shows about 50.
    expect(rising).toBeGreaterThanOrEqual(49);
    expect(rising).toBeLessThanOrEqual(51);
  });
});

describe('segmentTimeline', () => {
  it('starts the pattern with the 10 us frame marker', () => {
    const rows = segmentTimeline(signalByGpio(9));
    expect(rows[0]).toEqual({ start: 0, level: 1, ns: 10_000 });
    expect(rows[rows.length - 1].start + rows[rows.length - 1].ns).toBeCloseTo(1_000_000, 6);
  });
});
