// Verify track: sanity check of every input. Every number shown is computed from signals.json (the firmware's
// own config), so the lesson stays correct when the defaults change.

import { formatHz, formatPercent, formatTime } from '../../model/format';
import { periodNs } from '../../model/signals';
import { pinList, sig, wireSteps } from '../helpers';
import type { Lesson } from '../types';

export const sanityCheck: Lesson = {
  id: 'sanity-check',
  track: 'verify',
  title: 'Sanity check: every input',
  summary: 'Confirm that each input of your analyzer records correct levels and timing.',
  gpios: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  intro:
    'A quick health check, handy for a hand-built or second-hand analyzer. Every pin carries a different, known signal, so a dead, stuck, swapped or bridged input stands out. The slow signals need a long, slow capture and the fast ones a short, fast capture, so this takes two captures.',
  parts: [
    {
      title: 'Capture A: slow signals',
      settings: {
        gpios: [0, 1, 2],
        sampleRateHz: 20_000,
        durationNs: 2.5e9,
        preTriggerNs: 50e6,
        trigger: { type: 'edge', gpio: 0, edge: 'rising' },
      },
      steps: [
        ...wireSteps([0, 1, 2]),
        'Capture 2.5 s and check GP0, GP1 and GP2 against the checklist.',
      ],
      views: [
        {
          title: 'Capture A',
          startNs: -50e6,
          endNs: 2.5e9,
          sampleRateHz: 20_000,
          caption: 'Three square waves, each ten times faster than the one above.',
        },
      ],
    },
    {
      title: 'Capture B: fast signals',
      settings: {
        gpios: [3, 4, 5, 6, 7, 8, 9],
        sampleRateHz: 10_000_000,
        durationNs: 6e6,
        preTriggerNs: 100e3,
        trigger: { type: 'edge', gpio: 3, edge: 'rising' },
      },
      steps: [
        `Move the probes to ${pinList([3, 4, 5, 6, 7, 8, 9])}.`,
        'Capture 6 ms triggered on GP3 and check the rest of the checklist.',
        'Also check that the rising edges at the trigger point line up across these pins.',
        'Repeat both captures with the probes on the inputs you have not tested yet, until every input of your analyzer has passed.',
      ],
      views: [
        {
          title: 'Capture B, first 120 µs',
          startNs: -10e3,
          endNs: 120e3,
          sampleRateHz: 10_000_000,
          caption: 'Every signal in this capture changes in this window.',
        },
      ],
    },
  ],
  checks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((gpio) => {
    const s = sig(gpio);
    const isPattern = s.kind === 'pattern';
    return {
      id: `gp${gpio}`,
      gpio,
      measure: isPattern ? 'frame length and first pulse' : s.kind === 'pulse' ? 'period and pulse width' : 'frequency and duty cycle',
      expected: isPattern
        ? `${formatTime(periodNs(s))} frame, starts with a ${formatTime(s.segments[0].ns)} high pulse`
        : s.kind === 'pulse'
          ? `${formatTime(periodNs(s))} period, ${formatTime(s.segments[0].ns)} high`
          : `${formatHz(s.actualHz)}, ${formatPercent(s.dutyPercent)} duty`,
    };
  }),
  tips: [
    '**Flat line** on an input: probe not connected, broken solder joint, or a dead input buffer.',
    '**Two inputs identical**: a solder bridge between them, or two probes on the same pin.',
    '**Right signal, wrong input**: swapped probe leads or a routing mistake. The frequencies tell you which signal you got.',
    '**Glitches or extra edges**: check the threshold is set for 3.3V logic and the ground lead is connected.',
    'Expect each measurement to be off by up to one sample period (50 µs in capture A, 100 ns in capture B).',
  ],
  questions: [],
};
