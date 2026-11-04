import { useEffect, useRef, useState } from 'preact/hooks';
import { formatHz, formatRate, formatTime } from '../model/format';
import { channelForGpio, idealTrace, levelAt, sampledTrace, signalByGpio, type Trace } from '../model/signals';
import { channelColor } from './channel';

const LABEL_W = 84;
const RIGHT_PAD = 12;
const ROW_H = 38;
const TRACE_H = 18;
const AXIS_H = 26;
/** Below this many pixels per sample we stop drawing individual sample dots. */
const MIN_PX_PER_DOT = 7;
/** Sample phase used for all drawn captures (see sampledTrace). */
const PHASE = 0.3;

function useWidth<T extends Element>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(280, entries[0].contentRect.width)));
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
  gpios: number[];
  startNs: number;
  endNs: number;
  sampleRateHz?: number;
}

/**
 * Expected capture for a set of GPIOs. With a sample rate, it shows what the
 * analyzer records (including aliasing); without, the ideal signal. The
 * trigger point is t = 0.
 */
export function Waveform({ gpios, startNs, endNs, sampleRateHz }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>(760);
  const plotW = width - LABEL_W - RIGHT_PAD;
  const x = (t: number) => LABEL_W + ((t - startNs) / (endNs - startNs)) * plotW;
  const height = gpios.length * ROW_H + AXIS_H;

  const stepNs = sampleRateHz ? 1e9 / sampleRateHz : 0;
  const sampleCount = sampleRateHz ? Math.floor((endNs - startNs) / stepNs) : 0;
  const showDots = sampleRateHz !== undefined && plotW / sampleCount >= MIN_PX_PER_DOT;

  return (
    <div class="waveform" ref={ref}>
      <svg width={width} height={height} role="img" aria-label="Expected waveform">
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
        {gpios.map((gpio, row) => {
          const sig = signalByGpio(gpio);
          const ch = channelForGpio(gpio);
          const yTop = row * ROW_H + (ROW_H - TRACE_H) / 2;
          const y = (level: number) => (level ? yTop : yTop + TRACE_H);
          const maxEdges = Math.floor(plotW);
          const trace: Trace = sampleRateHz
            ? sampledTrace(sig, startNs, endNs, sampleRateHz, PHASE, maxEdges)
            : idealTrace(sig, startNs, endNs, maxEdges);

          let path = '';
          if (!trace.dense) {
            path = `M${LABEL_W},${y(trace.startLevel)}`;
            for (const e of trace.edges) path += ` H${x(e.t).toFixed(1)} V${y(e.level)}`;
            path += ` H${LABEL_W + plotW}`;
          }
          return (
            <g key={gpio}>
              <text class="row-label" x={8} y={yTop + TRACE_H / 2 + 4} style={{ fill: channelColor(ch) }}>
                CH{ch}
              </text>
              <text class="row-sub" x={46} y={yTop + TRACE_H / 2 + 4}>
                GP{gpio}
              </text>
              {trace.dense ? (
                <g>
                  <rect class="dense" x={LABEL_W} y={yTop} width={plotW} height={TRACE_H} style={{ fill: channelColor(ch) }} />
                  <text class="dense-label" x={LABEL_W + plotW / 2} y={yTop + TRACE_H / 2 + 4} text-anchor="middle">
                    toggling at {formatHz(sig.actualHz)}, too fast to draw at this zoom
                  </text>
                </g>
              ) : (
                <path class="trace" d={path} style={{ stroke: channelColor(ch) }} />
              )}
              {showDots &&
                Array.from({ length: sampleCount }, (_, k) => {
                  const t = startNs + (k + PHASE) * stepNs;
                  return <circle key={k} class="sample-dot" cx={x(t)} cy={y(levelAt(sig, t))} r="2.2" />;
                })}
            </g>
          );
        })}
      </svg>
      {sampleRateHz && (
        <div class="waveform-note">
          As recorded at {formatRate(sampleRateHz)}
          {showDots ? ', dots are individual samples' : ''}. T marks the trigger.
        </div>
      )}
    </div>
  );
}
