// Lesson: when the decoder shows garbage. Each part decodes a known transaction with deliberately wrong
// settings, so the learner sees what each mistake looks like. Bytes come from protocols.json.

import { formatTime } from '../../model/format';
import { gpioOf, hexByte, protocolData as d, visibleText } from '../../model/protocols';
import { bytesHex, exampleView, onlyPins, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const tx = gpioOf('uart', 'tx');
const scl = gpioOf('i2c', 'scl');
const sda = gpioOf('i2c', 'sda');
const sck = gpioOf('spi', 'sck');
const mosi = gpioOf('spi', 'mosi');
const miso = gpioOf('spi', 'miso');
const cs = gpioOf('spi', 'cs');
const pins = [tx, scl, sda, sck, mosi, miso, cs];

/** A byte with its bit order reversed, as a decoder set to the wrong bit order reads it. */
const reverseBits = (b: number) => {
  let r = 0;
  for (let i = 0; i < 8; i++) if (b & (1 << i)) r |= 1 << (7 - i);
  return r;
};

const addr = d.i2c.address;
const addrWrite = (addr << 1) | 0;
const addrRead = (addr << 1) | 1;
const spiBytes = [d.spi.command];
const spiReply = d.spi.reply as number[];
const bin = (b: number) => b.toString(2).padStart(8, '0');
// A reply byte that reads the same in both bit orders, if there is one: the case that hides the mistake.
const mirrorSafe = spiReply.find((b) => reverseBits(b) === b);

export const decoderGarbage: Lesson = {
  id: 'decoder-garbage',
  track: 'protocols',
  title: 'When the decoder shows garbage',
  summary: 'Wrong baud rate, shifted addresses, bit order, SPI mode and swapped lines: what each mistake looks like, on purpose.',
  gpios: pins,
  intro:
    'A decoder only knows what you tell it. Give it one wrong setting and it shows garbage, errors, or worse, plausible-looking wrong data. The quickest way to recognize these mistakes is to make each one on purpose, on a signal you know. Every part here records a protocol you have already read by hand, then decodes it with a wrong setting.',
  sections: [
    {
      title: 'First, measure',
      body: [
        'When a decode looks wrong, do not guess settings one after another. Measure one thing by hand that tells you the setting: the narrowest pulse for a UART baud rate, the clock idle level and which edge data changes on for an SPI mode, the first byte after a START for an I²C address. Then set the decoder to match.',
      ],
    },
  ],
  parts: [
    {
      title: 'UART: baud rate and polarity',
      settings: {
        gpios: [tx],
        sampleRateHz: 2_000_000,
        durationNs: 2e6,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', gpio: tx, edge: 'falling' },
        decoder: `UART on GP${tx}: ${d.uart.baud} baud, 8N1, then the wrong settings in the steps`,
      },
      steps: [
        ...protocolWireSteps(pins),
        `Capture GP${tx}, triggered on its falling edge. Decode it as UART at ${d.uart.baud} baud, 8N1: you should read \`${visibleText(d.uart.firstMessage)}\`.`,
        `Change only the baud rate to ${d.uart.baud / 2}. Then try ${d.uart.baud * 2}. What does the decoder show?`,
        `Set it back to ${d.uart.baud}, and invert the signal (the decoder may call it polarity or idle low). What happens now?`,
      ],
      views: [
        onlyPins(
          exampleView('uart', 'first_character', { gpio: tx, edge: 'falling' }, {
            title: 'One character',
            sampleRateHz: 2_000_000,
            caption: `The bit time is ${formatTime(d.uart.bitNs)}. A decoder set to a different rate samples in the wrong places, so the bits it reads have little to do with these.`,
          }),
          [tx],
        ),
      ],
    },
    {
      title: 'I²C: one address, two numbers',
      settings: {
        gpios: [scl, sda],
        sampleRateHz: 2_000_000,
        durationNs: 600e3,
        preTriggerNs: 20e3,
        trigger: { type: 'edge', gpio: sda, edge: 'falling' },
        decoder: `I²C with SCL on GP${scl} and SDA on GP${sda}`,
      },
      steps: [
        `Capture GP${scl} and GP${sda}, triggered on the falling edge of GP${sda}, and decode as I²C.`,
        'Look at the first byte after the START. Does your decoder show the address as one number for both the write and the read, or a different number for each?',
        'If your decoder has an address format option (7-bit or 8-bit, with or without the read/write bit), switch it and compare.',
        `Now assign the decoder's SCL to GP${sda} and SDA to GP${scl}, the wrong way round. What does it show?`,
      ],
      views: [
        exampleView('i2c', 'read', { gpio: sda, edge: 'falling' }, {
          title: 'Register read',
          sampleRateHz: 2_000_000,
          caption: `The address byte is the 7-bit address ${hexByte(addr)} followed by the read/write bit: ${hexByte(addrWrite)} to write, ${hexByte(addrRead)} to read.`,
        }),
      ],
    },
    {
      title: 'SPI: bit order, mode and chip select',
      settings: {
        gpios: [sck, mosi, miso, cs],
        sampleRateHz: 8_000_000,
        durationNs: 40e3,
        preTriggerNs: 2e3,
        trigger: { type: 'edge', gpio: cs, edge: 'falling' },
        decoder: `SPI: clock GP${sck}, MOSI GP${mosi}, MISO GP${miso}, CS GP${cs} (active low), mode ${d.spi.mode}, MSB first, 8 bits, then the wrong settings in the steps`,
      },
      steps: [
        `Capture the four SPI pins, triggered on the falling edge of GP${cs}. Decode with the right settings: MOSI ${bytesHex(spiBytes)}, MISO ${bytesHex(spiReply)} after the command.`,
        'Change the bit order to LSB first. Which bytes do you get now?',
        `Set it back, and change the SPI mode from ${d.spi.mode} to 1, then 2, then 3.`,
        'Set the mode back, and make chip select active high. Then leave chip select out of the decoder altogether, if it allows that.',
      ],
      views: [
        exampleView('spi', 'jedec_id', { gpio: cs, edge: 'falling' }, {
          title: 'One transfer',
          sampleRateHz: 8_000_000,
          caption: `MOSI sends ${bytesHex(spiBytes)}; MISO answers ${bytesHex(spiReply)}. Data changes on falling SCK edges and is read on rising ones (mode ${d.spi.mode}).`,
        }),
      ],
    },
  ],
  tables: [
    {
      title: 'Wrong settings and what they look like',
      head: ['Wrong setting', 'What the decoder shows'],
      rows: [
        ['UART baud rate', 'Random characters, framing errors, often fewer or more characters than were sent'],
        ['UART polarity', 'Errors on almost every character: the idle level looks like a never-ending start bit'],
        ['I²C address format', `The right traffic with a different address: ${hexByte(addr)} as ${hexByte(addrWrite)}/${hexByte(addrRead)}, or the other way round`],
        ['I²C lines swapped', 'No START found, or a few nonsense bytes'],
        ['SPI bit order', `Every byte mirrored: ${bytesHex(spiReply)} becomes ${bytesHex(spiReply.map(reverseBits))}`],
        ['SPI mode', 'Bytes shifted by a bit, or values that change between captures: plausible, and wrong'],
        ['SPI chip select', 'Nothing, or all the bytes run together without transaction boundaries'],
      ],
    },
  ],
  questions: [
    {
      q: `A datasheet says the sensor is at ${hexByte(addrWrite)}, and your decoder shows ${hexByte(addr)}. Who is wrong?`,
      a: `Neither. ${hexByte(addrWrite)} is the 7-bit address ${hexByte(addr)} shifted left with the write bit (0) added. Some datasheets and decoders use the 7-bit form, some the 8-bit one. Shift right by one to compare: ${hexByte(addrWrite)} >> 1 = ${hexByte(addr)}.`,
    },
    {
      q: `With LSB first, the flash's answer reads ${bytesHex(spiReply.map(reverseBits))}. Why that, exactly?`,
      a: `The decoder reads the same 8 bits in reverse order. ${hexByte(spiReply[0])} is ${bin(spiReply[0])} in binary; backwards that is ${bin(reverseBits(spiReply[0]))}, which is ${hexByte(reverseBits(spiReply[0]))}.${mirrorSafe === undefined ? '' : ` ${hexByte(mirrorSafe)} (${bin(mirrorSafe)}) reads the same both ways and does not change, which can fool you into thinking the setting is right.`}`,
    },
    {
      q: 'Which wrong setting is the most dangerous, and why?',
      a: 'The SPI mode. A wrong baud rate or swapped lines give obvious errors, but a wrong SPI mode can give clean-looking bytes that are simply wrong. Always check the mode from the capture: the clock\'s idle level, and whether data changes on the first or the second clock edge.',
    },
  ],
};
