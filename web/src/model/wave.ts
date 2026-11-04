// One digital waveform, in either of the two shapes the test bench produces:
//
//   periodic  the basic signals (GP0-GP9): (level, duration) segments that
//             repeat forever, with t = 0 at a shared rising edge
//   edges     one protocol transaction (GP10-GP22): a starting level and the
//             times where it toggles, with t = 0 at the lesson's trigger
//
// Drawing and sampling work the same for both. All times are in ns.

export type Level = 0 | 1;

export interface Segment {
  level: Level;
  ns: number;
}

export interface PeriodicWave {
  kind: 'periodic';
  segments: Segment[];
}

export interface EdgeWave {
  kind: 'edges';
  /** Level before the first toggle. */
  initial: Level;
  /** Ascending toggle times. Before the first and after the last the level holds. */
  togglesNs: number[];
}

export type Wave = PeriodicWave | EdgeWave;

/** A level change at time t, to the given level. */
export interface Edge {
  t: number;
  level: Level;
}

/** One trace rendered over a time window. */
export interface Trace {
  startLevel: Level;
  edges: Edge[];
  /** True when there were more edges than maxEdges; edges is then incomplete. */
  dense: boolean;
}

export function periodOf(w: PeriodicWave): number {
  return w.segments.reduce((sum, s) => sum + s.ns, 0);
}

/** Toggles at or before t (binary search). */
function togglesUpTo(w: EdgeWave, t: number): number {
  let lo = 0;
  let hi = w.togglesNs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (w.togglesNs[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function waveLevelAt(w: Wave, t: number): Level {
  if (w.kind === 'edges') {
    return ((w.initial + togglesUpTo(w, t)) % 2) as Level;
  }
  const period = periodOf(w);
  let p = ((t % period) + period) % period;
  for (const seg of w.segments) {
    if (p < seg.ns) return seg.level;
    p -= seg.ns;
  }
  return w.segments[w.segments.length - 1].level;
}

/** Exact edges in (startNs, endNs). Stops and sets `dense` past maxEdges. */
export function idealWaveTrace(w: Wave, startNs: number, endNs: number, maxEdges = 4000): Trace {
  const startLevel = waveLevelAt(w, startNs);
  const edges: Edge[] = [];
  if (w.kind === 'edges') {
    let level = startLevel;
    for (let i = togglesUpTo(w, startNs); i < w.togglesNs.length && w.togglesNs[i] < endNs; i++) {
      if (edges.length >= maxEdges) return { startLevel, edges, dense: true };
      level = (1 - level) as Level;
      edges.push({ t: w.togglesNs[i], level });
    }
    return { startLevel, edges, dense: false };
  }
  // Walk segment boundaries starting from the period that contains startNs.
  const period = periodOf(w);
  let periodStart = Math.floor(startNs / period) * period;
  let prevLevel = w.segments[w.segments.length - 1].level;
  while (periodStart < endNs) {
    let t = periodStart;
    for (const seg of w.segments) {
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
export function sampledWaveTrace(
  w: Wave,
  startNs: number,
  endNs: number,
  sampleRateHz: number,
  phase = 0.3,
  maxEdges = 4000,
): Trace {
  const stepNs = 1e9 / sampleRateHz;
  const count = Math.floor((endNs - startNs) / stepNs);
  const startLevel = waveLevelAt(w, startNs + phase * stepNs);
  const edges: Edge[] = [];
  let prev = startLevel;
  for (let k = 1; k < count; k++) {
    const t = startNs + (k + phase) * stepNs;
    const level = waveLevelAt(w, t);
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
