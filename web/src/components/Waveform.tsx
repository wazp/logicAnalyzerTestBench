import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { shortLabel, signalColor } from '../model/board';
import { formatRate, formatTime } from '../model/format';
import { idealWaveTrace, sampledWaveTrace, waveLevelAt, type Trace, type Wave } from '../model/wave';
import { PresetContext } from './PresetContext';
import { ZoomedContext } from './Zoomable';

const LABEL_W = 92;
const RIGHT_PAD = 12;
const ROW_H = 38;
const TRACE_H = 18;
const AXIS_H = 26;
/** Narrowest drawing; on smaller screens the waveform scrolls sideways. */
const MIN_W = 600;
/** In the zoom dialog everything (rows, text, strokes) is drawn up to this much larger. */
const MAX_ZOOM = 1.75;
/** Below this many pixels per sample we stop drawing individual sample dots. */
const MIN_PX_PER_DOT = 7;
/** Sample phase used for all drawn captures (see sampledWaveTrace). */
const PHASE = 0.3;

/** One trace to draw: a pin and its waveform. */
export interface Row {
  gpio: number;
  wave: Wave;
}

function useWidth<T extends Element>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(MIN_W, entries[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** About six round-numbered time ticks across the window. */
function ticks(start: number, end: number): number[] {
  const span = end - start;
  const raw = span / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let t = Math.ceil(start / step) * step; t <= end; t += step) out.push(Math.round(t / step) * step);
  return out;
}

interface Props {
  rows: Row[];
  startNs: number;
  endNs: number;
  sampleRateHz?: number;
}

/**
 * Expected capture. With a sample rate, it shows what an analyzer at that
 * rate records (including aliasing); without, the ideal signal. The trigger
 * point is t = 0.
 */
export function Waveform({ rows, startNs, endNs, sampleRateHz }: Props) {
  const [ref, measured] = useWidth<HTMLDivElement>(760);
  const preset = useContext(PresetContext);
  // Zoomed, the drawing is laid out at a smaller logical width and scaled up by
  // the viewBox, but never below MIN_W logical pixels (it would scroll instead).
  const zoom = useContext(ZoomedContext) ? Math.max(1, Math.min(MAX_ZOOM, measured / MIN_W)) : 1;
  const width = measured / zoom;
  const plotW = width - LABEL_W - RIGHT_PAD;
  const x = (t: number) => LABEL_W + ((t - startNs) / (endNs - startNs)) * plotW;
  const height = rows.length * ROW_H + AXIS_H;

  const stepNs = sampleRateHz ? 1e9 / sampleRateHz : 0;
  const sampleCount = sampleRateHz ? Math.floor((endNs - startNs) / stepNs) : 0;
  const showDots = sampleRateHz !== undefined && plotW / sampleCount >= MIN_PX_PER_DOT;

  return (
    <div class="waveform" ref={ref}>
      <div class="figure-scroll">
        <svg
          width={measured}
          height={height * zoom}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Expected waveform"
        >
          {ticks(startNs, endNs).map((t) => (
            <g key={t}>
              <line class="grid" x1={x(t)} x2={x(t)} y1={0} y2={height - AXIS_H} />
              <text class="tick" x={x(t)} y={height - 8} text-anchor={x(t) > LABEL_W + plotW - 24 ? 'end' : 'middle'}>
                {formatTime(t)}
              </text>
            </g>
          ))}
          {startNs < 0 && endNs > 0 && (
            <g>
              <line class="trigger" x1={x(0)} x2={x(0)} y1={0} y2={height - AXIS_H} />
              <text class="trigger-label" x={x(0) + 4} y={10}>
                T
              </text>
            </g>
          )}
          {rows.map(({ gpio, wave }, row) => {
            const color = signalColor(gpio);
            const yTop = row * ROW_H + (ROW_H - TRACE_H) / 2;
            const y = (level: number) => (level ? yTop : yTop + TRACE_H);
            const maxEdges = Math.floor(plotW);
            const trace: Trace = sampleRateHz
              ? sampledWaveTrace(wave, startNs, endNs, sampleRateHz, PHASE, maxEdges)
              : idealWaveTrace(wave, startNs, endNs, maxEdges);

            let path = '';
            if (!trace.dense) {
              path = `M${LABEL_W},${y(trace.startLevel)}`;
              for (const e of trace.edges) path += ` H${x(e.t).toFixed(1)} V${y(e.level)}`;
              path += ` H${LABEL_W + plotW}`;
            }
            return (
              <g key={gpio}>
                <text class="row-label" x={8} y={yTop + TRACE_H / 2 + 4} style={{ fill: color }}>
                  GP{gpio}
                </text>
                <text class="row-sub" x={44} y={yTop + TRACE_H / 2 + 4}>
                  {shortLabel(gpio, preset)}
                </text>
                {trace.dense ? (
                  <g>
                    <rect class="dense" x={LABEL_W} y={yTop} width={plotW} height={TRACE_H} style={{ fill: color }} />
                    <text class="dense-label" x={LABEL_W + plotW / 2} y={yTop + TRACE_H / 2 + 4} text-anchor="middle">
                      too many edges to draw at this zoom
                    </text>
                  </g>
                ) : (
                  <path class="trace" d={path} style={{ stroke: color }} />
                )}
                {showDots &&
                  Array.from({ length: sampleCount }, (_, k) => {
                    const t = startNs + (k + PHASE) * stepNs;
                    return <circle key={k} class="sample-dot" cx={x(t)} cy={y(waveLevelAt(wave, t))} r="2.2" />;
                  })}
              </g>
            );
          })}
        </svg>
      </div>
      {sampleRateHz && (
        <div class="waveform-note">
          As recorded at {formatRate(sampleRateHz)}
          {showDots ? ', dots are individual samples' : ''}. T marks the trigger.
        </div>
      )}
    </div>
  );
}
