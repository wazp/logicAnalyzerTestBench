// Find the bug: WS2812. One bit with a high time between a 0 and a 1. Values from faults.json.

import { formatRate, formatTime } from '../../model/format';
import { faultsData as d, faultsExample, faultsGpio } from '../../model/faults';
import { hexByte } from '../../model/protocols';
import { exampleViewOf, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const din = faultsGpio('ws2812', 'data');
const rate = 24_000_000;
const rise = { gpio: din, edge: 'rising' as const };
const w = d.ws2812;

// The faulty bit inside its LED: bit 23 is the first sent (green MSB), so bits 15..8 are red.
const colorOfBit = (bit: number) => (bit >= 16 ? 'green' : bit >= 8 ? 'red' : 'blue');
const badColor = colorOfBit(w.badBit);
const bitInByte = w.badBit % 8;
const badPosition = w.badLed * 24 + (23 - w.badBit) + 1;  // 1-based count of high pulses from the start.
const readAsZero = w.level & ~(1 << bitInByte);
const lengthNs = 350e3;

export const faultsWs2812: Lesson = {
  id: 'faults-ws2812',
  track: 'faults',
  preset: 'faults',
  title: 'WS2812: one LED shows the wrong color',
  summary: 'Every LED should be the same dim white. One is not. Find the bit that is to blame.',
  gpios: [din],
  intro: `GP${din} drives a strip of ${w.leds} LEDs, all set to the same dim white (${hexByte(w.level)} for red, green and blue). On a real strip, LED ${w.badLed + 1} shows a different color, sometimes. The data looks fine to a decoder. Measure it.`,
  parts: [
    {
      title: 'One update',
      settings: {
        gpios: [din],
        sampleRateHz: rate,
        durationNs: lengthNs,
        preTriggerNs: 2e3,
        trigger: { type: 'edge', ...rise },
        decoder: 'WS2812 or "RGB LED" decoder, if your software has one',
      },
      steps: [
        ...protocolWireSteps([din]),
        `Capture ${formatTime(lengthNs)} at ${formatRate(rate)}, triggered on the rising edge of GP${din}.`,
        `Each LED takes 24 bits: green, red, blue, most significant bit first. A 0 is about ${formatTime(w.t0hNs)} high, a 1 about ${formatTime(w.t1hNs)}.`,
        `Look at LED ${w.badLed + 1}, bits ${w.badLed * 24 + 1} to ${w.badLed * 24 + 24}. Measure the high time of each pulse. Which one is neither a clear 0 nor a clear 1?`,
        `Why does this need ${formatRate(rate)}? Try the same capture at 8 MS/s and see if you can still tell.`,
      ],
      views: [
        exampleViewOf(faultsExample('ws2812', 'update'), rise, {
          title: 'One update',
          sampleRateHz: rate,
          caption: `${w.leds} LEDs × 24 bits. Pulse ${badPosition} is ${formatTime(w.badHighNs)} high: the ${badColor} bit ${bitInByte} of LED ${w.badLed + 1}.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: `What color does LED ${w.badLed + 1} show, and why only sometimes?`,
      a: `Its ${badColor} byte should be ${hexByte(w.level)}, with one 1 in bit ${bitInByte}. That bit is ${formatTime(w.badHighNs)} high, between a 0 (${formatTime(w.t0hNs)}) and a 1 (${formatTime(w.t1hNs)}). LEDs sample the line roughly in the middle, so the result depends on the LED: some read 1 (white, as meant), some read 0 (${badColor} ${hexByte(readAsZero)}, so the LED loses its ${badColor}). Temperature and supply voltage shift the threshold too, which makes it look random.`,
    },
    {
      q: 'Why did the decoder not complain?',
      a: 'Most WS2812 decoders classify each pulse as 0 or 1 by comparing it with a threshold, often half the bit time. A pulse just past that threshold is silently read as one value. Only measuring the high times shows that it is marginal.',
    },
    {
      q: 'What causes marginal bits on real hardware?',
      a: 'Software timing: bit-banged WS2812 code interrupted for a moment, or tuned for a different CPU speed. Hardware drivers (PWM, DMA, SPI or PIO) avoid it, which is why this board generates every signal in hardware.',
    },
  ],
};
