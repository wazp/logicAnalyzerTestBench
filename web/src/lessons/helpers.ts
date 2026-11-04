// Shared building blocks for lessons: wiring steps, shorthands for the basic
// signals, and helpers that turn exported protocol examples into views.
// Lessons themselves live one per file in basics/, protocols/ and verify/.

import type { Row } from '../components/Waveform';
import { example, exampleWave, firstEdgeNs, hexByte, type ProtocolId } from '../model/protocols';
import { periodNs, signalByGpio } from '../model/signals';
import type { View } from './types';

// --- Basic signals (GP0-GP9) -------------------------------------------------

export const sig = signalByGpio;
export const highNs = (gpio: number) => sig(gpio).segments[0].ns;
export const period = (gpio: number) => periodNs(sig(gpio));

// --- Wiring ------------------------------------------------------------------

export const pinList = (gpios: number[]) => gpios.map((g) => `**GP${g}**`).join(', ');

export const wireSteps = (gpios: number[]) => [
  'Connect the analyzer **ground** to a Pico **GND** pin first (pin 3, 8 or 13).',
  'If your analyzer has an input voltage or threshold setting, choose **3.3V** logic.',
  `Connect ${pinList(gpios)} to free analyzer inputs. Any inputs will do; note which one got which pin.`,
];

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
  view: { title: string; sampleRateHz?: number; caption: string },
): View {
  const e = example(protocol, label);
  const zero = firstEdgeNs(e, trigger.gpio, trigger.edge);
  const rows: Row[] = e.traces.map((t) => ({ gpio: t.gpio, wave: exampleWave(e, t.gpio, zero) }));
  return { ...view, startNs: -zero, endNs: e.durationNs - zero, rows };
}

export const bits = (byte: number) => byte.toString(2).padStart(8, '0');
export const lsbFirst = (byte: number) => bits(byte).split('').reverse().join('');
export const bytesHex = (bytes: number[]) => bytes.map(hexByte).join(' ');
