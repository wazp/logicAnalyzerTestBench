// Verify track: how fast can your analyzer really go? Count the pulses in bursts of known frequencies on GP22
// (Verify preset). Frequencies, periods and times come from verify.json.

import { formatHz, formatRate } from '../../model/format';
import { burstGpio, verifyData as d, verifyExample } from '../../model/verify';
import { exampleViewOf, wireSteps } from '../helpers';
import type { Lesson } from '../types';

const rate = 24_000_000;
const bursts = d.bursts;
const periods = bursts[0].periods;
const rise = { gpio: burstGpio, edge: 'rising' as const };
const last = bursts[bursts.length - 1];
const lengthNs = Math.ceil((last.endNs - bursts[0].startNs) / 1e4) * 1e4 + 10e3;
const samplesPerPeriod = (hz: number) => rate / hz;
/** A burst can only be counted right if every high and every low half lands on at least one sample. */
const countable = (hz: number) => samplesPerPeriod(hz) > 2;
const fastestCountable = bursts.find((b) => countable(b.hz))!;

export const speedTest: Lesson = {
  id: 'speed-test',
  track: 'verify',
  preset: 'verify',
  title: 'How fast can your analyzer really go?',
  summary: `Count the pulses in bursts from ${formatHz(bursts[0].hz)} down to ${formatHz(last.hz)} to find where your analyzer stops keeping up.`,
  gpios: [burstGpio],
  intro: `GP${burstGpio} plays ${bursts.length} bursts, each exactly ${periods} periods of a square wave, from ${formatHz(bursts[0].hz)} down to ${formatHz(last.hz)}. An analyzer that keeps up shows ${periods} pulses in every burst. Where the count goes wrong, you have found a limit: either the sample rate, or the input circuit itself, which on many analyzers gives up well below the advertised rate.`,
  sections: [
    {
      title: 'Two limits',
      body: [
        `**The sample rate.** To count a square wave, every high half and every low half must contain at least one sample, so the rate must be more than twice the frequency. At ${formatRate(rate)} that means below ${formatHz(rate / 2)}; above it the burst shows fewer pulses, or a slower frequency that is not there (aliasing).`,
        '**The inputs.** Each input has a buffer and protection circuit with a limited bandwidth, and long probe leads add capacitance. Fast edges turn into small, slow swings that may not cross the threshold at all. An analyzer can sample at 100 MS/s and still lose a 25 MHz signal at its inputs. That limit only shows on real signals, which is what this test is for.',
      ],
      table: {
        title: `What ${formatRate(rate)} can count`,
        head: ['Burst', 'Samples per period', `Countable at ${formatRate(rate)}?`],
        rows: bursts.map((b) => [formatHz(b.hz), samplesPerPeriod(b.hz).toFixed(2), countable(b.hz) ? 'yes' : 'no']),
      },
    },
  ],
  parts: [
    {
      title: 'Count every burst',
      settings: {
        gpios: [burstGpio],
        sampleRateHz: rate,
        durationNs: lengthNs,
        preTriggerNs: 5e3,
        trigger: { type: 'edge', ...rise },
      },
      steps: [
        ...wireSteps([burstGpio]),
        'Use a short ground lead, close to GP22: at these speeds the wiring matters.',
        `Capture at your analyzer's highest rate (${formatRate(rate)} is enough to see the idea), triggered on the rising edge of GP${burstGpio}. The bursts repeat every ${d.frameMs} ms; the trigger lands on the fastest one.`,
        `Count the pulses in each burst, slowest first. Every burst should have ${periods}.`,
        `Find the fastest burst that still shows ${periods} evenly spaced pulses. Is it where the table predicts for your rate, or lower?`,
        'If your analyzer is faster than 24 MS/s, repeat at its top rate. If a burst still comes out wrong although the rate is high enough, the inputs are the limit.',
      ],
      views: [
        exampleViewOf(verifyExample('bursts'), rise, {
          title: 'All bursts',
          sampleRateHz: rate,
          sampleRateOptions: [rate, 50_000_000, 100_000_000, 200_000_000],
          caption: `As recorded at different rates. At ${formatRate(rate)} the bursts from ${formatHz(fastestCountable.hz)} down count right; the faster ones do not.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: `At ${formatRate(rate)}, what does the ${formatHz(bursts[0].hz)} burst look like?`,
      a: `With fewer than one sample per half period, the samples land at a different point of each period and trace out a slow pattern that is not there, or miss pulses entirely. It never shows ${periods} clean pulses. ${formatHz(bursts[0].hz)} needs more than ${formatRate(2 * bursts[0].hz)}, and in practice four times the frequency or more to see a clean shape.`,
    },
    {
      q: 'Your analyzer samples at 100 MS/s, yet the 25 MHz burst shows only some pulses, or none. What now?',
      a: 'The sample rate is fine (4 samples per period), so the inputs are the limit: the signal is too small or too rounded at the input to cross the threshold. Try a shorter lead and ground, a lower threshold setting if there is one, and another input. If it stays, that input is good to about the fastest burst that still counts right.',
    },
    {
      q: `Why does each burst last exactly ${periods} periods?`,
      a: `So you know what to count. A burst that shows ${periods - 1} or ${periods + 1} pulses is not "roughly right": a pulse was lost or invented, which is exactly what would corrupt a protocol at that speed.`,
    },
  ],
};
