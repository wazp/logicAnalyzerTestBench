// Concept: planning long captures around the analyzer's memory or USB bandwidth. The worked example uses
// the protocol frame schedule from protocols.json, so its numbers match what the board plays.

import { formatCount, formatRate, formatTime } from '../../model/format';
import { frameMs, protocolData as d } from '../../model/protocols';
import type { Lesson } from '../types';

const frameNs = frameMs * 1e6;
// The fastest protocol detail on the frame: one SPI clock period. Four samples per period for a usable shape.
const spiPeriodNs = 1e9 / d.spi.clockHz;
const fullRate = 4 * d.spi.clockHz;
// I²C at its clock rate needs far less: four samples per I²C clock period.
const i2cRate = 4 * d.i2c.clockHz;
const inputs = 8;
const samplesAt = (rate: number, ns: number) => Math.round((rate * ns) / 1e9);
const fullFrameSamples = samplesAt(fullRate, frameNs);
const i2cFrameSamples = samplesAt(i2cRate, frameNs);
// One I²C read, from the exported example, captured at the full rate.
const i2cReadNs = d.i2c.examples.find((e: { label: string }) => e.label === 'read')!.durationNs;
const oneReadSamples = samplesAt(fullRate, i2cReadNs);

export const memoryDepth: Lesson = {
  id: 'memory-depth',
  track: 'concepts',
  title: 'Memory depth and long captures',
  summary: 'How many samples a capture needs, why your analyzer runs out, and how to fit what you need anyway.',
  gpios: [],
  intro:
    'Sooner or later a capture does not fit: the analyzer refuses the settings, stops early, or the software shows only part of it. That is not a fault but a budget. This lesson shows how to work out what a capture costs, and the usual ways to make it fit.',
  sections: [
    {
      title: 'The budget',
      body: [
        'A capture needs **sample rate × length** samples on every input. Ten inputs need ten times as many in total. Where they go depends on the analyzer (the "How a logic analyzer works" lesson describes the types):',
      ],
      bullets: [
        '**Buffered** analyzers have a fixed memory. More inputs or a higher rate means a shorter capture. Many let you trade inputs for depth: half the inputs, twice the samples each.',
        '**Streaming** analyzers send samples over USB as they go. The length is almost unlimited, but the total rate (rate × inputs) is capped by USB, and a busy computer or a hub can make them stop with an error partway.',
        '**Compressing** analyzers store only the changes. A quiet signal costs almost nothing however long you record; a busy one costs a lot. The budget then depends on the signal, not just the settings.',
        '**The software** has its own limits: some programs show only a slice of a long capture on screen at once, so you scroll or zoom to see the rest.',
      ],
    },
    {
      title: 'A worked example',
      body: [
        `The protocol pins repeat every ${frameMs} ms. Recording the whole frame on ${inputs} inputs, fast enough for the SPI clock (${formatTime(spiPeriodNs)} per period, so ${formatRate(fullRate)} for four samples per period), takes ${formatCount(fullFrameSamples)} samples per input, ${formatCount(fullFrameSamples * inputs)} in total. That is more than many small analyzers can store, and it is mostly idle time.`,
        `The same frame at ${formatRate(i2cRate)}, fast enough for I²C but not SPI, is ${formatCount(i2cFrameSamples)} samples per input. One I²C read at the full rate is only ${formatCount(oneReadSamples)}. The cheapest capture is almost always the one that starts at the right moment and stops when the event is over.`,
      ],
      table: {
        title: 'What each choice costs, per input',
        head: ['Capture', 'Rate', 'Length', 'Samples'],
        rows: [
          ['Whole frame, every detail', formatRate(fullRate), formatTime(frameNs), formatCount(fullFrameSamples)],
          ['Whole frame, I²C detail', formatRate(i2cRate), formatTime(frameNs), formatCount(i2cFrameSamples)],
          ['One I²C read, triggered', formatRate(fullRate), formatTime(i2cReadNs), formatCount(oneReadSamples)],
        ],
      },
    },
    {
      title: 'Making it fit',
      body: ['In rough order of how much they save:'],
      bullets: [
        '**Trigger instead of recording everything.** A trigger on the start of the event (CS going low, a start bit) lets you record only that. See the Triggers lesson.',
        '**Lower the rate to what the signal needs.** Four samples per period of the fastest signal you care about for its shape, ten for timing. Faster than that only costs memory.',
        '**Record fewer inputs.** Leave out lines you do not need for this question; on many analyzers the rest get deeper memory or more bandwidth.',
        '**Capture twice.** One slow, long capture to find when things happen, then a fast, short one triggered on the part you care about. The "What is this signal?" lesson works this way.',
        '**Use compression** if your analyzer has it, for long recordings of mostly quiet lines.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: `You need ${formatTime(frameNs)} on 4 inputs at ${formatRate(fullRate)}. How many samples is that, and what could you change if it does not fit?`,
      a: `${formatCount(fullFrameSamples)} per input, ${formatCount(fullFrameSamples * 4)} in total. If it does not fit: trigger on the event you care about and record less, or lower the rate if the fastest signal you need allows it.`,
    },
    {
      q: 'Your streaming analyzer stops partway with a buffer or overflow error at a high sample rate. What helps?',
      a: 'Less data per second: fewer inputs, a lower rate, or a direct USB port instead of a hub, and closing other busy programs. The length does not matter for streaming; the rate times the number of inputs does.',
    },
    {
      q: 'A compressing analyzer records an hour of a 1 Hz signal easily, but only a second of a 1 MHz clock. Why?',
      a: 'It stores changes, not samples. The 1 Hz signal changes twice a second; the 1 MHz clock changes two million times a second. With compression, busy signals use up the memory, not long captures.',
    },
  ],
};
