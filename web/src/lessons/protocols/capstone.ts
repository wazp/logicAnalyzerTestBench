// Protocols capstone: seven pins whose names the page hides. Identify each protocol, its settings and what it
// says, choosing every capture yourself. Every answer comes from protocols.json (the firmware's own encoders).

import { formatHz, formatRate, formatTime } from '../../model/format';
import { frameMs, gpioOf, hexByte, protocolData as d, visibleText } from '../../model/protocols';
import { andList, bytesHex, protocolWireSteps } from '../helpers';
import type { CaptureSettings } from '../../model/capture';
import type { Lesson } from '../types';

const tx = gpioOf('uart', 'tx');
const scl = gpioOf('i2c', 'scl');
const sda = gpioOf('i2c', 'sda');
const led = gpioOf('ws2812', 'data');
const ir = gpioOf('ir', 'out');
const qa = gpioOf('quadrature', 'a');
const qb = gpioOf('quadrature', 'b');
const pins = [tx, scl, sda, led, ir, qa, qb];

const messageNs = d.uart.firstMessage.length * 10 * d.uart.bitNs;
const ledFrameNs = d.ws2812.leds * 24 * d.ws2812.bitNs;
const ledValues = [...new Set(d.ws2812.firstColors.flatMap((c) => [c.g, c.r, c.b]))].sort((a, b) => a - b);
// NEC: leader, gap, 32 bits of a pulse plus a short (0) or long (1) gap, LSB first, and a final pulse.
const necBytes = [d.ir.address, ~d.ir.address & 0xff, d.ir.command, ~d.ir.command & 0xff];
const necOnes = necBytes.reduce((n, b) => n + b.toString(2).split('1').length - 1, 0);
const necFrameNs = (d.ir.leaderUs + d.ir.leaderSpaceUs + (32 + necOnes * 2 + 32 + 1) * d.ir.unitUs) * 1e3;
const message = (n: number) => visibleText(`${d.uart.messageText}${n}\r\n`);

const detail = (gpios: number[], sampleRateHz: number, durationNs: number, trigger: CaptureSettings['trigger']) => ({
  gpios,
  sampleRateHz,
  durationNs,
  preTriggerNs: 0,
  trigger,
});

export const protocolsCapstone: Lesson = {
  id: 'protocols-capstone',
  track: 'protocols',
  capstone: true,
  mystery: true,
  title: 'Capstone: seven unknown pins',
  summary: 'Five protocols on seven unlabeled pins: find which is which, its settings, and the message it carries.',
  gpios: pins,
  intro: `Seven pins, five protocols from this track, and the page will not say which is where. For each one, find out three things, the way you would on a board you have never seen: **what** it is (and which pins belong together), its **settings** (baud rate, clock, address, mode), and **what it says**. Everything on these pins repeats every ${frameMs} ms. Try to finish before opening any worked capture.`,
  parts: [
    {
      title: 'Survey',
      steps: [
        ...protocolWireSteps(pins),
        'Capture all seven pins at once, long enough to contain everything that repeats. Note for each pin its idle level, whether it moves in bursts or all the time, and how often.',
        'Which pins move together? Pins whose bursts always start at the same moment probably belong to one bus.',
        'For each pin or group, measure the shortest pulse. That and the idle level narrow it down to one or two protocols.',
      ],
      settings: detail(pins, 200_000, frameMs * 1e6, { type: 'none' }),
      views: [],
    },
    {
      title: `GP${tx}`,
      steps: [
        'Capture one whole burst: a trigger that catches its start, a rate that resolves its shortest pulse well, and a length that holds the burst.',
        'Find its settings from the timing, then read it by hand. Check with a decoder if your software has one.',
      ],
      settings: detail([tx], 2_000_000, messageNs + 200e3, { type: 'edge', gpio: tx, edge: 'falling' }),
      views: [],
    },
    {
      title: `GP${scl} and GP${sda}`,
      steps: [
        'One of these is a clock. On which edge does the other one change, and when is it read?',
        'Capture one burst and read it by hand: who is talking to whom, and what is said? Does every burst look the same?',
      ],
      settings: detail([scl, sda], 2_000_000, 1e6, { type: 'edge', gpio: sda, edge: 'falling' }),
      views: [],
    },
    {
      title: `GP${led}`,
      steps: [
        'The bits here are in the width of each high pulse. Find the two widths, and how many bits a burst holds.',
        'Read the first few bytes. Do they change from one burst to the next?',
      ],
      settings: detail([led], 24_000_000, ledFrameNs + 60e3, { type: 'edge', gpio: led, edge: 'rising' }),
      views: [],
    },
    {
      title: `GP${ir}`,
      steps: [
        'This one is slow, and its bits are in the gaps between equal pulses. Find the two gap lengths and read the bits.',
        'Is there a second, shorter burst after the first? What could it mean?',
      ],
      settings: detail([ir], 100_000, (d.ir.repeatStartMs - d.ir.frameStartMs) * 1e6 + 15e6, {
        type: 'edge',
        gpio: ir,
        edge: 'falling',
      }),
      views: [],
    },
    {
      title: `GP${qa} and GP${qb}`,
      steps: ['What do these two do over a whole repetition? Count, and find what changes and when.'],
      settings: detail([qa, qb], 100_000, (2 * d.quadrature.steps + 10) * d.quadrature.stepUs * 1e3, { type: 'none' }),
      views: [],
    },
  ],
  questions: [
    {
      q: 'Which protocol is on which pin?',
      a: `**GP${tx}:** UART transmit. **GP${scl} and GP${sda}:** I²C, clock and data. **GP${led}:** WS2812 LED data. **GP${ir}:** an NEC infrared remote, as the output of an IR receiver (active low). **GP${qa} and GP${qb}:** a quadrature encoder, A and B.`,
    },
    {
      q: 'How could you tell them apart in the survey?',
      a: `GP${tx} idles high and sends bursts of about ${formatTime(messageNs)} every ${d.uart.messageStartsMs[1] - d.uart.messageStartsMs[0]} ms with one fixed shortest pulse: UART. GP${scl} and GP${sda} idle high and burst together, one of them a steady clock: I²C. GP${led} idles low and sends short bursts of ${formatTime(ledFrameNs)} every ${d.ws2812.startsMs[1] - d.ws2812.startsMs[0]} ms with pulses under ${formatTime(1000)}: WS2812. GP${ir} idles high and starts with a ${formatTime(d.ir.leaderUs * 1e3)} low: an IR remote's leader. GP${qa} and GP${qb} toggle all the time at the same rate, a quarter period apart: quadrature.`,
    },
    {
      q: `GP${tx}: settings and message?`,
      a: `${d.uart.baud} baud (one bit is ${formatTime(d.uart.bitNs)}), ${d.uart.format}. Four messages per ${frameMs} ms, "${message(1)}" to "${message(d.uart.messageCount)}". A capture of ${formatTime(messageNs + 200e3)} at ${formatRate(2_000_000)}, triggered on the falling edge of the start bit, holds one whole message.`,
    },
    {
      q: `GP${scl} and GP${sda}: settings and content?`,
      a: `I²C at ${formatHz(d.i2c.clockHz)}. The controller writes register \`${hexByte(d.i2c.register)}\` to the device at address \`${hexByte(d.i2c.address)}\`, then with a repeated START reads two bytes, \`${bytesHex(d.i2c.value)}\`: a TMP102-style temperature sensor reporting ${d.i2c.temperatureC} °C. Once per ${frameMs} ms it also addresses \`${hexByte(d.i2c.missingAddress)}\`, which nobody answers: a NAK. Triggering on the falling edge of SDA catches a START, since SDA idles high.`,
    },
    {
      q: `GP${led}: settings and content?`,
      a: `WS2812 at ${formatHz(1e9 / d.ws2812.bitNs)}: a high of ${formatTime(d.ws2812.t0hNs)} is a 0, ${formatTime(d.ws2812.t1hNs)} a 1. Each burst has ${d.ws2812.leds * 24} bits: ${d.ws2812.leds} LEDs of 24 bits, green, red, blue. The byte values are ${andList(ledValues.map(hexByte).map((h) => `\`${h}\``))}; which LED gets which color shifts from one update to the next. Telling the widths apart needs a fast rate: at ${formatRate(24_000_000)} they are ${Math.round((d.ws2812.t0hNs * 24) / 1000)} and ${Math.round((d.ws2812.t1hNs * 24) / 1000)} samples.`,
    },
    {
      q: `GP${ir}: settings and content?`,
      a: `NEC: a ${formatTime(d.ir.leaderUs * 1e3)} low leader and a ${formatTime(d.ir.leaderSpaceUs * 1e3)} gap, then 32 bits where a short gap (${formatTime(d.ir.unitUs * 1e3)}) is a 0 and a long one (${formatTime(3 * d.ir.unitUs * 1e3)}) a 1, LSB first: address \`${hexByte(d.ir.address)}\`, its inverse, command \`${hexByte(d.ir.command)}\`, its inverse. A repeat code (a leader with a ${formatTime(d.ir.repeatSpaceUs * 1e3)} gap and no data) follows ${formatTime((d.ir.repeatStartMs - d.ir.frameStartMs) * 1e6)} after the start: the button is still held. ${formatRate(100_000)} is plenty; the whole frame takes ${formatTime(necFrameNs)}.`,
    },
    {
      q: `GP${qa} and GP${qb}: what are they doing?`,
      a: `A rotary encoder turning ${d.quadrature.steps} steps one way with GP${qa} leading, then ${d.quadrature.steps} steps back with GP${qb} leading, one step every ${formatTime(d.quadrature.stepUs * 1e3)}. A capture longer than ${formatTime(d.quadrature.steps * d.quadrature.stepUs * 1e3)} always contains a turnaround.`,
    },
  ],
};
