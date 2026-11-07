// The "Faults" preset on GP10-GP20: the protocol buses with realistic mistakes to find.
//
// faults.json is generated from the firmware's C++ (src/core/faults_frame.cpp) by tools/export_faults.cpp. It
// holds the pins, every fault and the values a lesson needs, and one example window per fault as edge lists,
// exactly as the board outputs them.

import data from '../data/faults.json';
import type { Example } from './protocols';

export type FaultsPart = 'uart' | 'parity' | 'i2c' | 'spi' | 'ws2812' | 'onewire' | 'irq';

export interface FaultsPin {
  gpio: number;
  part: FaultsPart;
  role: string;
  name: string;
  idleHigh: boolean;
}

export const faultsData = data;
export const faultsPins = data.pins as FaultsPin[];

export function faultsGpio(part: FaultsPart, role: string): number {
  const p = faultsPins.find((x) => x.part === part && x.role === role);
  if (!p) throw new Error(`no ${part} ${role} pin in the faults preset`);
  return p.gpio;
}

export function faultsExample(part: FaultsPart, label: string): Example {
  const e = (data[part] as { examples: Example[] }).examples.find((x) => x.label === label);
  if (!e) throw new Error(`no ${part} example "${label}"`);
  return e;
}
