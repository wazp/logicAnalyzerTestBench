// Lesson: SPI. Bytes, timings and decoded values come from protocols.json, which
// the firmware's own C++ generates, so they always match what the board sends.

import { gpioOf, hexByte, protocolData as d } from '../../model/protocols';
import { bytesHex, exampleView, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const sck = gpioOf('spi', 'sck');
const mosi = gpioOf('spi', 'mosi');
const miso = gpioOf('spi', 'miso');
const cs = gpioOf('spi', 'cs');

export const spi: Lesson = {
  id: 'spi',
  track: 'protocols',
  title: 'SPI',
  summary: 'Chip select, clock, and data both ways at once: reading a flash chip\'s ID.',
  gpios: [sck, mosi, miso, cs],
  intro: `Every ${d.spi.startsMs[1] - d.spi.startsMs[0]} ms the controller asks a simulated flash chip for its ID with command ${hexByte(d.spi.command)}. SPI sends and receives at the same time: on every clock edge one bit goes out on MOSI and one comes back on MISO. CS (chip select, active low) frames the transfer, which makes it the perfect trigger.`,
  parts: [
    {
      title: 'Read the JEDEC ID',
      settings: {
        gpios: [sck, mosi, miso, cs],
        sampleRateHz: 8_000_000,
        durationNs: 40e3,
        preTriggerNs: 2e3,
        trigger: { type: 'edge', gpio: cs, edge: 'falling' },
        decoder: `SPI: clock GP${sck}, MOSI GP${mosi}, MISO GP${miso}, CS GP${cs} (active low), mode 0, MSB first, 8 bits`,
      },
      steps: [
        ...protocolWireSteps([sck, mosi, miso, cs]),
        `Capture, triggered on the falling edge of GP${cs} (CS).`,
        'Mode 0: SCK idles low, and both sides read the data on the rising edge. Read the first 8 bits of MOSI by hand, most significant bit first.',
        'Read the three bytes that come back on MISO after the command.',
        'Add the SPI decoder. Then change it to mode 1 and see what happens to the bytes.',
      ],
      views: [
        exampleView('spi', 'jedec_id', { gpio: cs, edge: 'falling' }, {
          title: 'One transfer',
          sampleRateHz: 8_000_000,
          caption: `MOSI: ${hexByte(d.spi.command)} then zeros. MISO: released (0xFF) during the command, then ${bytesHex(d.spi.reply)}.`,
        }),
      ],
    },
  ],
  tables: [
    {
      title: 'What the bytes mean',
      head: ['Byte', 'MOSI', 'MISO', 'Meaning'],
      rows: [
        ['1', hexByte(d.spi.command), '0xFF', 'Read JEDEC ID command; the flash has not answered yet'],
        ['2', '0x00', hexByte(d.spi.reply[0]), 'Manufacturer: Winbond'],
        ['3', '0x00', hexByte(d.spi.reply[1]), 'Memory type: SPI NOR flash'],
        ['4', '0x00', hexByte(d.spi.reply[2]), 'Capacity: 2^24 bytes = 16 MB (128 Mbit)'],
      ],
    },
  ],
  questions: [
    {
      q: 'Why does the controller send zeros after the command?',
      a: 'In SPI the controller makes every clock. To receive three bytes it has to clock out three bytes, so it sends dummies while the flash answers.',
    },
    {
      q: 'What happened in mode 1?',
      a: 'Mode 1 reads on the falling edge, half a bit later, so every bit shifts by one and the bytes come out wrong. Mismatched SPI modes look exactly like this.',
    },
    {
      q: 'Why is CS such a good trigger?',
      a: 'It goes low exactly once per transfer, right before the first clock. Triggering on data lines would land in the middle of a byte.',
    },
  ],
};
