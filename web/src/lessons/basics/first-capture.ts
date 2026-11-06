// Lesson: your first capture. Every number shown is computed from signals.json (the firmware's
// own config), so the lesson stays correct when the defaults change.

import { formatHz } from '../../model/format';
import { sig, wireSteps } from '../helpers';
import type { Lesson } from '../types';

export const firstCapture: Lesson = {
  id: 'first-capture',
  track: 'learn',
  title: '1. Your first capture',
  summary: 'Four square waves, an edge trigger, and finding your way around a capture.',
  gpios: [0, 1, 2, 3],
  intro:
    'GP0 to GP3 output 1 Hz, 10 Hz, 100 Hz and 1 kHz square waves. Each is ten times faster than the previous one, which makes it easy to see how the sample rate and the capture length decide what you can see.',
  parts: [
    {
      title: 'Capture two seconds',
      settings: {
        gpios: [0, 1, 2, 3],
        sampleRateHz: 10_000,
        durationNs: 2e9,
        preTriggerNs: 200e6,
        trigger: { type: 'edge', gpio: 0, edge: 'rising' },
      },
      steps: [
        ...wireSteps([0, 1, 2, 3]),
        'In your analyzer software, enable those four inputs and enter the settings on the right. Give the inputs names like `GP0` so the capture is easy to read.',
        'Start the capture. It waits up to a second for the next rising edge on GP0, then records 2 seconds.',
        'Zoom out to see the whole capture, then zoom into the first 20 ms around the trigger.',
      ],
      views: [
        {
          title: 'Whole capture',
          startNs: -200e6,
          endNs: 2e9,
          sampleRateHz: 10_000,
          caption: 'GP3 (1 kHz) toggles too fast to draw at this zoom level. Most software shows it as a solid block.',
        },
        {
          title: 'First 20 ms',
          startNs: -2e6,
          endNs: 20e6,
          sampleRateHz: 10_000,
          caption: 'Zoomed in: GP3 now shows its 1 kHz square wave, 10 samples per period.',
        },
      ],
    },
  ],
  questions: [
    {
      q: 'How many GP1 periods fit in one GP0 period?',
      a: `Ten. GP0 is ${formatHz(sig(0).actualHz)} and GP1 is ${formatHz(sig(1).actualHz)}.`,
    },
    {
      q: 'Why do all four signals rise exactly at the trigger point?',
      a: 'The firmware starts all PIO outputs on the same clock cycle, and every period is a whole multiple of the faster ones. So every 1 Hz rising edge is also a rising edge of the other three.',
    },
    {
      q: 'At 10 kS/s, how precisely can you place an edge on GP3?',
      a: 'Only to within one sample, 100 µs. That is 10% of a 1 kHz period, so measuring GP3 duty cycle here is rough. Later lessons use faster rates for that.',
    },
  ],
};
