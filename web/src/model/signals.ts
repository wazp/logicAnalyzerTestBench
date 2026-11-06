// The basic test signals on GP0-GP9 and the bouncing button on GP26, and helpers to draw them.
//
// signals.json is generated from the firmware's C++ config by
// tools/export_signals.cpp, so every value here is what the board really
// outputs (already rounded to whole 150 MHz clock cycles).
//
// Every signal is described the same way: a list of (level, duration)
// segments that repeats forever, starting at t = 0 when the firmware enabled
// the outputs. All square waves, the pattern and the button start on the same
// clock cycle, so t = 0 is a shared rising edge for the square waves and the
// moment the button is pressed.

import data from '../data/signals.json';
import {
  idealWaveTrace,
  periodOf,
  sampledWaveTrace,
  waveLevelAt,
  type Level,
  type PeriodicWave,
  type Segment,
  type Trace,
} from './wave';

export type { Edge, Level, Segment, Trace } from './wave';

export interface Signal {
  gpio: number;
  name: string;
  kind: 'square' | 'pwm' | 'pulse' | 'pattern' | 'bounce';
  peripheral: string;
  requestedHz: number | null;
  actualHz: number;
  dutyPercent: number;
  segments: Segment[];
}

export const clkSysHz: number = data.clkSysHz;
export const signals: Signal[] = data.signals as Signal[];

export function signalByGpio(gpio: number): Signal {
  const s = signals.find((x) => x.gpio === gpio);
  if (!s) throw new Error(`no signal on GP${gpio}`);
  return s;
}

export function waveOf(sig: Signal): PeriodicWave {
  return { kind: 'periodic', segments: sig.segments };
}

export function periodNs(sig: Signal): number {
  return periodOf(waveOf(sig));
}

/** Pin level at time t (ns). Negative t works too, since the signal repeats. */
export function levelAt(sig: Signal, tNs: number): Level {
  return waveLevelAt(waveOf(sig), tNs);
}

export function idealTrace(sig: Signal, startNs: number, endNs: number, maxEdges = 4000): Trace {
  return idealWaveTrace(waveOf(sig), startNs, endNs, maxEdges);
}

export function sampledTrace(
  sig: Signal,
  startNs: number,
  endNs: number,
  sampleRateHz: number,
  phase = 0.3,
  maxEdges = 4000,
): Trace {
  return sampledWaveTrace(waveOf(sig), startNs, endNs, sampleRateHz, phase, maxEdges);
}

/** Pattern segments with their start time, for measurement tables. */
export function segmentTimeline(sig: Signal): { start: number; level: Level; ns: number }[] {
  let t = 0;
  return sig.segments.map((s) => {
    const row = { start: t, level: s.level, ns: s.ns };
    t += s.ns;
    return row;
  });
}

/**
 * The bouncing button's press and release, from its segments: the press starts at t = 0 and settles into the
 * longest low segment; the release starts after it and settles into the longest high one.
 */
export function bounceTiming(sig: Signal) {
  const rows = segmentTimeline(sig);
  const longest = (level: Level) =>
    rows.reduce((best, r) => (r.level === level && r.ns > best.ns ? r : best), { start: 0, level, ns: -1 });
  const held = longest(0);
  const released = longest(1);
  const edgesIn = (from: number, to: number, level: Level) =>
    rows.filter((r) => r.start >= from && r.start <= to && r.level === level).length;
  const releaseStart = held.start + held.ns;
  return {
    periodNs: periodNs(sig),
    /** Time from the first edge of the press until the contacts settle. */
    pressBounceNs: held.start,
    /** Time from the first edge until the release begins. */
    heldNs: releaseStart,
    releaseStartNs: releaseStart,
    releaseBounceNs: released.start - releaseStart,
    /** Falling edges in one press (each low segment starts with one), and rising edges in one release. */
    pressFalling: edgesIn(0, held.start, 0),
    pressRising: edgesIn(0, held.start, 1),
    releaseRising: edgesIn(releaseStart, released.start, 1),
    releaseFalling: edgesIn(releaseStart, released.start, 0),
    /** The longest stretch inside the press bounce where the button reads released. */
    longestFalseReleaseNs: Math.max(...rows.filter((r) => r.start < held.start && r.level === 1).map((r) => r.ns)),
    /** The shortest segment anywhere: what the sample rate has to resolve. */
    shortestNs: Math.min(...rows.map((r) => r.ns)),
  };
}
