// Verify track: every input and the skew between them, on the Verify preset's 12-bit binary counter
// (GP10-GP21). The step and pins come from verify.json; the waveforms are computed from the count.

import { formatHz, formatRate, formatTime } from '../../model/format';
import { counterGpio, counterPeriodNs, verifyData as d } from '../../model/verify';
import type { EdgeWave } from '../../model/wave';
import { pinList, wireSteps } from '../helpers';
import type { Lesson, View } from '../types';

const step = d.counter.stepNs;
const bits = d.counter.bits;
const rate = 24_000_000;
const low8 = Array.from({ length: 8 }, (_, b) => counterGpio(b));
const high = Array.from({ length: bits - 8 }, (_, i) => counterGpio(8 + i));
const all = Array.from({ length: bits }, (_, b) => counterGpio(b));
// Second capture: the remaining bits, plus the four below them so a wrap is still visible on 8 inputs.
const second = all.slice(bits - 8);
const firstBitOfSecond = bits - 8;

/**
 * Counter bits as edge lists over [startNs, endNs], with t = 0 where bit `wrapBit` falls: the count is a
 * multiple of 2^(wrapBit+1) there, so every lower bit falls at the same instant.
 */
function counterRows(gpioBits: number[], wrapBit: number, startNs: number, endNs: number) {
  const zeroCount = 2 ** (wrapBit + 1);
  return gpioBits.map((b) => {
    const levelAt = (t: number) => ((zeroCount + Math.floor(t / step)) >> b) & 1;
    const togglesNs: number[] = [];
    for (let k = Math.ceil(startNs / step); k * step < endNs; k++) {
      const t = k * step;
      if (t > startNs && levelAt(t) !== levelAt(t - step)) togglesNs.push(t);
    }
    const wave: EdgeWave = { kind: 'edges', initial: levelAt(startNs) as 0 | 1, togglesNs };
    return { gpio: counterGpio(b), wave };
  });
}

const view = (gpioBits: number[], wrapBit: number, title: string, caption: string): View => ({
  title,
  startNs: -6 * step,
  endNs: 60 * step,
  sampleRateHz: rate,
  rows: counterRows(gpioBits, wrapBit, -6 * step, 60 * step),
  caption,
});

export const counterCheck: Lesson = {
  id: 'counter-check',
  track: 'verify',
  preset: 'verify',
  title: 'Every input, and the skew between them',
  summary: 'A 12-bit binary counter gives every input its own frequency and lines up their edges, so swapped, dead or slow inputs stand out.',
  gpios: all,
  intro: `GP${all[0]} to GP${all[all.length - 1]} carry a ${bits}-bit binary counter that counts up every ${formatTime(step)}. Bit 0 (GP${all[0]}) is a ${formatHz(1e9 / counterPeriodNs(0))} square wave, and each pin after it runs at half the frequency of the one before. Whenever a bit changes, every lower bit changes at the same instant, driven by the same PIO instruction. That makes it a sharp test for an analyzer's inputs.`,
  sections: [
    {
      title: 'What the counter checks',
      body: [],
      bullets: [
        '**Every input works:** each one shows a square wave with a 50% duty cycle.',
        '**No inputs are swapped:** each one runs at exactly half the frequency of the one before it. A swap breaks the halving.',
        `**Skew:** where a higher bit falls, all the lower bits fall at the same instant (the count wraps from …0111 1111 to …1000 0000). On a good analyzer all those edges land in the same sample. An edge one sample off can be sampling luck; more than that, or always the same input late, is real skew.`,
        '**Crosstalk:** a fast input next to a slow one should not leave short glitches on the slow one.',
      ],
    },
  ],
  parts: [
    {
      title: `Bits 0 to 7 (GP${low8[0]} to GP${low8[7]})`,
      settings: {
        gpios: low8,
        sampleRateHz: rate,
        durationNs: 60 * step,
        preTriggerNs: 6 * step,
        trigger: { type: 'edge', gpio: low8[7], edge: 'falling' },
      },
      steps: [
        ...wireSteps(low8),
        `Capture at ${formatRate(rate)} (or your analyzer's top rate), triggered on the falling edge of GP${low8[7]}. At that moment the count goes from 255 to 256 in the low 8 bits: all eight inputs fall together.`,
        'Zoom in on the trigger. Do all eight edges land in the same sample?',
        `Measure the period on each input. They should double from one pin to the next: ${low8.map((_, b) => formatTime(counterPeriodNs(b))).join(', ')}.`,
        'Capture a few more times. Is any input always the late one?',
      ],
      views: [view([0, 1, 2, 3, 4, 5, 6, 7], 7, 'Bits 0 to 7', `All eight bits fall at t = 0 (count 255 to 256). Bit 0 toggles every ${formatTime(step)}.`)],
    },
    {
      title: `The rest (GP${second[0]} to GP${second[7]})`,
      settings: {
        gpios: second,
        sampleRateHz: rate,
        durationNs: 60 * step,
        preTriggerNs: 6 * step,
        trigger: { type: 'edge', gpio: second[7], edge: 'falling' },
      },
      steps: [
        `Move the probes to ${pinList(second)}: the top ${high.length} bits and the four below them, so the edges still line up on one trigger.`,
        `Capture again, triggered on the falling edge of GP${second[7]}. It only happens once per ${d.frameMs} ms frame, when the whole counter wraps to zero.`,
        'Check the same three things: one edge for all eight inputs at the trigger, halving periods, 50% duty.',
        'If your analyzer has more than 8 inputs, repeat with the probes on the inputs you have not tested yet.',
      ],
      views: [
        view(
          Array.from({ length: 8 }, (_, i) => firstBitOfSecond + i),
          bits - 1,
          `Bits ${firstBitOfSecond} to ${bits - 1}`,
          `All of them fall at t = 0, where the counter wraps to zero. The top bit has a period of ${formatTime(counterPeriodNs(bits - 1))}, so most of this capture is flat.`,
        ),
      ],
    },
  ],
  questions: [
    {
      q: 'One input shows the right signal but always one sample later than the others. Is it broken?',
      a: `At ${formatRate(rate)} one sample is ${formatTime(1e9 / rate)}. An input that is consistently late has more delay than the rest: a slower buffer, a longer trace, a different threshold on a slow edge, or a longer probe lead. Swap the probe leads between two inputs: if the lateness moves with the lead, it is the lead.`,
    },
    {
      q: 'Two inputs show the same frequency. What happened?',
      a: 'Two probes on one pin, a short between two inputs, or a swap somewhere that makes the halving look broken. Follow the frequencies: they tell you exactly which pin each input is on.',
    },
  ],
};
