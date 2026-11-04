// The basic test signals on GP0-GP9, and helpers to draw them.
//
// signals.json is generated from the firmware's C++ config by
// tools/export_signals.cpp, so every value here is what the board really
// outputs (already rounded to whole 150 MHz clock cycles).
//
// Every signal is described the same way: a list of (level, duration)
// segments that repeats forever, starting at t = 0 when the firmware enabled
// the outputs. All square waves and the pattern start on the same clock
// cycle, so t = 0 is a shared rising edge for all of them.

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
  kind: 'square' | 'pwm' | 'pulse' | 'pattern';
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
