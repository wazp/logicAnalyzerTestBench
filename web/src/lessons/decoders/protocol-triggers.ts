// Decoders track: triggers that understand a protocol (a UART byte, an I²C address), where they live, and how
// to get the same capture without one. Bytes and timing come from protocols.json.

import { formatTime } from '../../model/format';
import { example, gpioOf, hexByte, protocolData as d } from '../../model/protocols';
import { exampleView, onlyPins, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const tx = gpioOf('uart', 'tx');
const scl = gpioOf('i2c', 'scl');
const sda = gpioOf('i2c', 'sda');

const first = d.uart.firstMessage.charCodeAt(0);
const messageNs = d.uart.firstMessage.length * 10 * d.uart.bitNs;
// The longest high inside a message is a run of 1 bits plus a stop bit: at most 9 bit times (a byte of 0xFF,
// then the stop bit). Between messages the line idles for milliseconds. A high longer than this is an idle gap.
const longestInsideNs = 10 * d.uart.bitNs;
const idleNs = 1e6;
const nak = example('i2c', 'nak');

export const protocolTriggers: Lesson = {
  id: 'protocol-triggers',
  track: 'decoders',
  title: 'Triggering on a protocol event',
  summary: 'Trigger on a UART byte or an I²C address where your analyzer can, and the edge and pulse tricks that get you there where it cannot.',
  gpios: [tx, scl, sda],
  intro:
    'An edge trigger fires on the first edge it sees, which on a bus is usually the middle of something. What you mostly want is "the start of a message", "the byte 0x54", or "the transaction to address 0x49". Some analyzers and apps can trigger on exactly that; many cannot. This lesson shows what a protocol trigger does, and how to get the same capture with the plain triggers every analyzer has.',
  sections: [
    {
      title: 'What a protocol trigger is',
      body: [
        'A protocol trigger decodes the bus while it waits, and fires on a decoded event: a UART byte with a given value, an I²C address (often with read or write, ACK or NAK), an SPI byte while chip select is active, a CAN message ID. You set it up with the same settings as a decoder: pins, baud rate or mode, address format.',
        'Where it runs matters. **In the analyzer hardware**, it fires the moment the event happens, so the capture holds what came before (pre-trigger) and after, even for an event that happens once an hour. **In the software after the capture**, it is really a search: it finds the event in what you already recorded, which only works when the capture is long enough to contain it. Both are useful; only the first catches a rare event without a huge capture. The documentation of your analyzer says which it has, if any.',
      ],
    },
    {
      title: 'Without one',
      body: ['Most protocol events have a plain signature that an edge, pulse or pattern trigger can catch:'],
      bullets: [
        `**The start of a message: a pulse trigger.** Inside a UART message the line is never high for longer than about ${formatTime(longestInsideNs)} at ${d.uart.baud} baud; between messages it idles for much longer. A trigger on "high longer than ${formatTime(idleNs)}" fires on the first start bit after a pause: always the beginning of a message, never the middle.`,
        '**The start of a transaction: an edge on a select line.** SPI has chip select, many devices have an interrupt or enable line. Trigger on that rather than on the clock.',
        '**One transaction among many: trigger early, capture long, search.** Trigger on anything that comes before it, record long enough to contain it, and use the decoder\'s search, as in the "Finding one event in a long recording" lesson.',
        '**Something that comes before it.** A reset, a button, a chip select of another device: if the event always follows something easier to trigger on, trigger there and use the capture length to reach it.',
      ],
    },
  ],
  parts: [
    {
      title: 'Always the start of a message',
      intro: `GP${tx} sends a message every ${d.uart.messageStartsMs[1] - d.uart.messageStartsMs[0]} ms. An edge trigger lands on whichever start bit comes first after you start the capture, often in the middle of a message.`,
      settings: {
        gpios: [tx],
        sampleRateHz: 2_000_000,
        durationNs: messageNs + 100e3,
        preTriggerNs: 50e3,
        trigger: { type: 'pulse', gpio: tx, level: 1, longerThanNs: idleNs },
        decoder: `UART on GP${tx}: ${d.uart.baud} baud, 8N1`,
      },
      steps: [
        ...protocolWireSteps([tx, scl, sda]),
        `If your analyzer has a UART protocol trigger: set it to ${d.uart.baud} baud, 8N1, byte \`${hexByte(first)}\` ("${String.fromCharCode(first)}", the first character of every message). Capture a few times.`,
        `Otherwise, if it has a pulse width trigger: a high pulse on GP${tx} longer than ${formatTime(idleNs)}, as in the settings. Capture a few times.`,
        `With only an edge trigger: trigger on the falling edge of GP${tx} and capture a few times. How often does the capture start with "${String.fromCharCode(first)}"?`,
        'With the protocol or pulse trigger, every capture starts at the same place: the start bit of the first character.',
      ],
      views: [
        onlyPins(
          exampleView('uart', 'first_character', { gpio: tx, edge: 'falling' }, {
            title: 'The first character',
            sampleRateHz: 2_000_000,
            caption: `Every capture starts here: the start bit of "${String.fromCharCode(first)}" after a long idle high.`,
          }),
          [tx],
        ),
      ],
    },
    {
      title: 'Only the NAK',
      intro: `The I²C controller reads the sensor at \`${hexByte(d.i2c.address)}\` ${d.i2c.readStartsMs.length} times per frame, and once tries \`${hexByte(d.i2c.missingAddress)}\`, which nobody answers. An edge trigger on SDA catches a read almost every time.`,
      settings: {
        gpios: [scl, sda],
        sampleRateHz: 2_000_000,
        durationNs: nak.durationNs + 50e3,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', gpio: sda, edge: 'falling' },
        decoder: `I²C with SCL on GP${scl} and SDA on GP${sda}`,
      },
      steps: [
        `If your analyzer has an I²C protocol trigger: set it to address \`${hexByte(d.i2c.missingAddress)}\` (7-bit; some software wants the 8-bit form, \`${hexByte(d.i2c.missingAddress << 1)}\` for a write), and to NAK if it offers that. Capture: the trigger waits until the NAK comes, at most one frame later.`,
        `Without one, the edge trigger in the settings catches a read at \`${hexByte(d.i2c.address)}\` most of the time. To find the NAK, trigger the same way but capture longer than one frame and search for the address, as in "Finding one event in a long recording".`,
        'Either way, check what you caught: the address byte, then SDA left high on the ninth clock, then a STOP.',
      ],
      views: [
        exampleView('i2c', 'nak', { gpio: sda, edge: 'falling' }, {
          title: 'The NAK',
          sampleRateHz: 2_000_000,
          caption: `The address \`${hexByte(d.i2c.missingAddress)}\` with write, then SDA stays high on the ninth clock: no device answered.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: `Why ${formatTime(idleNs)} for the pulse trigger, not ${formatTime(100e3)} or ${formatTime(20e6)}?`,
      a: `It must be longer than any high inside a message (at most about ${formatTime(longestInsideNs)}) and shorter than the pause between messages (${formatTime((d.uart.messageStartsMs[1] - d.uart.messageStartsMs[0]) * 1e6 - messageNs)} here). ${formatTime(100e3)} would also work; ${formatTime(20e6)} too, until the device sends messages closer together. Pick something in the middle of the gap.`,
    },
    {
      q: 'Your software has an I²C "trigger", but the capture is always the same length as before and the event is sometimes missing. What kind is it?',
      a: 'A software one: it searches the finished capture. It cannot find an event that is not in the recording. Capture longer than the time between events, or use a hardware trigger or one of the plain-trigger tricks.',
    },
  ],
};
