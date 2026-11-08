// Find the bug: glitch hunting. An interrupt line with two real pulses and three glitches of different widths.
// Times and widths from faults.json.

import { formatRate, formatTime } from '../../model/format';
import { faultsData as d, faultsExample, faultsGpio } from '../../model/faults';
import type { EdgeWave } from '../../model/wave';
import { exampleViewOf, protocolWireSteps, scrollStep } from '../helpers';
import type { Lesson, View } from '../types';

const irq = faultsGpio('irq', 'irq');
const fall = { gpio: irq, edge: 'falling' as const };
const pulses = d.irq.pulses;
const glitches = pulses.filter((p) => p.glitch);
const real = pulses.filter((p) => !p.glitch);
const slowRate = 1_000_000;
const fastRate = 24_000_000;
const sampleNs = (rate: number) => 1e9 / rate;
/** Chance that at least one sample lands inside a low pulse of `widthNs`, sampled at `rate`. */
const catchChance = (widthNs: number, rate: number) => Math.min(1, widthNs / sampleNs(rate));
const pct = (p: number) => `${Math.round(p * 100)}%`;
const longestGlitch = Math.max(...glitches.map((g) => g.widthNs));
const pulseTriggerNs = 1000;

// The whole-frame example starts at the frame start; the first falling edge is the first pulse or glitch.
const frameExample = faultsExample('irq', 'frame');
const firstAtNs = pulses[0].atMs * 1e6;

/** One glitch on its own, for a view at the analyzer's top rate. */
const glitchView = (widthNs: number): View => {
  const wave: EdgeWave = { kind: 'edges', initial: 1, togglesNs: [0, widthNs] };
  return {
    title: `${formatTime(widthNs)} glitch`,
    startNs: -300,
    endNs: 500,
    sampleRateHz: fastRate,
    rows: [{ gpio: irq, wave }],
    caption: `At ${formatRate(fastRate)} one sample is ${formatTime(sampleNs(fastRate))}, so a ${formatTime(widthNs)} glitch is caught about ${pct(catchChance(widthNs, fastRate))} of the time.`,
  };
};

export const faultsGlitch: Lesson = {
  id: 'faults-glitch',
  track: 'faults',
  preset: 'faults',
  title: 'Glitch hunting',
  summary: 'An interrupt line fires when it should not. Find the glitches, and learn why a slow capture never will.',
  gpios: [irq],
  intro: `GP${irq} is an active-low interrupt line. It should pulse low for ${formatTime(d.irq.pulseNs)}, ${real.length} times per frame, and the firmware sees ${pulses.length} interrupts. Somewhere there are ${glitches.length} glitches, the shortest only ${formatTime(Math.min(...glitches.map((g) => g.widthNs)))} wide. A chip's interrupt input sees every one of them; your analyzer may not.`,
  sections: [
    {
      title: 'Why glitches are hard to see',
      body: [
        'An analyzer only knows the level at each sample. A low pulse shorter than one sample period is caught only if a sample happens to land inside it: the shorter the glitch, the lower the chance. At a low rate even a long glitch can vanish completely.',
        'Two ways around it: sample fast enough that each glitch spans at least one sample, which fills memory quickly, or let the analyzer watch for it with a **pulse-width trigger** ("low for less than 1 µs"), if yours has one. Some analyzers also have a glitch or transition detector that flags pulses shorter than a sample.',
      ],
    },
  ],
  parts: [
    {
      title: 'A slow overview',
      settings: {
        gpios: [irq],
        sampleRateHz: slowRate,
        durationNs: frameExample.durationNs - firstAtNs,
        preTriggerNs: firstAtNs,
        trigger: { type: 'edge', ...fall },
      },
      steps: [
        ...protocolWireSteps([irq]),
        `Capture a whole frame at ${formatRate(slowRate)}, triggered on the falling edge of GP${irq}.`,
        `Count the low pulses. How many of the ${pulses.length} interrupts do you see?`,
        scrollStep,
        'Capture a few more times. Does anything else show up now and then?',
      ],
      views: [
        exampleViewOf(frameExample, fall, {
          title: 'The whole frame',
          sampleRateHz: slowRate,
          caption: `Two ${formatTime(d.irq.pulseNs)} pulses are always there. At ${formatRate(slowRate)} (${formatTime(sampleNs(slowRate))} per sample) the glitches are caught at most ${pct(catchChance(longestGlitch, slowRate))} of the time: almost never.`,
        }),
      ],
    },
    {
      title: 'Trigger on the glitch',
      intro: `If your analyzer has a pulse-width trigger, set it to a low pulse shorter than ${formatTime(pulseTriggerNs)}. It then ignores the real ${formatTime(d.irq.pulseNs)} pulses and fires only on a glitch.`,
      settings: {
        gpios: [irq],
        sampleRateHz: fastRate,
        durationNs: 20e3,
        preTriggerNs: 5e3,
        trigger: { type: 'pulse', gpio: irq, level: 0, shorterThanNs: pulseTriggerNs },
      },
      steps: [
        `Capture at ${formatRate(fastRate)} with the pulse-width trigger. Capture again a few times: which glitch widths do you catch?`,
        'Without a pulse-width trigger: capture as long as your analyzer allows at its highest rate, and search the capture for narrow low pulses.',
        'Measure each glitch. Why does the shortest one sometimes show as one sample wide, and sometimes not at all?',
      ],
      views: glitches.map((g) => glitchView(g.widthNs)),
    },
  ],
  questions: [
    {
      q: 'Where are the glitches, and how wide are they?',
      a: glitches.map((g) => `${formatTime(g.widthNs)} at ${g.atMs} ms`).join(', ') + ` into the frame, between the real pulses at ${real.map((p) => `${p.atMs} ms`).join(' and ')}.`,
    },
    {
      q: `How often does ${formatRate(fastRate)} catch each glitch?`,
      a: `${glitches.map((g) => `${formatTime(g.widthNs)}: about ${pct(catchChance(g.widthNs, fastRate))}`).join(', ')}. Even at the top rate of a small analyzer the shortest glitch is a coin toss, and when it is caught it shows as one sample (${formatTime(sampleNs(fastRate))}), so its width cannot be measured. That is a job for a faster analyzer or a scope.`,
    },
    {
      q: 'What causes glitches like these on real boards?',
      a: 'Crosstalk from a neighboring fast signal, ground bounce when many outputs switch at once, a slow edge with noise on it, or logic that briefly passes through a wrong state (a race between two signals). An interrupt input that reacts to edges counts every one of them.',
    },
  ],
};
