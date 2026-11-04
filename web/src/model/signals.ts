// The test signals the firmware produces, and helpers to draw them.
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

export type Level = 0 | 1;

export interface Segment {
  level: Level;
  ns: number;
}

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

/** Analyzer channels in the LogicAnalyzer app are numbered from 1, so GPn goes to CH(n+1). */
export function channelForGpio(gpio: number): number {
  return gpio + 1;
}

export function periodNs(sig: Signal): number {
  return sig.segments.reduce((sum, s) => sum + s.ns, 0);
}

/** Pin level at time t (ns). Negative t works too, since the signal repeats. */
export function levelAt(sig: Signal, tNs: number): Level {
  const period = periodNs(sig);
  let t = ((tNs % period) + period) % period;
  for (const seg of sig.segments) {
    if (t < seg.ns) return seg.level;
    t -= seg.ns;
  }
  return sig.segments[sig.segments.length - 1].level;
}

/** A level change at time t (ns), to the given level. */
export interface Edge {
  t: number;
  level: Level;
}

/** Result of rendering one trace over a time window. */
export interface Trace {
  startLevel: Level;
  edges: Edge[];
  /** True when there were more edges than maxEdges; edges is then incomplete. */
  dense: boolean;
}

/**
 * The ideal waveform: exact edge times in [startNs, endNs).
 * Stops early and sets `dense` when more than maxEdges would be produced.
 */
export function idealTrace(sig: Signal, startNs: number, endNs: number, maxEdges = 4000): Trace {
  const period = periodNs(sig);
  const startLevel = levelAt(sig, startNs);
  const edges: Edge[] = [];

  // Walk segment boundaries starting from the period that contains startNs.
  let periodStart = Math.floor(startNs / period) * period;
  let prevLevel = sig.segments[sig.segments.length - 1].level;
  while (periodStart < endNs) {
    let t = periodStart;
    for (const seg of sig.segments) {
      if (seg.level !== prevLevel && t > startNs && t < endNs) {
        if (edges.length >= maxEdges) return { startLevel, edges, dense: true };
        edges.push({ t, level: seg.level });
      }
      prevLevel = seg.level;
      t += seg.ns;
    }
    periodStart += period;
  }
  return { startLevel, edges, dense: false };
}

/**
 * What an analyzer sampling at `sampleRateHz` would record. Sample k is taken
 * at startNs + (k + phase) / rate. A real analyzer's clock is not locked to the
 * Pico's, so `phase` (0..1) shifts the samples off the signal edges.
 */
export function sampledTrace(
  sig: Signal,
  startNs: number,
  endNs: number,
  sampleRateHz: number,
  phase = 0.3,
  maxEdges = 4000,
): Trace {
  const stepNs = 1e9 / sampleRateHz;
  const count = Math.floor((endNs - startNs) / stepNs);
  const startLevel = levelAt(sig, startNs + phase * stepNs);
  const edges: Edge[] = [];
  let prev = startLevel;
  for (let k = 1; k < count; k++) {
    const t = startNs + (k + phase) * stepNs;
    const level = levelAt(sig, t);
    if (level !== prev) {
      if (edges.length >= maxEdges) return { startLevel, edges, dense: true };
      // The analyzer only knows the level changed somewhere since the last
      // sample; it shows the change at the sample where it saw it.
      edges.push({ t, level });
      prev = level;
    }
  }
  return { startLevel, edges, dense: false };
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
