// Lesson: 1-Wire. Bytes, timings and decoded values come from protocols.json, which
// the firmware's own C++ generates, so they always match what the board sends.

import { gpioOf, hexByte, protocolData as d } from '../../model/protocols';
import { bytesHex, exampleView, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const dq = gpioOf('onewire', 'dq');
const pad = d.onewire.scratchpad;
const rawTemp = pad[0] | (pad[1] << 8);

export const onewire: Lesson = {
  id: 'onewire',
  track: 'protocols',
  title: '1-Wire',
  summary: 'Reset, presence, time slots: reading a DS18B20 temperature sensor.',
  gpios: [dq],
  intro: `A simulated DS18B20 temperature sensor shares one wire with the controller. At ${d.onewire.convertAtMs} ms the controller starts a temperature conversion, and at ${d.onewire.readAtMs} ms it reads the result. Every bit is a time slot that starts with the line pulled low; how long it stays low is the bit.`,
  parts: [
    {
      title: 'Reset and presence',
      settings: {
        gpios: [dq],
        sampleRateHz: 1_000_000,
        durationNs: 8e6,
        preTriggerNs: 100e3,
        trigger: { type: 'edge', gpio: dq, edge: 'falling' },
        decoder: '1-Wire: the link layer decoder, then the network layer on top, standard speed',
      },
      steps: [
        ...protocolWireSteps([dq]),
        `Capture, triggered on the falling edge of GP${dq}. If the capture does not start with a long low pulse, capture again.`,
        'Measure the first low pulse: the reset. Shortly after it ends, the sensor answers with a shorter low pulse: the presence pulse.',
        'Look at the time slots after it. Short low = 1, long low = 0, least significant bit first. Read the first byte.',
        'Capture a few more times until you get the longer sequence that reads 9 bytes back. Add the decoder and read the temperature.',
      ],
      views: [
        exampleView('onewire', 'reset', { gpio: dq, edge: 'falling' }, {
          title: 'Reset',
          sampleRateHz: 1_000_000,
          caption: 'Controller low for 480 µs, then the sensor pulls low for 120 µs: "I am here".',
        }),
        exampleView('onewire', 'convert', { gpio: dq, edge: 'falling' }, {
          title: 'Convert',
          sampleRateHz: 1_000_000,
          caption: 'Reset, then 0xCC (Skip ROM: talk to the only device) and 0x44 (Convert T).',
        }),
        exampleView('onewire', 'read', { gpio: dq, edge: 'falling' }, {
          title: 'Read',
          sampleRateHz: 1_000_000,
          caption: 'Reset, 0xCC, 0xBE (Read Scratchpad), then the sensor sends 9 bytes.',
        }),
      ],
    },
  ],
  tables: [
    {
      title: 'The scratchpad the sensor sends',
      head: ['Byte', 'Value', 'Meaning'],
      rows: [
        ['0', hexByte(pad[0]), 'temperature, low byte'],
        ['1', hexByte(pad[1]), 'temperature, high byte'],
        ['2', hexByte(pad[2]), 'alarm high limit'],
        ['3', hexByte(pad[3]), 'alarm low limit'],
        ['4', hexByte(pad[4]), 'configuration: 12-bit resolution'],
        ['5-7', bytesHex(pad.slice(5, 8)), 'reserved'],
        ['8', hexByte(pad[8]), 'CRC of bytes 0-7'],
      ],
    },
  ],
  questions: [
    {
      q: 'What temperature did you read?',
      a: `Bytes 0 and 1 form ${hexByte(pad[1])}${pad[0].toString(16).toUpperCase().padStart(2, '0')} = ${rawTemp}, in steps of 0.0625 °C: ${d.onewire.temperatureC} °C.`,
    },
    {
      q: 'How does the controller read a bit if it only has one wire?',
      a: 'It pulls the line low briefly to start the slot and lets go. For a 1 the sensor does nothing and the line goes high; for a 0 the sensor keeps it low a bit longer. The controller looks at the line about 15 µs into the slot.',
    },
    {
      q: 'Why is there a CRC byte?',
      a: 'One long wire picks up noise. The CRC lets the controller check the 8 bytes arrived intact and read again if not.',
    },
  ],
};
