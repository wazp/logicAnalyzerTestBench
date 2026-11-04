// Raspberry Pi Pico 2 W 40-pin header, seen from above with USB at the top.
// Pins 1-20 run down the left edge, pins 21-40 run up the right edge
// (pin 40 is top right, next to the USB connector).

export type PinKind = 'gpio' | 'gnd' | 'power' | 'control';

export interface HeaderPin {
  pin: number;
  label: string;
  kind: PinKind;
  gpio?: number;
}

const gp = (pin: number, gpio: number): HeaderPin => ({ pin, label: `GP${gpio}`, kind: 'gpio', gpio });
const gnd = (pin: number): HeaderPin => ({ pin, label: 'GND', kind: 'gnd' });

export const headerPins: HeaderPin[] = [
  gp(1, 0), gp(2, 1), gnd(3), gp(4, 2), gp(5, 3), gp(6, 4), gp(7, 5), gnd(8), gp(9, 6), gp(10, 7),
  gp(11, 8), gp(12, 9), gnd(13), gp(14, 10), gp(15, 11), gp(16, 12), gp(17, 13), gnd(18), gp(19, 14), gp(20, 15),
  gp(21, 16), gp(22, 17), gnd(23), gp(24, 18), gp(25, 19), gp(26, 20), gp(27, 21), gnd(28), gp(29, 22),
  { pin: 30, label: 'RUN', kind: 'control' },
  gp(31, 26), gp(32, 27),
  { pin: 33, label: 'AGND', kind: 'gnd' },
  gp(34, 28),
  { pin: 35, label: 'ADC_VREF', kind: 'power' },
  { pin: 36, label: '3V3(OUT)', kind: 'power' },
  { pin: 37, label: '3V3_EN', kind: 'control' },
  gnd(38),
  { pin: 39, label: 'VSYS', kind: 'power' },
  { pin: 40, label: 'VBUS', kind: 'power' },
];

export function physicalPinForGpio(gpio: number): number {
  const p = headerPins.find((h) => h.gpio === gpio);
  if (!p) throw new Error(`GP${gpio} is not on the header`);
  return p.pin;
}

/** Ground pins closest to the signal pins, in the order we recommend them. */
export const recommendedGroundPins = [3, 8, 13];
