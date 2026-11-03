// Human friendly number formatting for frequencies, times and sample counts.

function trim(n: number, digits = 3): string {
  // Up to `digits` decimals, without trailing zeros: 1.500 -> 1.5, 2.000 -> 2.
  return Number(n.toFixed(digits)).toString();
}

export function formatHz(hz: number): string {
  if (hz >= 1e6) return `${trim(hz / 1e6)} MHz`;
  if (hz >= 1e3) return `${trim(hz / 1e3)} kHz`;
  return `${trim(hz)} Hz`;
}

/** Sample rate in the analyzer's terms (samples per second). */
export function formatRate(hz: number): string {
  if (hz >= 1e6) return `${trim(hz / 1e6)} MS/s`;
  if (hz >= 1e3) return `${trim(hz / 1e3)} kS/s`;
  return `${trim(hz)} S/s`;
}

export function formatTime(ns: number): string {
  const a = Math.abs(ns);
  if (a === 0) return '0';
  if (a >= 1e9) return `${trim(ns / 1e9)} s`;
  if (a >= 1e6) return `${trim(ns / 1e6)} ms`;
  if (a >= 1e3) return `${trim(ns / 1e3)} µs`;
  return `${trim(ns, 1)} ns`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatPercent(p: number): string {
  return `${trim(p, 2)}%`;
}
