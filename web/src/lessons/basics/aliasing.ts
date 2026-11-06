// Lesson: sample rate and aliasing. Every number shown is computed from signals.json (the firmware's
// own config), so the lesson stays correct when the defaults change.

import { period, wireSteps } from '../helpers';
import type { Lesson } from '../types';

export const aliasing: Lesson = {
  id: 'aliasing',
  track: 'learn',
  title: '2. Sample rate and aliasing',
  summary: 'Capture 100 kHz too slowly and watch it lie to you.',
  gpios: [4, 5],
  intro:
    'An analyzer only sees the level at each sample. If it samples too slowly, a fast signal can look like a completely different, slower one. This is called aliasing. GP5 is 100 kHz; GP4 (10 kHz) is a reference you can trust at every rate used here.',
  parts: [
    {
      title: 'Capture GP5 at different rates',
      settings: {
        gpios: [4, 5],
        sampleRateHz: 150_000,
        durationNs: 13e6,
        preTriggerNs: 0.6e6,
        trigger: { type: 'edge', gpio: 4, edge: 'rising' },
      },
      steps: [
        ...wireSteps([4, 5]),
        'Capture at **150 kS/s**. Count the GP5 rising edges within one GP4 period.',
        'Repeat at **200 kS/s**, **400 kS/s**, **1 MS/s** and **10 MS/s**, and compare. If your analyzer does not offer exactly these rates, pick the nearest ones.',
      ],
      views: [
        {
          title: 'One GP4 period',
          startNs: -10e3,
          endNs: 200e3,
          sampleRateHz: 150_000,
          sampleRateOptions: [150_000, 200_000, 400_000, 1_000_000, 10_000_000],
          caption: `Pick a sample rate. The real GP5 signal has ${Math.round(period(4) / period(5))} periods per GP4 period.`,
        },
      ],
    },
  ],
  questions: [
    {
      q: 'What frequency does GP5 appear to have at 150 kS/s?',
      a: 'About 50 kHz. A 100 kHz signal sampled at 150 kS/s folds down to |150 - 100| = 50 kHz. Nothing on screen tells you it is wrong, which is why aliasing is dangerous.',
    },
    {
      q: 'At 200 kS/s (exactly twice the signal) it looks right. Is that enough?',
      a: 'Barely. You get one sample per half period, so the frequency is right but you know nothing about where the edges are or what the duty cycle is. Since the analyzer and the Pico have separate crystals, the picture can also slowly drift.',
    },
    {
      q: 'What rule of thumb should you use?',
      a: 'Sample at least 4 times faster than the fastest signal for a trustworthy shape, and 10 times or more if you want to measure timing. 1 MS/s or more for GP5.',
    },
  ],
};
