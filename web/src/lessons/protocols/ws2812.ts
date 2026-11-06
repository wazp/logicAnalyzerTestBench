// Lesson: WS2812 LEDs. Bytes, timings and decoded values come from protocols.json, which
// the firmware's own C++ generates, so they always match what the board sends.

import { formatHz, formatTime } from '../../model/format';
import { gpioOf, hexByte, protocolData as d } from '../../model/protocols';
import { bits, exampleView, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const din = gpioOf('ws2812', 'data');
const firstLed = d.ws2812.firstColors[0];
const grbBits = bits(firstLed.g) + bits(firstLed.r) + bits(firstLed.b);

export const ws2812: Lesson = {
  id: 'ws2812',
  track: 'protocols',
  title: 'WS2812 LEDs (NeoPixel)',
  summary: 'One wire, no clock: the bit is hidden in the pulse width.',
  gpios: [din],
  intro: `Every ${d.ws2812.startsMs[1] - d.ws2812.startsMs[0]} ms the test bench sends colors for a strip of ${d.ws2812.leds} LEDs showing a moving rainbow. Every bit is one pulse: a short pulse (${formatTime(d.ws2812.t0hNs)}) is a 0, a long one (${formatTime(d.ws2812.t1hNs)}) is a 1. Each LED takes 24 bits, keeps them and passes the rest on.`,
  parts: [
    {
      title: 'Read the first LED',
      settings: {
        gpios: [din],
        sampleRateHz: 16_000_000,
        durationNs: 300e3,
        preTriggerNs: 5e3,
        trigger: { type: 'edge', gpio: din, edge: 'rising' },
        decoder: 'WS281x / RGB LED, if your software has one',
      },
      steps: [
        ...protocolWireSteps([din]),
        `Capture, triggered on the rising edge of GP${din}.`,
        'Measure a few pulse widths. You should find exactly two different widths, and the same distance from one rising edge to the next every time.',
        'Read the first 24 pulses as bits: short = 0, long = 1. The first 8 are green, then red, then blue.',
        `Count the pulses in the whole burst. How many LEDs is that?`,
      ],
      views: [
        exampleView('ws2812', 'first_led', { gpio: din, edge: 'rising' }, {
          title: 'First LED',
          sampleRateHz: 16_000_000,
          caption: `24 pulses: ${grbBits.slice(0, 8)} (green) ${grbBits.slice(8, 16)} (red) ${grbBits.slice(16)} (blue).`,
        }),
        exampleView('ws2812', 'update', { gpio: din, edge: 'rising' }, {
          title: 'All LEDs',
          caption: `${d.ws2812.leds} × 24 = ${d.ws2812.leds * 24} pulses, then the line stays low. The low gap tells the LEDs to show the new colors.`,
        }),
      ],
    },
  ],
  tables: [
    {
      title: 'Colors in the first update',
      head: ['LED', 'Green', 'Red', 'Blue'],
      rows: d.ws2812.firstColors.map((c, i) => [String(i + 1), hexByte(c.g), hexByte(c.r), hexByte(c.b)]),
    },
  ],
  questions: [
    {
      q: 'What is the bit rate?',
      a: `One bit every ${formatTime(d.ws2812.bitNs)}, so ${formatHz(1e9 / d.ws2812.bitNs)}.`,
    },
    {
      q: 'Why does this need a fast sample rate even though it is "only" 800 kHz?',
      a: `You are measuring pulse widths, not counting edges. The two widths differ by ${formatTime(d.ws2812.t1hNs - d.ws2812.t0hNs)}, so you need several samples inside that difference. At 16 MS/s a sample is 62.5 ns.`,
    },
    {
      q: 'Why is the green byte first?',
      a: 'That is simply the order these LEDs expect: green, red, blue. Sending RGB by mistake is a classic bug that swaps red and green.',
    },
  ],
};
