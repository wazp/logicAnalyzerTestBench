// Lesson: UART. Bytes, timings and decoded values come from protocols.json, which
// the firmware's own C++ generates, so they always match what the board sends.

import { formatTime } from '../../model/format';
import { gpioOf, hexByte, protocolData as d, visibleText } from '../../model/protocols';
import { bits, exampleView, lsbFirst, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const tx = gpioOf('uart', 'tx');
const rx = gpioOf('uart', 'rx');
const firstChar = d.uart.firstMessage.charCodeAt(0);

export const uart: Lesson = {
  id: 'uart',
  track: 'protocols',
  title: 'UART (serial)',
  summary: 'The serial port: find the baud rate from a single bit, then read text by hand.',
  gpios: [tx, rx],
  intro: `GP${tx} sends \`${visibleText(d.uart.firstMessage)}\` and similar messages every ${d.uart.messageStartsMs[1] - d.uart.messageStartsMs[0]} ms. A simulated device answers \`${visibleText(d.uart.reply)}\` on GP${rx} shortly after. UART has no clock line: both sides agree on the speed (the baud rate) beforehand, and every character starts with a falling edge.`,
  parts: [
    {
      title: 'Find the bit time',
      settings: {
        gpios: [tx, rx],
        sampleRateHz: 2_000_000,
        durationNs: 3e6,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', gpio: tx, edge: 'falling' },
        decoder: `UART (async serial) on GP${tx} and GP${rx}: ${d.uart.baud} baud, 8 data bits, no parity, 1 stop bit`,
      },
      steps: [
        ...protocolWireSteps([tx, rx]),
        `Capture, triggered on the falling edge of GP${tx}. The line idles high, so the first falling edge is a start bit.`,
        'Zoom into the first character. Find the narrowest high or low stretch: that is one bit. Measure it.',
        'Baud rate = 1 / bit time. Which standard rate is it?',
        'Read the first character by hand: skip the start bit, then read 8 bits. The first bit on the wire is the least significant one.',
        'Now add the UART decoder from the settings card and read the whole message and the reply.',
      ],
      views: [
        exampleView('uart', 'first_character', { gpio: tx, edge: 'falling' }, {
          title: 'First character',
          sampleRateHz: 2_000_000,
          caption: `Start bit, then ${lsbFirst(firstChar)} (least significant bit first), then the stop bit. Each bit is ${formatTime(d.uart.bitNs)}.`,
        }),
        exampleView('uart', 'message_and_reply', { gpio: tx, edge: 'falling' }, {
          title: 'Message and reply',
          caption: `The whole message on GP${tx}, then the device's reply on GP${rx} ${d.uart.replyDelayMs} ms later.`,
        }),
      ],
    },
  ],
  tables: [
    {
      title: 'The first message, byte by byte',
      head: ['Character', 'Hex', 'Bits as sent (first to last)'],
      rows: [...d.uart.firstMessage].map((c) => [c === ' ' ? 'space' : visibleText(c), hexByte(c.charCodeAt(0)), `0 ${lsbFirst(c.charCodeAt(0))} 1`]),
    },
  ],
  questions: [
    {
      q: 'What baud rate did you find?',
      a: `${formatTime(d.uart.bitNs)} per bit, so ${d.uart.baud} baud. Your measurement can be off by a sample or two; pick the nearest standard rate (9600, 19200, 38400, 57600, 115200...).`,
    },
    {
      q: 'What does the decoder show with the wrong baud rate, say 9600?',
      a: 'Garbage characters and framing errors: it samples at the wrong moments and finds a low stop bit. Wrong baud rate is the most common UART problem, and a logic analyzer shows it instantly.',
    },
    {
      q: `The first character is ${hexByte(firstChar)}. Why does it look "backwards" on the wire?`,
      a: `UART sends the least significant bit first. ${hexByte(firstChar)} is ${bits(firstChar)} in binary, which goes out as ${lsbFirst(firstChar)}.`,
    },
  ],
};
