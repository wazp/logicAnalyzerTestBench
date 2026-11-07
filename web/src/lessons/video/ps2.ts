// Lesson: a PS/2 keyboard. Bytes and timings come from video.json, which the
// firmware's own C++ generates.

import { formatHz, formatTime } from '../../model/format';
import { hexByte } from '../../model/protocols';
import { videoData, videoExample, videoGpio } from '../../model/video';
import { exampleViewOf, lsbFirst, placedRows, scrollStep, wireSteps } from '../helpers';
import type { Lesson } from '../types';

const clock = videoGpio('ps2', 'clock');
const data = videoGpio('ps2', 'data');
const pins = [clock, data];
const k = videoData.ps2;
const make = videoExample('ps2', 'make');
const brk = videoExample('ps2', 'break');
const clockFall = { gpio: clock, edge: 'falling' } as const;
const releaseAfterNs = (k.breakStartMs - k.makeStartMs) * 1e6;

const ones = (b: number) => b.toString(2).split('').filter((c) => c === '1').length;
const parity = (b: number) => (ones(b) % 2 === 0 ? 1 : 0);
const frameBits = (b: number) => `0 ${lsbFirst(b)} ${parity(b)} 1`;

const rate = 1_000_000;
const longNs = 25e6;

export const ps2Keyboard: Lesson = {
  id: 'ps2-keyboard',
  track: 'video',
  preset: 'video',
  title: 'PS/2 keyboard',
  summary: 'Decode key presses from a keyboard that sends its own clock.',
  gpios: pins,
  intro: `GP${clock} and GP${data} play a PS/2 keyboard pressing the ${k.keyName} key, then letting go. PS/2 is the round keyboard and mouse connector of 1990s PCs, and the same two-wire protocol shows up in retro computer projects and keyboard adapters. Unlike UART, the keyboard sends a clock with every bit, so the speed does not need to be known in advance.`,
  sections: [
    {
      title: 'How a byte is sent',
      body: [
        `Both lines idle high. The keyboard drives the **clock**, at ${formatHz(k.clockHz)} here (keyboards use 10 to 16.7 kHz), and puts each bit on **data** while the clock is high. The computer reads the bit on the **falling** edge.`,
        'Every byte is 11 bits: a start bit (0), the 8 data bits **least significant first**, a parity bit that makes the number of ones odd, and a stop bit (1).',
        `Keys send **scan codes**, not letters. Pressing ${k.keyName} sends ${hexByte(k.key)} (the "make" code); releasing it sends ${hexByte(k.breakPrefix)} followed by the same code (the "break" code).`,
      ],
    },
  ],
  parts: [
    {
      title: 'One byte',
      settings: {
        gpios: pins,
        sampleRateHz: rate,
        durationNs: 1.2e6,
        preTriggerNs: 200e3,
        trigger: { type: 'edge', gpio: clock, edge: 'falling' },
        decoder: `PS/2 on GP${clock} (clock) and GP${data} (data)`,
      },
      steps: [
        ...wireSteps(pins),
        `Capture, triggered on a falling edge of GP${clock}. The keyboard is quiet most of the time, so the trigger nearly always lands on the start bit of a byte.`,
        'Read data at each falling clock edge: the start bit, 8 data bits (least significant first), parity and stop.',
        `Turn the 8 data bits into a byte. If you got ${hexByte(k.breakPrefix)}, you caught the key being released: capture again, or go on to the next part.`,
        'Add the PS/2 decoder from the settings card and compare.',
      ],
      views: [
        exampleViewOf(make, clockFall, {
          title: 'Key down',
          sampleRateHz: rate,
          caption: `Data at the 11 falling clock edges: ${frameBits(k.key)}. The data bits ${lsbFirst(k.key)}, least significant first, are ${hexByte(k.key)}: the make code of ${k.keyName}. Each bit takes ${formatTime(k.bitNs)}.`,
        }),
      ],
    },
    {
      title: 'Press and release',
      settings: {
        gpios: pins,
        sampleRateHz: rate,
        durationNs: longNs,
        preTriggerNs: 1e6,
        trigger: { type: 'edge', gpio: clock, edge: 'falling' },
        decoder: `PS/2 on GP${clock} (clock) and GP${data} (data)`,
      },
      steps: [
        `Capture ${formatTime(longNs)}, with the same trigger.`,
        'Find the three bytes and decode each one. Which is the press and which is the release?',
        scrollStep,
      ],
      views: [
        {
          title: 'Down, then up',
          startNs: -1e6,
          endNs: longNs,
          sampleRateHz: rate,
          rows: placedRows(
            [
              { e: make, atNs: 0 },
              { e: brk, atNs: releaseAfterNs },
            ],
            clockFall,
          ),
          caption: `${hexByte(k.key)} when the key goes down, then ${hexByte(k.breakPrefix)} ${hexByte(k.key)} ${formatTime(releaseAfterNs)} later when it comes up. If your capture starts with the release, the next press follows the same time later.`,
        },
        exampleViewOf(brk, clockFall, {
          title: 'Key up',
          sampleRateHz: rate,
          caption: `${hexByte(k.breakPrefix)} (${frameBits(k.breakPrefix)}), a pause, then ${hexByte(k.key)} again: "${k.keyName} released".`,
        }),
      ],
    },
  ],
  tables: [
    {
      title: 'The bytes on the wire',
      head: ['Byte', 'Meaning', 'Bits at the falling edges (start, data, parity, stop)'],
      rows: [
        [hexByte(k.key), `${k.keyName} pressed (make code)`, frameBits(k.key)],
        [hexByte(k.breakPrefix), 'the next code is a release', frameBits(k.breakPrefix)],
        [hexByte(k.key), `${k.keyName} released (after ${hexByte(k.breakPrefix)})`, frameBits(k.key)],
      ],
    },
  ],
  questions: [
    {
      q: `What is the parity bit for ${hexByte(k.key)}, and why?`,
      a: `${hexByte(k.key)} has ${ones(k.key)} ones. Odd parity makes the total odd, so the parity bit is ${parity(k.key)}. A receiver that counts an even number of ones knows the byte was damaged.`,
    },
    {
      q: 'Who decides the speed, and why does the computer not care exactly what it is?',
      a: `The keyboard drives the clock, so the computer simply reads data on every falling edge, whatever the rate. That is the difference from UART, where both sides must agree on the baud rate in advance. The computer can still pull the clock line low itself to make the keyboard wait.`,
    },
    {
      q: 'What would you see if the key were held down for a few seconds?',
      a: `The make code ${hexByte(k.key)} repeated: after a delay of about half a second, keyboards send it again about ten times per second until the key is released (the "typematic" repeat), then ${hexByte(k.breakPrefix)} ${hexByte(k.key)} once. This board releases the key right away, so you only see one of each.`,
    },
  ],
};
