// Lesson: IR remote (NEC). Bytes, timings and decoded values come from protocols.json, which
// the firmware's own C++ generates, so they always match what the board sends.

import { formatTime } from '../../model/format';
import { frameMs, gpioOf, hexByte, protocolData as d } from '../../model/protocols';
import { exampleView, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const ir = gpioOf('ir', 'out');
const us = (v: number) => formatTime(v * 1e3);
// The traffic loops every frame: key press, repeat code, then the next frame's key press.
const repeatToKeyPressMs = Math.round((frameMs + d.ir.frameStartMs - d.ir.repeatStartMs) * 1000) / 1000;
const repeatAfterMs = Math.round((d.ir.repeatStartMs - d.ir.frameStartMs) * 1000) / 1000;

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
        `Capture 125 ms, triggered on the falling edge of GP${ir}. If the capture starts with a short low pulse, you armed it in the middle of a key press: capture again until it starts with a long (${us(d.ir.leaderUs)}) one.`,
        `That long pulse is almost always the repeat code: ${us(d.ir.leaderUs)} low, a ${us(d.ir.repeatSpaceUs)} gap and one short pulse. It means "still held". The key press follows ${repeatToKeyPressMs} ms later.`,
        `In the key press, measure the first low pulse and the high gap after it: that is the leader, ${us(d.ir.leaderUs)} and ${us(d.ir.leaderSpaceUs)}.`,
        'After it come 32 bits. Every bit starts with a short low pulse; the length of the high gap after it is the bit: short = 0, long = 1.',
        'Write down the 32 bits in groups of 8, least significant bit first. You get the address, the address inverted, the command and the command inverted.',
      ],
      views: [
        exampleView('ir', 'frame', { gpio: ir, edge: 'falling' }, {
          title: 'Key press',
          caption: `${us(d.ir.leaderUs)} leader, ${us(d.ir.leaderSpaceUs)} gap, then 32 bits: address ${hexByte(d.ir.address)}, ${hexByte(~d.ir.address & 0xff)}, command ${hexByte(d.ir.command)}, ${hexByte(~d.ir.command & 0xff)}.`,
        }),
        exampleView('ir', 'repeat', { gpio: ir, edge: 'falling' }, {
          title: 'Repeat code',
          caption: `${repeatAfterMs} ms after the key press starts: ${us(d.ir.leaderUs)} burst, ${us(d.ir.repeatSpaceUs)} gap, one short burst. It means "still held".`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: 'What key was pressed?',
      a: `Address ${hexByte(d.ir.address)}, command ${hexByte(d.ir.command)}. On many cheap kit remotes that is the top-left key, labeled power, CH- or 1 depending on the remote. The command says which key, not what it does.`,
    },
    {
      q: 'Why send every byte twice, once inverted?',
      a: 'A cheap error check. Each byte and its inverse together always have eight 1s, so a corrupted bit is easy to spot. It also makes every frame the same length.',
    },
    {
      q: 'Why is 200 kS/s plenty here?',
      a: `The shortest pulse is ${us(d.ir.unitUs)}, over ${Math.floor(d.ir.unitUs * 0.2)} samples at 200 kS/s. IR signals are slow; a long capture matters more than a fast rate.`,
    },
  ],
};
