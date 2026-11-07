// Lesson: timing between two signals. The UART reply delay, SPI data against its clock, and the quadrature
// phase, all measured from the exported examples in protocols.json, so every number matches the firmware.

import { formatRate, formatTime } from '../../model/format';
import { example, firstEdgeNs, gpioOf, protocolData as d } from '../../model/protocols';
import { exampleViewOf, protocolWireSteps } from '../helpers';
import type { Lesson, View } from '../types';

const tx = gpioOf('uart', 'tx');
const rx = gpioOf('uart', 'rx');
const sck = gpioOf('spi', 'sck');
const mosi = gpioOf('spi', 'mosi');
const cs = gpioOf('spi', 'cs');
const qa = gpioOf('quadrature', 'a');
const qb = gpioOf('quadrature', 'b');
const pins = [tx, rx, sck, mosi, cs, qa, qb];

const togglesOf = (e: ReturnType<typeof example>, gpio: number) => e.traces.find((t) => t.gpio === gpio)!.togglesNs;

// UART: every message ends with "\n", whose top bit is 0, so the last TX edge is the rise into the stop bit.
const uartEx = example('uart', 'message_and_reply');
const txToggles = togglesOf(uartEx, tx);
const txLastEdgeNs = txToggles[txToggles.length - 1];
const txEndNs = txLastEdgeNs + d.uart.bitNs;
const rxStartNs = firstEdgeNs(uartEx, rx, 'falling');
const replyGapNs = rxStartNs - txEndNs;
const uartRate = 2_000_000;

// SPI mode 0: MOSI changes when CS falls and on falling SCK edges; SCK rises half a clock period later.
const spiEx = example('spi', 'jedec_id');
const csFallNs = firstEdgeNs(spiEx, cs, 'falling');
const sckRiseNs = firstEdgeNs(spiEx, sck, 'rising');
const csToClockNs = sckRiseNs - csFallNs;
const sckToggles = togglesOf(spiEx, sck);
const mosiToggles = togglesOf(spiEx, mosi);
// For every MOSI change, the time to the next rising SCK edge (SCK idles low, so rising edges are the even toggles).
const sckRises = sckToggles.filter((_, i) => i % 2 === 0);
const setupsNs = mosiToggles.map((t) => sckRises.find((r) => r > t)! - t);
const setupNs = Math.min(...setupsNs);
const spiRate = 12_000_000;

// Quadrature: A and B are square waves a quarter period apart; one step per edge on either line.
const quadEx = example('quadrature', 'turnaround');
const aRiseNs = firstEdgeNs(quadEx, qa, 'rising');
const bRiseNs = firstEdgeNs(quadEx, qb, 'rising');
const quadPhaseNs = bRiseNs - aRiseNs;
const quadPeriodNs = 4 * d.quadrature.stepUs * 1e3;
const quadRate = 100_000;

/** A view with only the given pins, for examples that also carry pins this part does not record. */
const onlyPins = (v: View, gpios: number[]): View => ({ ...v, rows: v.rows?.filter((r) => gpios.includes(r.gpio)) });

const resolution = (rate: number) => formatTime(1e9 / rate);

export const timingBetween: Lesson = {
  id: 'timing-between',
  track: 'learn',
  title: '10. Timing between two signals',
  summary: 'Measure the delay from an edge on one pin to an edge on another: a reply delay, a setup time and a phase.',
  gpios: pins,
  intro:
    'Many bugs are not in what a signal says but in when it says it: a device that answers too late, data that changes too close to the clock edge, two sensors out of step. A logic analyzer records every input against the same clock, so the time between an edge on one pin and an edge on another is as easy to measure as a pulse width. This lesson measures three kinds of delay on the protocol pins.',
  sections: [
    {
      title: 'Measuring between pins',
      body: [
        'Place one marker (or cursor) on the edge where the delay starts, and one on the edge where it ends, even if they are on different pins. The time between the markers is the delay. Most software also shows the time from the trigger to any point, which works just as well when the first edge is the trigger.',
        'Your result can be off by up to one sample period: each edge is only known to within one sample, and the error of the two edges adds up to at most one period. At 1 MS/s that is 1 µs. Pick a sample rate that makes this small compared with the delay you measure; a tenth of it or less is a good aim.',
      ],
      bullets: [
        '**Delay:** from an event on one pin to the answer on another, like a reply after a request.',
        '**Setup time:** how long data is stable before the clock edge that reads it. Too short, and the receiver reads the old bit.',
        '**Phase:** how far apart two repeating signals are, as a time or as a fraction of the period (a quarter period is 90°).',
      ],
    },
  ],
  parts: [
    {
      title: 'A reply delay',
      intro: `The simulated device on GP${rx} answers every message on GP${tx}. How long does it wait?`,
      settings: {
        gpios: [tx, rx],
        sampleRateHz: uartRate,
        durationNs: 3e6,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', gpio: tx, edge: 'falling' },
      },
      steps: [
        ...protocolWireSteps(pins),
        `Capture, triggered on the falling edge of GP${tx}.`,
        `Find the end of the message on GP${tx}: the last character ends with a stop bit, one bit time after the last rising edge.`,
        `Place one marker there and one on the first falling edge on GP${rx}, the start of the reply. Read the time between them.`,
        `How precise is your number? At ${formatRate(uartRate)}, each edge is known to within ${resolution(uartRate)}.`,
      ],
      views: [
        exampleViewOf(uartEx, { gpio: tx, edge: 'falling' }, {
          title: 'Message and reply',
          sampleRateHz: uartRate,
          caption: `The message ends ${formatTime(txEndNs - firstEdgeNs(uartEx, tx, 'falling'))} after the trigger, and the reply starts ${formatTime(replyGapNs)} later.`,
        }),
      ],
    },
    {
      title: 'Data against its clock',
      intro: `In SPI mode ${d.spi.mode}, the sender changes MOSI when CS goes low and on every falling SCK edge, and the receiver reads it on the next rising edge. The time in between is the setup time.`,
      settings: {
        gpios: [sck, mosi, cs],
        sampleRateHz: spiRate,
        durationNs: 40e3,
        preTriggerNs: 2e3,
        trigger: { type: 'edge', gpio: cs, edge: 'falling' },
      },
      steps: [
        `Keep the same wiring. Capture GP${sck}, GP${mosi} and GP${cs}, triggered on the falling edge of GP${cs}.`,
        `Measure from CS going low to the first rising edge of SCK.`,
        `Find a place where MOSI changes. Measure from that change to the next rising edge of SCK.`,
        `Does MOSI ever change close to a rising SCK edge? At ${formatRate(spiRate)}, one sample is ${resolution(spiRate)}.`,
      ],
      views: [
        onlyPins(
          exampleViewOf(spiEx, { gpio: cs, edge: 'falling' }, {
            title: 'One transaction',
            sampleRateHz: spiRate,
            caption: `SCK first rises ${formatTime(csToClockNs)} after CS falls. Every MOSI change comes ${formatTime(setupNs)} or more before the rising edge that reads it.`,
          }),
          [sck, mosi, cs],
        ),
      ],
    },
    {
      title: 'The phase between two signals',
      intro: `GP${qa} and GP${qb} are the two outputs of a rotary encoder: the same square wave, shifted.`,
      settings: {
        gpios: [qa, qb],
        sampleRateHz: quadRate,
        durationNs: 20e6,
        preTriggerNs: 1e6,
        trigger: { type: 'edge', gpio: qa, edge: 'rising' },
      },
      steps: [
        `Capture GP${qa} and GP${qb}, triggered on the rising edge of GP${qa}.`,
        `Measure the period of GP${qa}: from one rising edge to the next.`,
        `Measure from a rising edge of GP${qa} to the nearest rising edge of GP${qb}. Divide by the period: what fraction of a period is that?`,
        'Look further along the capture. Does the other signal ever change first?',
      ],
      views: [
        exampleViewOf(quadEx, { gpio: qa, edge: 'rising' }, {
          title: 'A and B',
          sampleRateHz: quadRate,
          caption: `Each line has a period of ${formatTime(quadPeriodNs)}. B follows A by ${formatTime(quadPhaseNs)}, a quarter period, until the encoder turns around and A follows B.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: 'How long does the device wait before it replies?',
      a: `${formatTime(replyGapNs)}, from the end of the stop bit of the message to the start bit of the reply. Measured from the last rising edge on GP${tx} instead, you get one bit time more: ${formatTime(rxStartNs - txLastEdgeNs)}. Always say which two edges you measured between.`,
    },
    {
      q: 'What is the SPI setup time, and why is it that number?',
      a: `${formatTime(setupNs)}, half of the ${formatTime(1e9 / d.spi.clockHz)} clock period: the sender changes MOSI on a falling edge, and the receiver reads it on the rising edge half a period later. A setup time this generous is why mode ${d.spi.mode} is so robust. CS falls ${formatTime(csToClockNs)} before the first clock edge, which gives the receiver the same time to wake up.`,
    },
    {
      q: 'What is the phase between A and B?',
      a: `${formatTime(quadPhaseNs)} of a ${formatTime(quadPeriodNs)} period: a quarter period, or 90°. Which one leads tells the direction, which the Quadrature encoder lesson uses.`,
    },
    {
      q: `Why is ${formatRate(quadRate)} enough for the encoder, but not for SPI?`,
      a: `At ${formatRate(quadRate)} each edge is known to within ${resolution(quadRate)}, tiny next to a ${formatTime(quadPhaseNs)} phase. For SPI, ${resolution(quadRate)} is longer than the whole ${formatTime(setupNs)} setup time, so you could not tell whether the data changed before or after the clock edge.`,
    },
  ],
};
