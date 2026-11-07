// Every signal pin on the test bench, basic (GP0-GP9 and the GP26 button) and
// timeline (GP10-GP22, whose signals depend on the preset), with a name, a
// short label for diagrams, and a color.
//
// Lessons refer to signals by Pico pin, never by analyzer channel: analyzers
// number their inputs differently (CH1, D0, 0...), and a learner with 8
// inputs wires each lesson differently from one with 24.

import { defaultPreset, type PresetId } from './presets';
import { protocolPins } from './protocols';
import { signalByGpio, signals } from './signals';
import { videoPins } from './video';

const basicShort: Record<number, string> = {
  0: '1 Hz',
  1: '10 Hz',
  2: '100 Hz',
  3: '1 kHz',
  4: '10 kHz',
  5: '100 kHz',
  6: '25%',
  7: '75%',
  8: 'pulse',
  9: 'pattern',
  26: 'button',
};

const protocolShort: Record<string, string> = {
  tx: 'TX',
  rx: 'RX',
  scl: 'SCL',
  sda: 'SDA',
  sck: 'SCK',
  mosi: 'MOSI',
  miso: 'MISO',
  cs: 'CS',
  data: 'DIN',
  dq: 'DQ',
  out: 'IR',
  a: 'A',
  b: 'B',
};

const videoShort: Record<string, string> = {
  'vga.hsync': 'HSYNC',
  'vga.vsync': 'VSYNC',
  'vga.red': 'R',
  'vga.green': 'G',
  'vga.blue': 'B',
  'nes.latch': 'LATCH',
  'nes.clock': 'CLK',
  'nes.data': 'DATA',
  'ps2.clock': 'KCLK',
  'ps2.data': 'KDAT',
};

export function isBasicSignal(gpio: number): boolean {
  return signals.some((s) => s.gpio === gpio);
}

/** The pin's signal in a preset; GP10-GP22 change with the preset, the others never do. */
export function signalName(gpio: number, preset: PresetId = defaultPreset): string {
  if (isBasicSignal(gpio)) return signalByGpio(gpio).name;
  const p = (preset === 'video' ? videoPins : protocolPins).find((x) => x.gpio === gpio);
  if (!p) throw new Error(`no signal on GP${gpio} in the ${preset} preset`);
  return p.name;
}

export function shortLabel(gpio: number, preset: PresetId = defaultPreset): string {
  if (isBasicSignal(gpio)) return basicShort[gpio] ?? `GP${gpio}`;
  if (preset === 'video') {
    const v = videoPins.find((x) => x.gpio === gpio);
    return v ? (videoShort[`${v.part}.${v.role}`] ?? v.role.toUpperCase()) : `GP${gpio}`;
  }
  const p = protocolPins.find((x) => x.gpio === gpio);
  return p ? (protocolShort[p.role] ?? p.role.toUpperCase()) : `GP${gpio}`;
}

/** Ten trace colors, cycled by GPIO. Pins used together in a lesson get distinct colors. */
export function signalColor(gpio: number): string {
  return `var(--ch${(gpio % 10) + 1})`;
}

/** All signal pins in GPIO order, as in the default (protocols) preset. */
export const allSignalGpios: number[] = [...signals.map((s) => s.gpio), ...protocolPins.map((p) => p.gpio)].sort(
  (a, b) => a - b,
);
