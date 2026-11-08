// Shared building blocks for lessons: wiring steps, shorthands for the basic
// signals, and helpers that turn exported protocol examples into views.
// Lessons themselves live one per file in basics/, protocols/ and verify/.

import type { Row } from '../components/Waveform';
import { example, exampleWave, firstEdgeNs, hexByte, type Example, type ProtocolId } from '../model/protocols';
import type { EdgeWave, Level } from '../model/wave';
import { periodNs, segmentTimeline, signalByGpio } from '../model/signals';
import type { View } from './types';

// --- Basic signals (GP0-GP9) -------------------------------------------------

export const sig = signalByGpio;
export const highNs = (gpio: number) => sig(gpio).segments[0].ns;
export const period = (gpio: number) => periodNs(sig(gpio));

/** GP9's high pulse widths, frame marker first. */
export const patternPulses = () => sig(9).segments.filter((s) => s.level === 1).map((s) => s.ns);

/**
 * How often an edge trigger on GP9 lands on the frame marker: the trigger fires on the first rising edge after
 * arming, and the marker is the first one for every arming moment in the quiet stretch before it.
 */
export const markerTriggerShare = () => {
  const rises = segmentTimeline(sig(9)).filter((r) => r.level === 1).map((r) => r.start);
  return (period(9) - Math.max(...rises)) / period(9);
};

// --- Wiring ------------------------------------------------------------------

export const pinList = (gpios: number[]) => gpios.map((g) => `**GP${g}**`).join(', ');

export const wireSteps = (gpios: number[]) => [
  'Connect the analyzer **ground** to a Pico **GND** pin first. They are all the same ground; pick the one nearest your signals.',
  'If your analyzer has an input voltage or threshold setting, choose **3.3V** logic.',
  `Connect ${pinList(gpios)} to free analyzer inputs. Any inputs will do; note which one got which pin.`,
];

/** For captures whose events are further apart than many programs show on one screen. */
export const scrollStep =
  'If your software shows only part of a long capture at once, scroll from one event to the next, or place markers on them to measure the time between.';

export const protocolWarning =
  'These pins drive their lines like a real device would look on an analyzer, but they are push-pull outputs. Never connect them to a real bus, sensor or LED strip.';

export const protocolWireSteps = (gpios: number[]) => [...wireSteps(gpios), protocolWarning];

// --- Protocol examples (GP10-GP22) -------------------------------------------

/**
 * A view of one exported example, with t = 0 at the first `edge` on `gpio`, so
 * it lines up with a capture triggered on that edge.
 */
export function exampleView(
  protocol: ProtocolId,
  label: string,
  trigger: { gpio: number; edge: 'rising' | 'falling' },
  view: { title: string; sampleRateHz?: number; sampleRateOptions?: number[]; caption: string },
): View {
  return exampleViewOf(example(protocol, label), trigger, view);
}

/** Same as exampleView, for any exported example (protocols.json or video.json). */
export function exampleViewOf(
  e: Example,
  trigger: { gpio: number; edge: 'rising' | 'falling' },
  view: { title: string; sampleRateHz?: number; sampleRateOptions?: number[]; caption: string },
): View {
  const zero = firstEdgeNs(e, trigger.gpio, trigger.edge);
  const rows: Row[] = e.traces.map((t) => ({ gpio: t.gpio, wave: exampleWave(e, t.gpio, zero) }));
  return { ...view, startNs: -zero, endNs: e.durationNs - zero, rows };
}

/** A view with only the given pins, for examples that also carry pins a part does not record. */
export const onlyPins = (v: View, gpios: number[]): View => ({ ...v, rows: v.rows?.filter((r) => gpios.includes(r.gpio)) });

/**
 * Examples of the same pins laid end to end: each example's first `edge` on
 * `gpio` is placed at its `atNs`. For captures longer than one example, e.g.
 * two transactions a video frame apart. The pins must idle at the same levels
 * between the examples.
 */
export function placedRows(
  placements: { e: Example; atNs: number }[],
  trigger: { gpio: number; edge: 'rising' | 'falling' },
): Row[] {
  const first = placements[0].e;
  return first.traces.map((t) => {
    const togglesNs: number[] = [];
    for (const { e, atNs } of placements) {
      const zero = firstEdgeNs(e, trigger.gpio, trigger.edge);
      const tr = e.traces.find((x) => x.gpio === t.gpio)!;
      togglesNs.push(...tr.togglesNs.map((x) => x - zero + atNs));
    }
    const wave: EdgeWave = { kind: 'edges', initial: t.initial as Level, togglesNs };
    return { gpio: t.gpio, wave };
  });
}

/** "a, b and c" */
export const andList = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export const bits = (byte: number) => byte.toString(2).padStart(8, '0');
export const lsbFirst = (byte: number) => bits(byte).split('').reverse().join('');
export const bytesHex = (bytes: number[]) => bytes.map(hexByte).join(' ');
