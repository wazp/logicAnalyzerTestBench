// Real hardware: boards with 5 V and 3.3 V parts, the level shifters between them, and how to probe
// across them. The divider example is computed. Reading only.

import { formatTime } from '../../model/format';
import type { Lesson } from '../types';

// A 5 V signal through a 10 kΩ / 20 kΩ divider into an input of about 10 pF.
const rTop = 10_000;
const rBottom = 20_000;
const inputPf = 10;
const dividedVolts = (5 * rBottom) / (rTop + rBottom);
// The input sees the two resistors in parallel; an RC edge takes 2.2 time constants from 10% to 90%.
const tauNs = ((rTop * rBottom) / (rTop + rBottom)) * inputPf * 1e-3;
const edgeNs = 2.2 * tauNs;

// CMOS inputs on a 5 V supply need 70% of it for a valid high; TTL-level inputs need 2.0 V.
const cmosHigh5 = 0.7 * 5;

export const mixedVoltages: Lesson = {
  id: 'mixed-voltages',
  track: 'hardware',
  title: 'Mixed voltages and level shifters',
  summary: '5 V and 3.3 V parts on one board, the shifters that join them, and which side to probe.',
  gpios: [],
  intro:
    'Plenty of real projects mix logic levels: a 5 V microcontroller board with a 3.3 V sensor, a 3.3 V board driving 5 V LED strips, a 1.8 V chip on a 3.3 V board. Between them sit level shifters, or sometimes nothing at all. Knowing what each kind of shifter does helps you pick where to probe and recognize what is going wrong.',
  sections: [
    {
      title: 'Will a high be understood?',
      body: [
        `A signal crosses levels in two directions, and they fail differently. Going **down** (5 V into a 3.3 V input) the danger is damage: unless the input is 5 V tolerant, its protection diode conducts and can be destroyed. Going **up** (3.3 V into a 5 V input) the danger is misreading: a 5 V CMOS input wants about ${cmosHigh5} V for a high, which a 3.3 V output never reaches. It often works on the bench, then fails when it is warm or the supply is a little high. Inputs with TTL levels (2.0 V for a high) accept 3.3 V fine.`,
        'The datasheet says which kind an input is: look for VIH (the lowest voltage that counts as high) and the absolute maximum input voltage.',
      ],
    },
    {
      title: 'The usual shifters',
      body: [],
      bullets: [
        `**Resistor divider** (one direction, down). Two resistors turn 5 V into about ${dividedVolts.toFixed(2)} V with ${rTop / 1000} kΩ and ${rBottom / 1000} kΩ. Simple, but the resistors and the input capacitance form a low-pass filter: with about ${inputPf} pF on the input, edges take about ${formatTime(edgeNs)}. Fine for UART and slow signals, too slow for fast SPI.`,
        '**Single MOSFET with two pull-ups** (both directions, open-drain). The common "I²C level shifter" breakout. Each side has its own pull-up, and the transistor passes lows both ways. Rising edges on each side are as slow as that side\'s pull-up makes them, so the two sides look slightly different in a capture.',
        '**Buffer chips with a fixed direction** (74LVC1T45, 74HCT245 and similar). Fast, clean edges, one direction per pin (some have a direction pin). The best choice for SPI, LED data and clocks.',
        '**Auto-direction translators** (TXB0108 and similar). They sense which side is driving and accelerate edges with short boosts. They work well on push-pull signals, but often fail on I²C and 1-Wire, where pull-ups confuse the direction sensing, and the boosts can ring on long wires.',
      ],
    },
    {
      title: 'Which side to probe',
      body: [
        'If your analyzer is 5 V tolerant, both sides are fair game. If it is not, probe the low-voltage side only; set its threshold for that side\'s logic level if you can.',
        'When a link across a shifter misbehaves, capture **both** sides at once. If the signal is right on the sending side and wrong on the receiving side, the shifter or its pull-ups are the problem, not either chip. Typical findings: one side never goes fully low (a MOSFET shifter with missing pull-ups on one side), a delay that grows with speed (a divider or weak pull-up), extra pulses after edges (an auto-direction translator ringing).',
      ],
    },
    {
      title: 'No shifter at all',
      body: [
        'Many 5 V boards drive 3.3 V modules directly, and many 3.3 V boards drive 5 V LED strips directly. Sometimes it works because the input happens to be tolerant or happens to accept the level. A capture cannot tell you that it is safe: on the analyzer the signal looks perfect. The datasheet is the only way to know. If the capture is clean and the device still misreads, a level that is in the gray zone between the two thresholds is a prime suspect, and the "What a logic analyzer can\'t show you" lesson explains why a scope then helps.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'A 3.3 V board drives a strip of 5 V LEDs directly. The analyzer shows a perfect data signal, but the first LED shows random colors. What is going on?',
      a: `The LED's input likely needs about ${cmosHigh5} V for a high (70% of 5 V), and 3.3 V is not reliably enough, although your analyzer, with its lower threshold, reads it as high. A buffer powered from 5 V (74HCT-type inputs accept 3.3 V) between the board and the strip fixes it.`,
    },
    {
      q: `Why is a ${rTop / 1000} kΩ / ${rBottom / 1000} kΩ divider a poor choice for a 20 MHz SPI clock?`,
      a: `With the input capacitance it forms a filter: edges take about ${formatTime(edgeNs)}, but a 20 MHz clock is high and low for only ${formatTime(25)} each. The clock never reaches full levels. Use a buffer chip for fast signals.`,
    },
    {
      q: 'An I²C bus works on the 3.3 V side, but devices on the 5 V side of an auto-direction translator never answer. What do you try?',
      a: 'Replace the translator with a MOSFET-type I²C shifter, with pull-ups on both sides. Auto-direction translators often cannot handle open-drain buses with pull-ups.',
    },
  ],
};
