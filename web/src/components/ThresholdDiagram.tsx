// How an analyzer turns a voltage into bits: a slow, slightly noisy rising
// edge and a clean falling edge on 3.3V logic, the threshold the analyzer
// compares against, and the bits it records. Where the slow edge lingers near
// the threshold, noise makes it cross several times: the classic glitch.

const W = 760;
const PLOT_TOP = 16;
const PLOT_H = 170;
const DIGITAL_TOP = PLOT_TOP + PLOT_H + 34;
const DIGITAL_H = 34;
const H = DIGITAL_TOP + DIGITAL_H + 26;
const LEFT = 64;
const RIGHT = W - 16;
const VMAX = 3.6;
const THRESHOLD = 1.65;
const VIH = 2.0;
const VIL = 0.8;
const STEPS = 600;

/** Input voltage at time u (0..1). */
function voltage(u: number): number {
  const rise = 3.3 / (1 + Math.exp(-(u - 0.33) * 14)); // A slow edge, like a long wire or a weak pull-up.
  const fall = u > 0.78 ? 3.3 * Math.max(0, 1 - (u - 0.78) * 60) : 3.3; // A fast, clean falling edge.
  const noise = 0.09 * Math.sin(u * 260) + 0.05 * Math.sin(u * 611);
  return Math.max(0, Math.min(rise, fall) + noise);
}

const x = (u: number) => LEFT + u * (RIGHT - LEFT);
const y = (v: number) => PLOT_TOP + PLOT_H - (v / VMAX) * PLOT_H;

export function ThresholdDiagram() {
  const samples = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS);
  const analog = samples.map((u, i) => `${i ? 'L' : 'M'}${x(u).toFixed(1)},${y(voltage(u)).toFixed(1)}`).join(' ');

  let digital = '';
  let prev = -1;
  let glitches = 0;
  for (const u of samples) {
    const level = voltage(u) > THRESHOLD ? 1 : 0;
    const yy = level ? DIGITAL_TOP : DIGITAL_TOP + DIGITAL_H;
    if (prev === -1) digital = `M${x(u).toFixed(1)},${yy}`;
    else if (level !== prev) {
      digital += ` H${x(u).toFixed(1)} V${yy}`;
      if (level === 1) glitches++;
    }
    prev = level;
  }
  digital += ` H${RIGHT}`;

  const hline = (v: number, cls: string, label: string) => (
    <g>
      <line class={cls} x1={LEFT} x2={RIGHT} y1={y(v)} y2={y(v)} />
      <text class="th-label" x={LEFT - 6} y={y(v) + 4} text-anchor="end">
        {label}
      </text>
    </g>
  );

  return (
    <figure class="threshold-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Input voltage, threshold and recorded bits">
        <rect class="th-band" x={LEFT} y={y(VIH)} width={RIGHT - LEFT} height={y(VIL) - y(VIH)} />
        {hline(3.3, 'th-rail', '3.3 V')}
        {hline(VIH, 'th-limit', 'VIH 2.0')}
        {hline(THRESHOLD, 'th-threshold', '1.65 V')}
        {hline(VIL, 'th-limit', 'VIL 0.8')}
        {hline(0, 'th-rail', '0 V')}
        <text class="th-note" x={RIGHT - 4} y={y((VIH + VIL) / 2) + 4} text-anchor="end">
          undefined zone
        </text>
        <path class="th-analog" d={analog} />
        <text class="th-label" x={LEFT - 6} y={DIGITAL_TOP + DIGITAL_H / 2 + 4} text-anchor="end">
          bits
        </text>
        <path class="th-digital" d={digital} />
        <text class="th-note" x={x(0.36)} y={H - 6} text-anchor="middle">
          slow edge: {glitches > 1 ? `${glitches} rising edges instead of 1` : 'one clean edge'}
        </text>
        <text class="th-note" x={x(0.8)} y={H - 6} text-anchor="middle">
          fast edge: clean
        </text>
      </svg>
      <figcaption>
        The analyzer compares each sample with one threshold (here 1.65 V, half of 3.3 V). A chip's input is only
        guaranteed to read high above VIH and low below VIL. In between, a slow or noisy edge can cross the threshold
        several times and show up as glitches.
      </figcaption>
    </figure>
  );
}
