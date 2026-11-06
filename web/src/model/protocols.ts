// The protocol signals on GP10-GP22.
//
// protocols.json is generated from the firmware's C++ (src/core/protocol_frame.cpp)
// by tools/export_protocols.cpp. It holds the pins, the facts a lesson needs
// (rates, bytes, decoded values) and one example of each transaction as edge
// lists, exactly as the board outputs them.

import data from '../data/protocols.json';
import type { EdgeWave, Level } from './wave';

export type ProtocolId = 'uart' | 'i2c' | 'spi' | 'ws2812' | 'onewire' | 'ir' | 'quadrature';

export interface ProtocolPin {
  gpio: number;
  protocol: ProtocolId;
  role: string;
  name: string;
  idleHigh: boolean;
}

export interface ExampleTrace {
  gpio: number;
  role: string;
  initial: Level;
  /** Toggle times from the example's start, in ns. */
  togglesNs: number[];
}

export interface Example {
  label: string;
  title: string;
  durationNs: number;
  traces: ExampleTrace[];
}

export const protocolData = data;
export const frameMs: number = data.frameMs;
export const protocolPins = data.pins as ProtocolPin[];

export function protocolPin(protocol: ProtocolId, role: string): ProtocolPin {
  const p = protocolPins.find((x) => x.protocol === protocol && x.role === role);
  if (!p) throw new Error(`no ${protocol} ${role} pin`);
  return p;
}

export function gpioOf(protocol: ProtocolId, role: string): number {
  return protocolPin(protocol, role).gpio;
}

export function examplesOf(protocol: ProtocolId): Example[] {
  return (data[protocol] as { examples: Example[] }).examples;
}

export function example(protocol: ProtocolId, label: string): Example {
  const e = examplesOf(protocol).find((x) => x.label === label);
  if (!e) throw new Error(`no ${protocol} example "${label}"`);
  return e;
}

/** Time of the first rising or falling edge of a pin in an example (ns from its start). */
export function firstEdgeNs(e: Example, gpio: number, edge: 'rising' | 'falling'): number {
  const tr = e.traces.find((t) => t.gpio === gpio);
  if (!tr) throw new Error(`example "${e.label}" has no GP${gpio}`);
  let level = tr.initial;
  for (const t of tr.togglesNs) {
    level = (1 - level) as Level;
    if ((level === 1) === (edge === 'rising')) return t;
  }
  throw new Error(`example "${e.label}" has no ${edge} edge on GP${gpio}`);
}

/** One pin of an example as a wave, with t = 0 moved to `zeroNs` in the example. */
export function exampleWave(e: Example, gpio: number, zeroNs: number): EdgeWave {
  const tr = e.traces.find((t) => t.gpio === gpio);
  if (!tr) throw new Error(`example "${e.label}" has no GP${gpio}`);
  return { kind: 'edges', initial: tr.initial, togglesNs: tr.togglesNs.map((t) => t - zeroNs) };
}

export function hexByte(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** Text with control characters shown the way decoders usually show them. */
export function visibleText(s: string): string {
  return s.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}
