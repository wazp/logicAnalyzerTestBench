// Lesson: IR remote (NEC). Bytes, timings and decoded values come from protocols.json, which
// the firmware's own C++ generates, so they always match what the board sends.

import { gpioOf, hexByte, protocolData as d } from '../../model/protocols';
import { exampleView, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const ir = gpioOf('ir', 'out');

export const irRemote: Lesson = {
  id: 'ir-remote',
  track: 'protocols',
  title: 'IR remote (NEC)',
  summary: 'Pulse-distance coding: decode a remote control key press.',
  gpios: [ir],
  intro: `GP${ir} looks like the output of an IR receiver module (the 3-pin parts in TVs and kits): a key press on a common NEC remote, then a repeat code because the key is still held. The receiver removes the 38 kHz carrier and its output is inverted: low while IR light arrives, high otherwise.`,
  parts: [
    {
      title: 'Decode a key press',
      settings: {
        gpios: [ir],
        sampleRateHz: 200_000,
        durationNs: 125e6,
        preTriggerNs: 1e6,
        trigger: { type: 'edge', gpio: ir, edge: 'falling' },
        decoder: 'IR NEC, if your software has one (the input is active low)',
      },
      steps: [
        ...protocolWireSteps([ir]),
        `Capture 125 ms, triggered on the falling edge of GP${ir}. If it starts on a short pulse, capture again until it starts on a long one.`,
        'Measure the first low pulse and the high gap after it: that is the leader.',
        'After it come 32 bits. Every bit starts with a short low pulse; the length of the high gap after it is the bit: short = 0, long = 1.',
        'Write down the 32 bits in groups of 8, least significant bit first. You get the address, the address inverted, the command and the command inverted.',
        'Find the repeat code near the end of the capture.',
      ],
      views: [
        exampleView('ir', 'frame', { gpio: ir, edge: 'falling' }, {
          title: 'Key press',
          caption: `9 ms leader, 4.5 ms gap, then 32 bits: address ${hexByte(d.ir.address)}, ${hexByte(~d.ir.address & 0xff)}, command ${hexByte(d.ir.command)}, ${hexByte(~d.ir.command & 0xff)}.`,
        }),
        exampleView('ir', 'repeat', { gpio: ir, edge: 'falling' }, {
          title: 'Repeat code',
          caption: `${d.ir.repeatStartMs - d.ir.frameStartMs} ms after the key press: 9 ms burst, 2.25 ms gap, one short burst. It means "still held".`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: 'What key was pressed?',
      a: `Address ${hexByte(d.ir.address)}, command ${hexByte(d.ir.command)}. On many cheap remotes for kits this is the power key.`,
    },
    {
      q: 'Why send every byte twice, once inverted?',
      a: 'A cheap error check. Each byte and its inverse together always have eight 1s, so a corrupted bit is easy to spot. It also makes every frame the same length.',
    },
    {
      q: 'Why is 200 kS/s plenty here?',
      a: 'The shortest pulse is 562.5 µs, over 100 samples. IR signals are slow; a long capture matters more than a fast rate.',
    },
  ],
};
