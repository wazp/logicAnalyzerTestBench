// Find the bug: 1-Wire. A reset nobody answers, and a scratchpad whose CRC does not match. Values from faults.json.

import { formatRate, formatTime } from '../../model/format';
import { faultsData as d, faultsExample, faultsGpio } from '../../model/faults';
import { hexByte } from '../../model/protocols';
import { bytesHex, exampleViewOf, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const dq = faultsGpio('onewire', 'dq');
const rate = 1_000_000;
const fall = { gpio: dq, edge: 'falling' as const };
const o = d.onewire;
const pad = o.scratchpad;
const gapMs = o.startsMs[1] - o.startsMs[0];
const lengthNs = 25e6;
// DS18B20 scratchpad layout.
const byteNames = ['temperature LSB', 'temperature MSB', 'alarm high', 'alarm low', 'configuration', 'reserved', 'reserved', 'reserved', 'CRC'];

export const faultsOnewire: Lesson = {
  id: 'faults-onewire',
  track: 'faults',
  preset: 'faults',
  title: '1-Wire: nobody home, then a bad CRC',
  summary: 'A reset without a presence pulse, and a temperature reading that fails its CRC check.',
  gpios: [dq],
  intro: `The controller on GP${dq} looks for a DS18B20 temperature sensor, then ${gapMs} ms later reads its scratchpad. The firmware logs "sensor missing" and "CRC error". Find the evidence for both in the capture.`,
  parts: [
    {
      title: 'Reset, then read',
      intro: 'If your capture starts in the middle of the read, capture again: the trigger lands on the first falling edge after you start.',
      settings: {
        gpios: [dq],
        sampleRateHz: rate,
        durationNs: lengthNs,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', ...fall },
        decoder: '1-Wire, if your software has one (standard speed)',
      },
      steps: [
        ...protocolWireSteps([dq]),
        `Capture ${formatTime(lengthNs)} at ${formatRate(rate)}, triggered on the falling edge of GP${dq}.`,
        `Find the first reset: the controller pulls the line low for ${o.resetLowUs} µs. What happens after it lets go?`,
        `Find the second reset, ${gapMs} ms later. What is different after this one?`,
        'Decode the 9 bytes the sensor sends after the Read Scratchpad command (0xBE). The last one is a CRC of the first eight.',
      ],
      views: [
        exampleViewOf(faultsExample('onewire', 'absent'), fall, {
          title: 'Nobody answers',
          sampleRateHz: rate,
          caption: `A ${o.resetLowUs} µs reset, then nothing: no device pulls the line low for its ${o.presenceLowUs} µs presence pulse.`,
        }),
        exampleViewOf(faultsExample('onewire', 'bad_crc'), fall, {
          title: 'Bad CRC',
          sampleRateHz: rate,
          caption: `Reset with presence, Skip ROM, Read Scratchpad, then ${bytesHex(pad)}.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: 'What does the first reset tell you?',
      a: 'That no device answered: after the controller releases the line, a present device pulls it low for a while (the presence pulse). Here the line just stays high. On a real board: the sensor is not connected, not powered, or the pull-up is missing.',
    },
    {
      q: 'How do you know the CRC is wrong, and which byte is damaged?',
      a: `The CRC of the first eight bytes, ${bytesHex(pad.slice(0, 8))}, is ${hexByte(o.crcOfFirst8)}, but the ninth byte is ${hexByte(pad[8])}. The CRC tells you that something is wrong, not where. Here it is byte ${o.badByte}, the ${byteNames[o.badByte]}, which arrived as ${hexByte(pad[o.badByte])}. Without the check the firmware would have used a wrong value, which is exactly why the CRC exists. Real causes: a long cable, a weak pull-up, or interrupts disturbing the controller's timing.`,
    },
  ],
};
