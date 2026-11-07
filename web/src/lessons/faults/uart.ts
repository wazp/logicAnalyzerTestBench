// Find the bug: UART. A sender with a slow clock, a framing error and a parity error, each next to a good
// message. Every value comes from faults.json, which the firmware's own C++ generates.

import { formatPercent, formatRate, formatTime } from '../../model/format';
import { faultsData as d, faultsExample, faultsGpio } from '../../model/faults';
import { hexByte, visibleText } from '../../model/protocols';
import { exampleViewOf, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const tx = faultsGpio('uart', 'tx');
const tx2 = faultsGpio('parity', 'tx');
const rate = 1_000_000;
const lengthNs = (d.frameMs + 5) * 1e6;
const fall = (gpio: number) => ({ gpio, edge: 'falling' as const });

const badChar = d.uart.messages[2][d.uart.badStopIndex];
const parityChar = d.parity.text[d.parity.badIndex];
const ones = (c: string) => c.charCodeAt(0).toString(2).split('').filter((b) => b === '1').length;
const errorPercent = (100 * (d.uart.slowBitNs - d.uart.bitNs)) / d.uart.bitNs;

export const faultsUart: Lesson = {
  id: 'faults-uart',
  track: 'faults',
  preset: 'faults',
  title: 'UART: three ways to get it wrong',
  summary: 'A sender with a slow clock, a framing error and a parity error, each next to a good message.',
  gpios: [tx, tx2],
  intro: `A device on GP${tx} sends three messages per frame and a second device on GP${tx2} sends a reading twice, with even parity. The board's owner says "serial sometimes shows rubbish". Find out which messages are wrong, and how. The good messages are there to compare with.`,
  parts: [
    {
      title: 'One whole frame',
      settings: {
        gpios: [tx, tx2],
        sampleRateHz: rate,
        durationNs: lengthNs,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', ...fall(tx) },
        decoder: `UART on GP${tx}: ${d.uart.baud} baud, 8N1. UART on GP${tx2}: ${d.parity.baud} baud, 8 data bits, even parity, 1 stop bit`,
      },
      steps: [
        ...protocolWireSteps([tx, tx2]),
        `Capture ${formatTime(lengthNs)} at ${formatRate(rate)}, triggered on the falling edge of GP${tx}. That is a whole frame, so every message is in it.`,
        `Decode GP${tx} as ${d.uart.baud} baud 8N1. Which message has an error, and on which character?`,
        `Measure the bit time in each of the three messages on GP${tx}, over a whole character rather than one bit. Is any of them different?`,
        `Decode GP${tx2} with even parity. Which character does the decoder flag? Count its ones to check.`,
      ],
      views: [
        exampleViewOf(faultsExample('uart', 'good'), fall(tx), {
          title: 'Good',
          sampleRateHz: rate,
          caption: `\`${visibleText(d.uart.messages[0])}\` at ${d.uart.baud} baud: ${formatTime(d.uart.bitNs)} per bit.`,
        }),
        exampleViewOf(faultsExample('uart', 'slow'), fall(tx), {
          title: 'Slow sender',
          sampleRateHz: rate,
          caption: `The same kind of message, but every bit is ${formatTime(d.uart.slowBitNs)}: the whole message is ${formatPercent(errorPercent)} longer.`,
        }),
        exampleViewOf(faultsExample('uart', 'framing'), fall(tx), {
          title: 'Framing error',
          sampleRateHz: rate,
          caption: `After \`${badChar}\` the line stays low where the stop bit should be high, so the next start bit has no falling edge.`,
        }),
        exampleViewOf(faultsExample('parity', 'bad'), fall(tx2), {
          title: 'Parity error',
          sampleRateHz: rate,
          caption: `\`${visibleText(d.parity.text)}\` with even parity; the parity bit of \`${parityChar}\` is wrong.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: `The second message on GP${tx} decodes fine. What is wrong with it?`,
      a: `Its bits are ${formatTime(d.uart.slowBitNs)} instead of ${formatTime(d.uart.bitNs)}: the sender runs at about ${d.uart.slowBaud} baud, ${d.uart.slowPercent}% slow. A decoder at ${d.uart.baud} still reads it, because the error grows to about a third of a bit by the stop bit, inside the half bit a receiver can tolerate. A receiver whose own clock is 2% off the other way would fail. This is the classic "works on my desk" bug: measure the bit time, do not trust a clean decode.`,
    },
    {
      q: 'What is the framing error, and why does the rest of the message look wrong too?',
      a: `The stop bit after \`${badChar}\` (${hexByte(badChar.charCodeAt(0))}) is low. A receiver reports a framing error there. The next start bit then begins without a falling edge, so the receiver loses step and may read the rest of the message as different characters. On real hardware this comes from noise, a wrong baud rate, or a sender reset mid-character.`,
    },
    {
      q: `Why is \`${parityChar}\` flagged, and how do you check it by hand?`,
      a: `${hexByte(parityChar.charCodeAt(0))} has ${ones(parityChar)} ones. With even parity the parity bit makes the total even, so it should be ${ones(parityChar) % 2}; it is ${1 - (ones(parityChar) % 2)}. Parity catches any single flipped bit, but not two.`,
    },
  ],
};
