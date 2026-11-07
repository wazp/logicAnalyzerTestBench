// Find the bug: SPI. A transfer cut short by chip select, and a device in the wrong SPI mode. Values from
// faults.json.

import { faultsData as d, faultsExample, faultsGpio } from '../../model/faults';
import { hexByte } from '../../model/protocols';
import { bytesHex, exampleViewOf, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const sck = faultsGpio('spi', 'sck');
const mosi = faultsGpio('spi', 'mosi');
const miso = faultsGpio('spi', 'miso');
const cs = faultsGpio('spi', 'cs');
const pins = [sck, mosi, miso, cs];
const rate = 8_000_000;
const csFall = { gpio: cs, edge: 'falling' as const };

// What a mode 0 decoder reads from the wrong-mode device: every bit one clock late. MISO idles high before the
// first clock, and the first byte (during the command) is 0xFF.
const sent = [0xff, ...d.spi.reply];
const shifted = sent.map((b, i) => ((i === 0 ? 1 : sent[i - 1] & 1) << 7) | (b >> 1));

export const faultsSpi: Lesson = {
  id: 'faults-spi',
  track: 'faults',
  preset: 'faults',
  title: 'SPI: cut short, and the wrong mode',
  summary: 'A transfer aborted by chip select, and a device whose answer is shifted by one bit.',
  gpios: pins,
  intro: `The controller reads the flash's JEDEC ID (${hexByte(d.spi.command)}, expecting ${bytesHex(d.spi.reply)}) twice per frame. One attempt is cut short and retried; the other gets a wrong answer every time. Find both.`,
  parts: [
    {
      title: 'Catch both transfers',
      intro: 'The trigger lands on whichever transfer comes next, so capture a few times until you have seen both.',
      settings: {
        gpios: pins,
        sampleRateHz: rate,
        durationNs: 300e3,
        preTriggerNs: 2e3,
        trigger: { type: 'edge', ...csFall },
        decoder: `SPI: clock GP${sck}, MOSI GP${mosi}, MISO GP${miso}, CS GP${cs} (active low), mode ${d.spi.mode}, MSB first, 8 bits`,
      },
      steps: [
        ...protocolWireSteps(pins),
        `Capture the four SPI pins, triggered on the falling edge of GP${cs}, and decode as SPI mode ${d.spi.mode}.`,
        'If CS goes low twice: count the clock pulses in the first CS frame. What does the decoder make of the incomplete byte?',
        `If CS goes low once: what does MISO answer? Compare it with ${bytesHex(d.spi.reply)}.`,
        'Zoom in on MISO in that transfer. On which clock edge does it change, and on which edge does the controller read it?',
        'Decode that transfer again in mode 1. What do you get now?',
      ],
      views: [
        exampleViewOf(faultsExample('spi', 'abort'), csFall, {
          title: 'Aborted, then retried',
          sampleRateHz: rate,
          caption: `CS rises after ${d.spi.abortBits} clocks, half way through the second byte. ${d.spi.retryAfterUs} µs later the controller starts again and the full transfer works.`,
        }),
        exampleViewOf(faultsExample('spi', 'mode1'), csFall, {
          title: 'Device in the wrong mode',
          sampleRateHz: rate,
          caption: `MISO changes ${d.spi.mode1DelayNs} ns after each rising edge, the edge the controller samples on, so it reads the previous bit every time.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: 'Why would a controller raise CS in the middle of a byte?',
      a: `Usually because its own transfer was interrupted: a timeout, a higher-priority task taking the bus, or a driver bug that ends the transaction early. The device discards the partial command, which is why the retry ${d.spi.retryAfterUs} µs later works. A decoder shows the incomplete byte as an error, or not at all.`,
    },
    {
      q: 'What does a mode 0 decoder read from the wrong-mode device, and why?',
      a: `${bytesHex(shifted)} instead of ${bytesHex(sent)}. The device changes MISO just after each rising edge (mode 1 behavior), but in mode 0 the rising edge is when the controller samples, so it always gets the previous bit: the whole answer shifted right by one. Decoded in mode 1, the answer reads ${bytesHex(d.spi.reply)} after the command byte. The fix is to set the controller and the device to the same mode.`,
    },
    {
      q: 'Why is a wrong SPI mode so easy to miss?',
      a: `Because nothing errors out: you get clean bytes that are simply wrong, and sometimes they are even right (a byte with all its bits equal looks the same shifted). Look at which clock edge the data changes on, every time you bring up a new SPI device.`,
    },
  ],
};
