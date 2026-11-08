// The "Verify" preset on GP10-GP22: a 12-bit binary counter and frequency bursts, for checking an analyzer.
//
// verify.json is generated from the firmware's C++ (src/core/verify_frame.cpp) by tools/export_verify.cpp,
// exactly as the board outputs it.

import data from '../data/verify.json';
import type { Example } from './protocols';

export interface VerifyPin {
  gpio: number;
  role: 'bit' | 'burst';
  bit?: number;
  name: string;
}

export const verifyData = data;
export const verifyPins = data.pins as VerifyPin[];
export const burstGpio = verifyPins.find((p) => p.role === 'burst')!.gpio;

/** The GPIO that carries counter bit `bit`. */
export function counterGpio(bit: number): number {
  const p = verifyPins.find((x) => x.role === 'bit' && x.bit === bit);
  if (!p) throw new Error(`no counter bit ${bit}`);
  return p.gpio;
}

/** Counter bit n is a square wave with a period of 2^(n+1) steps. */
export function counterPeriodNs(bit: number): number {
  return data.counter.stepNs * 2 ** (bit + 1);
}

export function verifyExample(label: string): Example {
  const e = (data.examples as Example[]).find((x) => x.label === label);
  if (!e) throw new Error(`no verify example "${label}"`);
  return e;
}
